<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\DocumentLabel;
use App\Enums\DocumentVerificationStatus;
use App\Enums\RecordRequestStatus;
use App\Enums\RecordRequestType;
use App\Http\Controllers\Controller;
use App\Models\RecordRequest;
use App\Models\RequestDocument;
use App\Models\SacramentalRecord;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Services\RecordRequests;
use App\Support\DisplayName;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Record Requests for the parish office. The workflow, enforced here:
 * Pending → (start) Under Verification → documents checked, register entry
 * found → (send) with the priest → priest approves or rejects → (ready) Ready
 * for Collection → (complete) Completed. Every step is audited and the
 * requester is notified of the ones that concern them.
 */
class RecordRequestController extends Controller
{
    public function __construct(private AuditLogger $audit, private RecordRequests $requests, private OfficeNotifier $notifier) {}

    #[OA\Get(path: '/api/secretary/record-requests', summary: 'All record requests, newest first', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Requests')])]
    public function index(): JsonResponse
    {
        $rows = RecordRequest::query()->with(RecordRequests::WITH)->orderByDesc('requested_at')->get();

        return response()->json(['data' => $rows->map(fn ($r) => $this->requests->present($r, forOffice: true))->values()]);
    }

    #[OA\Post(path: '/api/secretary/record-requests/{request}/start', summary: 'Start verification; the request is assigned to you', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Started'), new OA\Response(response: 409, description: 'Not pending')])]
    public function start(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $r->status === RecordRequestStatus::Pending, function (RecordRequest $r, User $me) {
            $r->forceFill(['status' => RecordRequestStatus::UnderVerification, 'handled_by_staff_id' => $me->user_id, 'started_at' => now()])->save();
            $this->requests->notify($r, "Your request {$r->request_number} is being checked by the parish office.");

            return ['REQUEST_STATUS_CHANGED', ['from' => 'Pending', 'to' => 'Under Verification']];
        });
    }

    #[OA\Post(
        path: '/api/secretary/record-requests/{request}/documents/{document}/review',
        summary: 'Mark a document Verified, Needs Resubmission, or Rejected (note required for the last two)',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 409, description: 'Not being checked, or nothing uploaded yet')],
    )]
    public function reviewDocument(Request $request, RecordRequest $recordRequest, RequestDocument $requestDocument): JsonResponse
    {
        abort_unless($requestDocument->request_id === $recordRequest->request_id, 404);
        $data = $request->validate([
            'status' => ['required', Rule::in([DocumentVerificationStatus::Verified->value, DocumentVerificationStatus::NeedsResubmission->value, DocumentVerificationStatus::Rejected->value])],
            'note' => ['required_unless:status,Verified', 'nullable', 'string', 'min:8', 'max:1000'],
        ], ['note.required_unless' => 'Say what is wrong so the requester can fix it.', 'note.min' => 'Say what is wrong so the requester can fix it.']);

        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $this->checking($r), function (RecordRequest $r, User $me) use ($requestDocument, $data) {
            $doc = RequestDocument::query()->lockForUpdate()->findOrFail($requestDocument->getKey());
            if (! $doc->document_id) {
                return null;
            }
            $status = DocumentVerificationStatus::from($data['status']);
            $note = $status === DocumentVerificationStatus::Verified ? null : trim($data['note']);
            $title = $doc->title ?? $doc->document_label->value;
            $before = $doc->verification_status->value;
            $doc->forceFill(['verification_status' => $status, 'review_note' => $note, 'verified_by_user_id' => $me->user_id, 'verified_at' => now()])->save();

            if ($status === DocumentVerificationStatus::NeedsResubmission) {
                $this->requests->remark($r, $me, 'requirement', "Please upload the {$title} again: {$note}");
                $this->requests->notify($r, "Please upload the {$title} again for request {$r->request_number}: {$note}");
            } elseif ($status === DocumentVerificationStatus::Rejected) {
                $this->requests->notify($r, "The {$title} on request {$r->request_number} was not accepted: {$note}");
            }

            return ['DOCUMENT_VERIFIED', ['document' => $title, 'from' => $before, 'to' => $status->value, 'note' => $note]];
        });
    }

    #[OA\Post(path: '/api/secretary/record-requests/{request}/remarks', summary: 'Add a remark the requester can read', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Added')])]
    public function remark(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']], ['body.required' => 'Write the remark first.']);

        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $r->status === RecordRequestStatus::Pending || $this->checking($r), function (RecordRequest $r, User $me) use ($data) {
            $this->requests->remark($r, $me, 'remark', trim($data['body']));
            $this->requests->notify($r, "The parish office added a remark to request {$r->request_number}.");

            return ['REQUEST_REMARK_ADDED', ['remark' => trim($data['body'])]];
        });
    }

    #[OA\Post(
        path: '/api/secretary/record-requests/{request}/requirements',
        summary: 'Ask the requester for additional documents',
        description: 'labels: one or more of Valid ID, Birth Certificate, Baptismal Certificate, Death Certificate, Burial Permit, Other.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Requested')],
    )]
    public function requestDocuments(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        $data = $request->validate([
            'labels' => ['required', 'array', 'min:1'],
            'labels.*' => ['required', 'distinct', Rule::enum(DocumentLabel::class)],
            'message' => ['required', 'string', 'min:8', 'max:1000'],
        ], ['labels.required' => 'Choose at least one document.', 'message.min' => 'Explain what you need and why.', 'message.required' => 'Explain what you need and why.']);

        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $this->checking($r), function (RecordRequest $r, User $me) use ($data) {
            foreach ($data['labels'] as $label) {
                RequestDocument::create(['request_id' => $r->request_id, 'document_label' => $label, 'title' => $label]);
            }
            $list = implode(', ', $data['labels']);
            $message = trim($data['message']);
            $this->requests->remark($r, $me, 'requirement', "{$message} (Requested: {$list})");
            $this->requests->notify($r, "The parish office needs more documents for request {$r->request_number}: {$list}.");

            return ['REQUEST_DOCUMENTS_REQUESTED', ['documents' => $data['labels'], 'message' => $message]];
        });
    }

    #[OA\Post(
        path: '/api/secretary/record-requests/{request}/return-details',
        summary: 'Send the request back for the requester to correct the details they typed',
        description: 'note: what to fix (shown to the requester). The request stays with the office and can’t go to the priest until the requester sends corrected details from the tracking page.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Sent back'), new OA\Response(response: 409, description: 'Not being checked, or already waiting for corrected details')],
    )]
    public function returnDetails(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        $data = $request->validate(['note' => ['required', 'string', 'min:8', 'max:1000']], [
            'note.required' => 'Say which details are wrong so the requester can fix them.',
            'note.min' => 'Say which details are wrong so the requester can fix them.',
        ]);

        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $this->checking($r) && $r->details_returned_at === null, function (RecordRequest $r, User $me) use ($data) {
            $note = trim($data['note']);
            $r->forceFill(['details_returned_at' => now(), 'details_return_note' => $note])->save();
            $this->requests->remark($r, $me, 'requirement', "Please correct the details on your request: {$note}");
            $this->requests->notify($r, "Please correct the details on request {$r->request_number}: {$note} Open the request with its reference number to edit them.");

            return ['REQUEST_DETAILS_RETURNED', ['note' => $note]];
        });
    }

    #[OA\Get(
        path: '/api/secretary/registers/lookup',
        summary: 'Find a register entry by record type, book, page, and line',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'The entry, or entry: null when nothing is there')],
    )]
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'record_type' => ['required', Rule::in(array_keys(config('record_requests.forms')))],
            'book' => ['required', 'string', 'max:50'],
            'page' => ['required', 'string', 'max:50'],
            'line' => ['required', 'string', 'max:50'],
        ]);

        $entry = $this->findEntry($data['record_type'], $data['book'], $data['page'], $data['line']);

        return response()->json(['entry' => $entry ? [
            'record_id' => $entry->record_id,
            'subject' => trim(($entry->primaryParishioner?->first_name ?? '').' '.($entry->primaryParishioner?->last_name ?? '')),
            'event_date' => $entry->event_date?->toDateString(),
            'event_place' => $entry->event_place,
            'officiating_minister' => $entry->officiating_minister,
        ] : null,
            // Each register has its own books, so a place that is empty here may hold an entry in another register.
            'elsewhere' => $entry ? [] : SacramentalRecord::query()->with(['primaryParishioner', 'sacramentType'])
                ->whereHas('sacramentType', fn ($q) => $q->where('name', '!=', $data['record_type']))
                ->where('book_number', $data['book'])->where('page_number', $data['page'])->where('line_number', $data['line'])
                ->get()
                ->map(fn (SacramentalRecord $e) => [
                    'register' => $e->sacramentType->name,
                    'subject' => trim(($e->primaryParishioner?->first_name ?? '').' '.($e->primaryParishioner?->last_name ?? '')),
                ])->values(),
        ]);
    }

    #[OA\Post(
        path: '/api/secretary/record-requests/{request}/register',
        summary: 'Record the register entry (book, page, line) for this request',
        description: 'While checking, for certificate requests and corrections; after approval, for a New Registration once it is written in the register. Links the digital entry when one exists at that place.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 409, description: 'Not at a step that takes a register entry')],
    )]
    public function register(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        $data = $request->validate([
            'book' => ['required', 'string', 'max:50', 'regex:/^\d+$/'],
            'page' => ['required', 'string', 'max:50', 'regex:/^\d+$/'],
            'line' => ['required', 'string', 'max:50', 'regex:/^\d+$/'],
        ], ['*.regex' => 'Enter the book, page, and line as whole numbers.']);

        $newReg = fn (RecordRequest $r) => $r->request_type === RecordRequestType::NewRegistration;
        $allowed = fn (RecordRequest $r) => ($this->checking($r) && ! $newReg($r)) || ($r->status === RecordRequestStatus::Approved && $newReg($r));

        return $this->change($request, $recordRequest, $allowed, function (RecordRequest $r) use ($data) {
            $entry = $this->findEntry($r->recordType->name, $data['book'], $data['page'], $data['line']);
            $r->forceFill([
                'register_book' => $data['book'], 'register_page' => $data['page'], 'register_line' => $data['line'],
                'record_id' => $entry?->record_id ?? ($r->request_type === RecordRequestType::NewRegistration ? null : $r->record_id),
            ])->save();

            return ['REGISTER_LINKED', ['book' => $data['book'], 'page' => $data['page'], 'line' => $data['line'], 'record_id' => $entry?->record_id]];
        });
    }

    #[OA\Post(
        path: '/api/secretary/record-requests/{request}/send',
        summary: 'Mark verified and send to the priest',
        description: 'Needs every document uploaded and verified, and (except New Registration) the register entry recorded.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Sent'), new OA\Response(response: 422, description: 'Documents or register entry still missing')],
    )]
    public function send(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $this->checking($r), function (RecordRequest $r, User $me) {
            $docs = $r->requestDocuments()->get();
            if ($docs->isEmpty() || $docs->contains(fn (RequestDocument $d) => ! $d->document_id || $d->verification_status !== DocumentVerificationStatus::Verified)) {
                abort(response()->json(['message' => 'Verify every document before sending it to the priest.', 'errors' => ['documents' => ['Verify every document before sending it to the priest.']]], 422));
            }
            if ($r->details_returned_at !== null) {
                abort(response()->json(['message' => 'Wait for the requester to send corrected details.', 'errors' => ['details' => ['Wait for the requester to send corrected details.']]], 422));
            }
            if ($r->request_type !== RecordRequestType::NewRegistration && $r->register_book === null) {
                abort(response()->json(['message' => 'Record the register entry before sending it to the priest.', 'errors' => ['register' => ['Record the register entry before sending it to the priest.']]], 422));
            }
            $r->forceFill(['verified_by_staff_id' => $me->user_id, 'sent_to_priest_at' => now()])->save();
            $this->requests->notify($r, "Request {$r->request_number} was checked by the parish office and is waiting for the parish priest’s approval.");
            $this->notifier->awaitingPriest($r);

            return ['REQUEST_SENT_TO_PRIEST', ['verified_by' => DisplayName::of($me)]];
        });
    }

    #[OA\Post(path: '/api/secretary/record-requests/{request}/ready', summary: 'Mark an approved request ready for collection', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Ready'), new OA\Response(response: 422, description: 'A new registration has no register entry yet')])]
    public function ready(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $r->status === RecordRequestStatus::Approved, function (RecordRequest $r) {
            if ($r->request_type === RecordRequestType::NewRegistration && $r->register_book === null) {
                abort(response()->json(['message' => 'Record where the new entry was written in the register first.', 'errors' => ['register' => ['Record where the new entry was written in the register first.']]], 422));
            }
            $r->forceFill(['status' => RecordRequestStatus::ReadyForCollection, 'ready_at' => now()])->save();
            $this->requests->notify($r, "Your certificate for request {$r->request_number} is ready. Collect it at the parish office with a valid ID.");

            return ['REQUEST_STATUS_CHANGED', ['from' => 'Approved', 'to' => 'Ready for Collection']];
        });
    }

    #[OA\Post(path: '/api/secretary/record-requests/{request}/complete', summary: 'Mark released: the requester collected the certificate', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Completed')])]
    public function complete(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        return $this->change($request, $recordRequest, fn (RecordRequest $r) => $r->status === RecordRequestStatus::ReadyForCollection, function (RecordRequest $r) {
            $r->forceFill(['status' => RecordRequestStatus::Completed, 'completed_at' => now()])->save();
            $this->requests->notify($r, "Request {$r->request_number} is complete. Thank you.");

            return ['CERTIFICATE_RELEASED', ['from' => 'Ready for Collection', 'to' => 'Completed']];
        });
    }

    /** Being checked by staff and not yet sent to the priest. */
    private function checking(RecordRequest $r): bool
    {
        return $r->status === RecordRequestStatus::UnderVerification && $r->sent_to_priest_at === null;
    }

    private function findEntry(string $recordType, string $book, string $page, string $line): ?SacramentalRecord
    {
        return SacramentalRecord::query()->with('primaryParishioner')
            ->whereHas('sacramentType', fn ($q) => $q->where('name', $recordType))
            ->where('book_number', $book)->where('page_number', $page)->where('line_number', $line)
            ->first();
    }

    /**
     * Runs one workflow step under a row lock so two people can't act on the same request at once.
     *
     * @param  Closure(RecordRequest): bool  $allowed  whether the step applies to the request as it is now
     * @param  Closure(RecordRequest, User): (array{string, array<string, mixed>}|null)  $step  makes the change; returns the audit action and details, or null to refuse
     */
    private function change(Request $request, RecordRequest $recordRequest, Closure $allowed, Closure $step): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        $done = DB::transaction(function () use ($recordRequest, $allowed, $step, $me) {
            $r = RecordRequest::query()->with('recordType')->lockForUpdate()->findOrFail($recordRequest->getKey());
            if (! $allowed($r)) {
                return null;
            }
            $result = $step($r, $me);
            if (! $result) {
                return null;
            }
            [$action, $details] = $result;
            $r->touch();
            $this->audit->log($action, 'record_requests', $r->request_id, $me, ['request_number' => $r->request_number, ...$details]);

            return $r;
        });

        if (! $done) {
            return response()->json(['message' => 'This request has moved on since you opened it. Reload to see where it stands.'], 409);
        }

        return response()->json(['data' => $this->requests->present($done->fresh(), forOffice: true)]);
    }
}

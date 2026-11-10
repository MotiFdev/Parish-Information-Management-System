<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\DocumentVerificationStatus;
use App\Enums\RecordRequestStatus;
use App\Enums\RecordRequestType;
use App\Enums\RelationshipToSubject;
use App\Http\Controllers\Controller;
use App\Models\RecordRequest;
use App\Models\RequestDocument;
use App\Models\SacramentType;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Services\RecordRequests;
use App\Support\PhoneNumber;
use App\Support\ReferenceNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Record Requests on the public site: sending one, then following it and
 * uploading documents with its reference number. No account is needed.
 */
class RecordRequestController extends Controller
{
    public function __construct(private AuditLogger $audit, private RecordRequests $requests, private OfficeNotifier $notifier) {}

    #[OA\Get(
        path: '/api/public/record-requests/{reference}',
        summary: 'Track a record request by its reference number',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'The request and where it stands'), new OA\Response(response: 404, description: 'No request has this reference number')],
    )]
    public function show(string $reference): JsonResponse
    {
        return response()->json(['data' => $this->requests->presentForTracking($this->find($reference))]);
    }

    #[OA\Post(
        path: '/api/public/record-requests',
        summary: 'Submit a record request with its documents (multipart)',
        description: 'Fields: record_type, request_type, full_name, relationship, contact_number, email, address, parish, purpose, purpose_other, details[name], documents[key] (files), privacy_consent. The response carries the request_number the requester tracks it with.',
        tags: ['Public'],
        responses: [new OA\Response(response: 201, description: 'Submitted; returns the request with its reference number'), new OA\Response(response: 422, description: 'Missing details or documents')],
    )]
    public function store(Request $request): JsonResponse
    {
        if ($request->filled('contact_number')) {
            $request->merge(['contact_number' => PhoneNumber::normalize($request->input('contact_number'))]);
        }

        $recordType = (string) $request->input('record_type');
        $type = RecordRequestType::tryFrom((string) $request->input('request_type'));
        $form = $this->form($recordType, $type);
        $docs = $type && $form ? RecordRequests::documentsFor($recordType, $type) : [];

        $rules = [
            'record_type' => ['required', Rule::in(array_keys(config('record_requests.forms')))],
            'request_type' => ['required', Rule::enum(RecordRequestType::class)],
            'full_name' => ['required', 'string', 'max:200'],
            'relationship' => ['required', Rule::enum(RelationshipToSubject::class)],
            'contact_number' => ['required', 'string', PhoneNumber::RULE],
            'email' => ['required', 'email', 'max:150'],
            'address' => ['required', 'string', 'max:300'],
            'parish' => ['required', 'string', 'max:150'],
            'purpose' => ['required', Rule::in(config('record_requests.purposes'))],
            'purpose_other' => ['required_if:purpose,Other', 'nullable', 'string', 'max:200'],
            'details' => ['nullable', 'array'],
            'documents' => ['nullable', 'array'],
            'privacy_consent' => ['accepted'],
        ];
        [$detailRules, $detailMessages] = $this->detailRules($form, $type);
        $rules += $detailRules;
        foreach ($docs as $key => [, , $required]) {
            $rules["documents.{$key}"] = [$required ? 'required' : 'nullable', ...RecordRequests::fileRules()];
        }

        $messages = ['privacy_consent.accepted' => 'Please accept the privacy notice to submit.', 'contact_number.regex' => PhoneNumber::MESSAGE];
        foreach ($docs as $key => [, $title]) {
            $messages["documents.{$key}.required"] = "Please attach the {$title}.";
            $messages["documents.{$key}.mimes"] = 'Upload a PDF, JPG, or PNG file.';
            $messages["documents.{$key}.max"] = 'The file is too large. The limit is '.round(config('record_requests.max_upload_kb') / 1024).' MB.';
        }
        $data = $request->validate($rules, $messages + $detailMessages);

        $fields = $this->cleanDetails($data['details'] ?? [], $form);

        $created = DB::transaction(function () use ($data, $recordType, $fields, $docs, $request) {
            $r = RecordRequest::create([
                'record_type_id' => SacramentType::where('name', $recordType)->value('sacrament_type_id'),
                'request_type' => $data['request_type'],
                'relationship_to_subject' => $data['relationship'],
                'client_full_name' => trim($data['full_name']),
                'client_contact_number' => $data['contact_number'],
                'client_email' => $data['email'],
                'client_address' => $data['address'],
                'parish' => $data['parish'],
                'purpose' => $data['purpose'] === 'Other' ? 'Other: '.trim((string) $data['purpose_other']) : $data['purpose'],
                'subject_details' => ['fields' => $fields],
                'privacy_consent' => true,
                'status' => RecordRequestStatus::Pending,
            ]);

            foreach ($docs as $key => [$label, $title]) {
                $file = $request->file("documents.{$key}");
                if (! $file) {
                    continue;
                }
                $document = $this->requests->store($file, $r);
                RequestDocument::create(['request_id' => $r->request_id, 'document_id' => $document->document_id, 'document_label' => $label, 'title' => $title]);
            }

            return $r;
        });

        $this->audit->log('REQUEST_SUBMITTED', 'record_requests', $created->request_id, null, [
            'request_number' => $created->request_number,
            'record_type' => $recordType,
            'request_type' => $created->request_type->value,
        ]);
        $this->notifier->newRequest($created);

        return response()->json(['data' => $this->requests->presentForTracking($created->fresh())], 201);
    }

    #[OA\Post(
        path: '/api/public/record-requests/{reference}/documents/{document}',
        summary: 'Upload a document again, or one staff asked for (multipart field: file)',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'Uploaded; returns the request'), new OA\Response(response: 404, description: 'No such request or document'), new OA\Response(response: 409, description: 'This document isn’t waiting for an upload'), new OA\Response(response: 422, description: 'Missing or unsupported file')],
    )]
    public function upload(Request $request, string $reference, RequestDocument $requestDocument): JsonResponse
    {
        $recordRequest = $this->find($reference);
        abort_unless($requestDocument->request_id === $recordRequest->request_id, 404);

        $request->validate(['file' => ['required', ...RecordRequests::fileRules()]], [
            'file.required' => 'Choose the file to upload.',
            'file.mimes' => 'Upload a PDF, JPG, or PNG file.',
            'file.max' => 'The file is too large. The limit is '.round(config('record_requests.max_upload_kb') / 1024).' MB.',
        ]);

        $open = $recordRequest->status === RecordRequestStatus::Pending
            || ($recordRequest->status === RecordRequestStatus::UnderVerification && ! $recordRequest->sent_to_priest_at);
        $waiting = $requestDocument->document_id === null
            || in_array($requestDocument->verification_status, [DocumentVerificationStatus::NeedsResubmission, DocumentVerificationStatus::Rejected], true);
        if (! $open || ! $waiting) {
            return response()->json(['message' => 'This document isn’t waiting for a new upload.'], 409);
        }

        $previous = $requestDocument->document_id;
        DB::transaction(function () use ($request, $recordRequest, $requestDocument) {
            $document = $this->requests->store($request->file('file'), $recordRequest);
            // The earlier file stays in storage and in documents for the audit trail.
            $requestDocument->forceFill([
                'document_id' => $document->document_id,
                'verification_status' => DocumentVerificationStatus::Pending,
                'verified_by_user_id' => null,
                'verified_at' => null,
            ])->save();
        });

        $this->audit->log('DOCUMENT_UPLOADED', 'request_documents', $requestDocument->request_document_id, null, [
            'request_number' => $recordRequest->request_number,
            'document' => $requestDocument->title ?? $requestDocument->document_label->value,
            'replaced_document_id' => $previous,
        ]);
        $this->notifier->resubmitted($recordRequest, 'The requester uploaded the '.($requestDocument->title ?? $requestDocument->document_label->value)." again for request {$recordRequest->request_number}.");

        return response()->json(['data' => $this->requests->presentForTracking($recordRequest->fresh())]);
    }

    #[OA\Post(
        path: '/api/public/record-requests/{reference}/details/unlock',
        summary: 'The details typed on a request that staff sent back, for the requester to correct',
        description: 'Needs the email the request was sent with, because the reference number alone shows no personal details.',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'details'), new OA\Response(response: 409, description: 'Not waiting for corrected details'), new OA\Response(response: 422, description: 'Wrong email')],
    )]
    public function unlockDetails(Request $request, string $reference): JsonResponse
    {
        $recordRequest = $this->returnedRequest($request, $reference);

        return response()->json(['details' => (object) ($recordRequest->subject_details['fields'] ?? [])]);
    }

    #[OA\Put(
        path: '/api/public/record-requests/{reference}/details',
        summary: 'Send corrected details back to the parish office',
        description: 'Fields: email (as on the request) and details[name], validated like a new request of the same type.',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'Saved; returns the request'), new OA\Response(response: 409, description: 'Not waiting for corrected details'), new OA\Response(response: 422, description: 'Wrong email or missing details')],
    )]
    public function updateDetails(Request $request, string $reference): JsonResponse
    {
        $recordRequest = $this->returnedRequest($request, $reference);
        $form = $this->form($recordRequest->recordType->name, $recordRequest->request_type);
        [$rules, $messages] = $this->detailRules($form, $recordRequest->request_type);
        $data = $request->validate(['details' => ['required', 'array'], ...$rules], $messages);

        $before = $recordRequest->subject_details['fields'] ?? [];
        $after = $this->cleanDetails($data['details'], $form);
        $changed = collect(array_keys($form))
            ->filter(fn ($k) => ($before[$k] ?? null) !== ($after[$k] ?? null))
            ->mapWithKeys(fn ($k) => [$k => ['from' => $before[$k] ?? null, 'to' => $after[$k] ?? null]])
            ->all();

        DB::transaction(function () use ($recordRequest, $after) {
            $r = RecordRequest::query()->lockForUpdate()->findOrFail($recordRequest->getKey());
            abort_if($r->details_returned_at === null, 409, 'These details were already sent back to the parish office.');
            $r->forceFill([
                'subject_details' => ['fields' => $after],
                'details_returned_at' => null,
                'details_return_note' => null,
                'details_updated_at' => now(),
            ])->save();
        });

        $this->audit->log('REQUEST_DETAILS_UPDATED', 'record_requests', $recordRequest->request_id, null, [
            'request_number' => $recordRequest->request_number, 'changes' => $changed,
        ]);
        $this->notifier->resubmitted($recordRequest, "The requester sent corrected details for request {$recordRequest->request_number}.");

        return response()->json(['data' => $this->requests->presentForTracking($recordRequest->fresh())]);
    }

    /** A request staff sent back for corrected details, once the requester gives its email. */
    private function returnedRequest(Request $request, string $reference): RecordRequest
    {
        $recordRequest = $this->find($reference);
        $email = $request->validate(['email' => ['required', 'email', 'max:150']], [
            'email.required' => 'Enter the email you used on this request.',
            'email.email' => 'Enter the email you used on this request.',
        ])['email'];

        if (strcasecmp(trim($email), (string) $recordRequest->client_email) !== 0) {
            throw ValidationException::withMessages(['email' => 'That is not the email on this request. Use the one you entered when you sent it.']);
        }
        abort_if($recordRequest->details_returned_at === null, 409, 'The parish office is not waiting for corrected details on this request.');

        return $recordRequest;
    }

    /**
     * The detail fields for a record and request type: name => key | reg | optional.
     *
     * @return array<string, string>
     */
    private function form(string $recordType, ?RecordRequestType $type): array
    {
        $form = config("record_requests.forms.{$recordType}", []);
        if ($type === RecordRequestType::RecordCorrection) {
            $form += config('record_requests.correction_fields');
        }

        return $form;
    }

    /**
     * @param  array<string, string>  $form
     * @return array{0: array<string, list<string>>, 1: array<string, string>}
     */
    private function detailRules(array $form, ?RecordRequestType $type): array
    {
        $rules = [];
        $messages = [];
        foreach ($form as $name => $rule) {
            $required = $rule === 'key' || ($rule === 'reg' && $type === RecordRequestType::NewRegistration);
            $rules["details.{$name}"] = [$required ? 'required' : 'nullable', 'string', 'max:500'];
            $messages["details.{$name}.required"] = 'This field is required.';
        }

        return [$rules, $messages];
    }

    /**
     * @param  array<string, mixed>  $details
     * @param  array<string, string>  $form
     * @return array<string, string>
     */
    private function cleanDetails(array $details, array $form): array
    {
        return collect($details)->only(array_keys($form))
            ->map(fn ($v) => is_string($v) ? trim($v) : $v)->filter(fn ($v) => $v !== null && $v !== '')->all();
    }

    private function find(string $reference): RecordRequest
    {
        $number = ReferenceNumber::normalize($reference, ReferenceNumber::RECORD_REQUEST);
        $recordRequest = $number ? RecordRequest::query()->with(RecordRequests::WITH)->where('request_number', $number)->first() : null;
        abort_if($recordRequest === null, 404, 'No record request has this reference number.');

        return $recordRequest;
    }
}

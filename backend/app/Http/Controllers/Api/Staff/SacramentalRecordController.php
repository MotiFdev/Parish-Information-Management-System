<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\RecordRequest;
use App\Models\SacramentalRecord;
use App\Models\SacramentalRecordCorrection;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Services\RegisterDraft;
use App\Services\SacramentalRegister;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Sacramental Records in the staff portal: the four registers, new entries
 * typed in from the books, and corrections, which wait for the parish priest.
 */
class SacramentalRecordController extends Controller
{
    public function __construct(private SacramentalRegister $register, private AuditLogger $audit, private RegisterDraft $drafts, private OfficeNotifier $notifier) {}

    #[OA\Get(
        path: '/api/secretary/sacramental-records',
        summary: 'One register (?type=Baptism|Confirmation|Marriage|Burial), newest first, with the entry count of each register',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'data (entries) and counts')],
    )]
    public function index(Request $request): JsonResponse
    {
        $type = $request->validate(['type' => ['required', Rule::in(SacramentalRegister::TYPES)]])['type'];

        return response()->json($this->register->listing($type));
    }

    #[OA\Post(
        path: '/api/secretary/sacramental-records',
        summary: 'Add an entry as written in the register book',
        tags: ['Staff'],
        responses: [new OA\Response(response: 201, description: 'The new entry'), new OA\Response(response: 422, description: 'Invalid, or that book, page, and line already hold an entry')],
    )]
    public function store(Request $request): JsonResponse
    {
        $type = $request->validate([
            'type' => ['required', Rule::in(SacramentalRegister::TYPES)],
            'request_id' => ['nullable', 'uuid'],
        ])['type'];
        $number = ['required', 'string', 'max:50', 'regex:/^[1-9]\d*$/'];
        $data = $request->validate(
            ['book' => $number, 'page' => $number, 'line' => $number, ...$this->register->rules($type)],
            ['book.*' => 'Enter the book, page, and line as whole numbers.', 'page.*' => 'Enter the book, page, and line as whole numbers.', 'line.*' => 'Enter the book, page, and line as whole numbers.', ...$this->register->messages($type)],
        );
        $place = ['book' => $data['book'], 'page' => $data['page'], 'line' => $data['line']];

        $this->ensurePlaceIsFree($type, $place);

        /** @var User $me */
        $me = $request->user();
        try {
            [$record, $source] = DB::transaction(function () use ($request, $type, $place, $data, $me) {
                $source = $request->filled('request_id') ? $this->lockSourceRequest((string) $request->input('request_id'), $type) : null;
                $record = $this->register->create($type, $place, $data['values'], $me);
                if ($source) {
                    $record->forceFill(['source_request_id' => $source->request_id])->save();
                    $source->forceFill([
                        'register_book' => $place['book'], 'register_page' => $place['page'], 'register_line' => $place['line'], 'record_id' => $record->record_id,
                    ])->save();
                }

                return [$record, $source];
            });
        } catch (UniqueConstraintViolationException) {
            // Someone else saved the same place a moment ago.
            $this->ensurePlaceIsFree($type, $place);
            throw ValidationException::withMessages(['register' => 'That place in the register was just taken. Check the book and try again.']);
        }

        $record->load(SacramentalRegister::relations());
        $entry = $this->register->present($record);
        $this->audit->log('SACRAMENTAL_RECORD_ADDED', 'sacramental_records', $record->record_id, $me, [
            'type' => $type, 'subject' => $entry['subject'], ...$place, 'request_number' => $source?->request_number,
        ]);
        if ($source) {
            $this->audit->log('REGISTER_LINKED', 'record_requests', $source->request_id, $me, [
                'request_number' => $source->request_number, ...$place, 'record_id' => $record->record_id,
            ]);
        }

        return response()->json(['entry' => $entry], 201);
    }

    #[OA\Get(
        path: '/api/secretary/record-requests/{request}/entry-draft',
        summary: 'The create form filled in from an approved New Registration',
        description: 'values are keyed like the create form; notes list what the requester wrote that staff have to settle (for example an approximate date).',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'The draft'), new OA\Response(response: 409, description: 'Not approved, not a New Registration, or already entered')],
    )]
    public function draft(RecordRequest $recordRequest): JsonResponse
    {
        $recordRequest->loadMissing('recordType');
        if ($reason = $this->drafts->blockedReason($recordRequest)) {
            return response()->json(['message' => $reason], 409);
        }

        return response()->json([
            'request_id' => $recordRequest->request_id,
            'request_number' => $recordRequest->request_number,
            ...$this->drafts->for($recordRequest),
        ]);
    }

    #[OA\Post(
        path: '/api/secretary/sacramental-records/{record}/corrections',
        summary: 'Send a correction to the priest; replaces one that is still waiting',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'The entry, with its waiting correction'), new OA\Response(response: 422, description: 'Invalid, or nothing changed')],
    )]
    public function correct(Request $request, SacramentalRecord $record): JsonResponse
    {
        $record->load(SacramentalRegister::relations());
        $type = $record->sacramentType->name;
        $current = $this->register->valuesOf($record);
        $data = $request->validate($this->register->rules($type, $current), $this->register->messages($type));

        $changes = $this->register->diff($type, $current, $data['values']);
        if (! $changes) {
            throw ValidationException::withMessages(['values' => 'Nothing changed, so there is nothing to send.']);
        }

        /** @var User $me */
        $me = $request->user();
        $correction = DB::transaction(function () use ($record, $data, $changes, $me) {
            $pending = SacramentalRecordCorrection::query()->where('record_id', $record->record_id)
                ->where('status', ApprovalStatus::Pending->value)->lockForUpdate()->first();

            $fields = ['proposed_values' => $data['values'], 'changes' => $changes, 'requested_by_user_id' => $me->user_id];

            return $pending ? tap($pending)->update($fields) : $record->corrections()->create($fields);
        });

        $this->audit->log('RECORD_CORRECTION_REQUESTED', 'sacramental_records', $record->record_id, $me, [
            'correction_id' => $correction->correction_id, 'changes' => $changes,
        ]);
        $this->notifier->correctionAwaitingPriest($record, $type, $this->register->subjectOf($record));

        return response()->json(['entry' => $this->register->present($record->fresh(SacramentalRegister::relations()))]);
    }

    /** The New Registration this entry is made from, locked until the entry is saved and linked. */
    private function lockSourceRequest(string $id, string $type): RecordRequest
    {
        $source = RecordRequest::query()->with('recordType')->lockForUpdate()->find($id);
        $reason = ! $source ? 'That request no longer exists.'
            : ($source->recordType?->name !== $type ? "That request is for the {$source->recordType?->name} register." : $this->drafts->blockedReason($source));
        if ($reason) {
            throw ValidationException::withMessages(['request_id' => $reason]);
        }

        return $source;
    }

    /**
     * @param  array{book: string, page: string, line: string}  $place
     */
    private function ensurePlaceIsFree(string $type, array $place): void
    {
        $taken = SacramentalRecord::query()->with(SacramentalRegister::relations())
            ->whereHas('sacramentType', fn ($q) => $q->where('name', $type))
            ->where('book_number', $place['book'])->where('page_number', $place['page'])->where('line_number', $place['line'])
            ->first();

        if ($taken) {
            $subject = $this->register->present($taken)['subject'];
            throw ValidationException::withMessages(['register' => "Book {$place['book']}, page {$place['page']}, line {$place['line']} already holds {$subject}."]);
        }
    }
}

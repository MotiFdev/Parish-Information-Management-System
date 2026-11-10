<?php

namespace App\Services;

use App\Enums\RecordRequestStatus;
use App\Enums\RecordRequestType;
use App\Models\Document;
use App\Models\Notification;
use App\Models\RecordRequest;
use App\Models\RecordRequestRemark;
use App\Models\RequestDocument;
use App\Models\User;
use App\Support\DisplayName;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Shared by the public, staff, and priest record-request endpoints: storing
 * uploads privately, notifying the requester, and the JSON shapes they read.
 */
class RecordRequests
{
    /** Relations present() reads. */
    public const WITH = [
        'recordType', 'requestDocuments.document', 'remarkThread.author.role',
        'handledByStaff.role', 'verifiedByStaff.role', 'approvedByPriest.role',
    ];

    public static function disk(): string
    {
        return (string) config('record_requests.disk', 'local');
    }

    /**
     * File rules for one upload: PDF, JPG, or PNG up to the configured size.
     *
     * @return list<string>
     */
    public static function fileRules(): array
    {
        return ['file', 'mimes:pdf,jpg,jpeg,png', 'max:'.(int) config('record_requests.max_upload_kb')];
    }

    /**
     * Saves an upload to private storage and records it in documents. The
     * uploader is null for files sent from the public site.
     */
    public function store(UploadedFile $file, RecordRequest $request, ?User $uploader = null): Document
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $path = $file->storeAs("record-requests/{$request->request_id}", Str::uuid().'.'.$ext, ['disk' => self::disk()]);
        if ($path === false) {
            throw new \RuntimeException('The file could not be saved.');
        }

        return Document::create([
            'file_name' => Str::limit($file->getClientOriginalName(), 250, ''),
            'file_path' => $path,
            'file_type' => (string) ($file->getMimeType() ?? $file->getClientMimeType()),
            'file_size' => (int) $file->getSize(),
            'uploaded_by_user_id' => $uploader?->user_id,
        ]);
    }

    /**
     * In-app notice for requests sent from a parishioner account. Requests from
     * the public site have no inbox; their requester follows the status by
     * reference number instead.
     */
    public function notify(RecordRequest $request, string $message): void
    {
        if ($request->requested_by_user_id === null) {
            return;
        }

        Notification::create(['user_id' => $request->requested_by_user_id, 'request_id' => $request->request_id, 'message' => $message]);
    }

    public function remark(RecordRequest $request, User $author, string $kind, string $body): RecordRequestRemark
    {
        return RecordRequestRemark::create(['request_id' => $request->request_id, 'user_id' => $author->user_id, 'kind' => $kind, 'body' => $body]);
    }

    /** "Juan Dela Cruz", "Mark Aquino & Bea Gonzaga", or the deceased's name. */
    public static function subject(RecordRequest $r): string
    {
        $d = $r->subject_details['fields'] ?? [];

        return match ($r->recordType?->name) {
            'Marriage' => trim(($d['groomName'] ?? '').' & '.($d['brideName'] ?? ''), ' &'),
            'Burial' => (string) ($d['deceasedName'] ?? ''),
            default => (string) ($d['fullName'] ?? ''),
        } ?: $r->client_full_name;
    }

    /**
     * The request as the requester tracks it on the public site. Anyone holding
     * the reference number can read this, so the requester's contact details,
     * the personal details from the form, and the register reference stay out.
     *
     * @return array<string, mixed>
     */
    public function presentForTracking(RecordRequest $r): array
    {
        $data = Arr::except($this->present($r), ['request_id', 'client', 'details', 'register']);
        $data['documents'] = $data['documents']->map(fn (array $d) => [
            ...$d,
            'file' => $d['file'] ? Arr::only($d['file'], ['file_name', 'uploaded_at']) : null,
        ]);

        return $data;
    }

    /**
     * The request as the staff and priest portals read it; the register
     * reference only with $forOffice.
     *
     * @return array<string, mixed>
     */
    public function present(RecordRequest $r, bool $forOffice = false): array
    {
        $r->loadMissing(self::WITH);
        $iso = fn ($t) => $t?->toIso8601String();
        $hasRef = $r->register_book !== null;

        return [
            'request_id' => $r->request_id,
            'request_number' => $r->request_number,
            'record_type' => $r->recordType?->name,
            'request_type' => $r->request_type->value,
            'status' => $r->status->value,
            'with_priest' => $r->isWithPriest(),
            'subject' => self::subject($r),
            'relationship' => $r->relationship_to_subject->value,
            'purpose' => $r->purpose,
            'parish' => $r->parish,
            'client' => [
                'name' => $r->client_full_name,
                'contact_number' => $r->client_contact_number,
                'email' => $r->client_email,
                'address' => $r->client_address,
            ],
            'details' => (object) ($r->subject_details['fields'] ?? []),
            'documents' => $r->requestDocuments->sortBy(fn (RequestDocument $d) => $d->document?->uploaded_at?->timestamp ?? PHP_INT_MAX)->values()->map(fn (RequestDocument $d) => [
                'request_document_id' => $d->request_document_id,
                'label' => $d->document_label->value,
                'title' => $d->title ?? $d->document_label->value,
                'status' => $d->verification_status->value,
                'review_note' => $d->review_note,
                'file' => $d->document ? [
                    'document_id' => $d->document->document_id,
                    'file_name' => $d->document->file_name,
                    'file_type' => $d->document->file_type,
                    'file_size' => $d->document->file_size,
                    'uploaded_at' => $iso($d->document->uploaded_at),
                ] : null,
            ]),
            'remarks' => $r->remarkThread->map(fn (RecordRequestRemark $m) => [
                'remark_id' => $m->remark_id,
                'kind' => $m->kind,
                'body' => $m->body,
                'by' => DisplayName::of($m->author),
                'at' => $iso($m->created_at),
            ]),
            'handled_by' => DisplayName::of($r->handledByStaff),
            'verified_by' => DisplayName::of($r->verifiedByStaff),
            'decided_by' => DisplayName::of($r->approvedByPriest),
            'register' => $forOffice && $hasRef ? [
                'book' => $r->register_book,
                'page' => $r->register_page,
                'line' => $r->register_line,
                'record_id' => $r->record_id,
            ] : null,
            'rejection_reason' => $r->status === RecordRequestStatus::Rejected ? $r->remarks : null,
            // Sent back for the requester to correct their details; it can't go to the priest meanwhile.
            'details_returned' => $r->details_returned_at ? ['at' => $iso($r->details_returned_at), 'note' => $r->details_return_note] : null,
            'details_updated_at' => $iso($r->details_updated_at),
            'requested_at' => $iso($r->requested_at),
            'started_at' => $iso($r->started_at),
            'sent_to_priest_at' => $iso($r->sent_to_priest_at),
            'decided_at' => $iso($r->decided_at),
            'ready_at' => $iso($r->ready_at),
            'completed_at' => $iso($r->completed_at),
        ];
    }

    /**
     * Document keys and specs for a record and request type.
     *
     * @return array<string, array{0: string, 1: string, 2: bool}>
     */
    public static function documentsFor(string $recordType, RecordRequestType $type): array
    {
        $docs = config("record_requests.documents.{$recordType}", []);

        return $type === RecordRequestType::RecordCorrection ? config('record_requests.correction_document') + $docs : $docs;
    }

    /** Short-lived link to view a stored file: a cloud signed URL, or a signed route for local disks. */
    public static function link(Document $document): string
    {
        $minutes = max(1, (int) config('record_requests.link_minutes'));
        $disk = Storage::disk(self::disk());

        if ($disk->providesTemporaryUrls() && config('filesystems.disks.'.self::disk().'.driver') !== 'local') {
            return $disk->temporaryUrl($document->file_path, now()->addMinutes($minutes));
        }

        return URL::temporarySignedRoute('documents.file', now()->addMinutes($minutes), ['document' => $document->document_id]);
    }
}

<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\DocumentLabel;
use App\Enums\RecordRequestStatus;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Parishioner;
use App\Models\RecordRequest;
use App\Models\RequestDocument;
use App\Models\SacramentalRecord;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RecordRequests;
use App\Services\SacramentalRegister;
use App\Support\DisplayName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Documents in the staff portal: every uploaded file, filed against the record
 * it belongs to. A file is linked to one register entry (a scanned page), one
 * parishioner, one record request, or nothing yet. Files a requester attached
 * to a request stay with that request, so they can't be moved.
 */
class DocumentController extends Controller
{
    public const REGISTER_SCAN = 'Register scan';

    public function __construct(private AuditLogger $audit, private SacramentalRegister $register) {}

    #[OA\Get(
        path: '/api/secretary/documents',
        summary: 'Every document with what it is linked to, and the records a file can be linked to',
        description: 'One parish is small enough to load whole; the page filters it.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'data (files) and targets (entries, open requests, parishioners)')],
    )]
    public function index(): JsonResponse
    {
        $files = Document::query()
            ->with(['uploadedBy', 'record.sacramentType', 'record.primaryParishioner', 'record.secondaryParishioner', 'parishioner', 'requestDocuments.recordRequest'])
            ->orderByDesc('uploaded_at')
            ->get();

        $entries = SacramentalRecord::query()->with(['sacramentType', 'primaryParishioner', 'secondaryParishioner'])
            ->orderBy('book_number')->orderBy('page_number')->orderBy('line_number')->get();

        return response()->json([
            'data' => $files->map(fn (Document $d) => $this->present($d))->values(),
            'targets' => [
                'entries' => $entries->map(fn (SacramentalRecord $r) => [
                    'id' => $r->record_id,
                    'type' => $r->sacramentType->name,
                    'register' => ['book' => (int) $r->book_number, 'page' => (int) $r->page_number, 'line' => (int) $r->line_number],
                    'subject' => $this->subject($r),
                ])->values(),
                'requests' => RecordRequest::query()->with('recordType')->orderByDesc('requested_at')->get()
                    ->filter(fn (RecordRequest $r) => $this->takesFiles($r))
                    ->map(fn (RecordRequest $r) => [
                        'id' => $r->request_id,
                        'number' => $r->request_number,
                        'record_type' => $r->recordType?->name,
                        'request_type' => $r->request_type->value,
                        'subject' => RecordRequests::subject($r),
                    ])->values(),
                'parishioners' => Parishioner::query()->where('is_archived', false)->orderBy('last_name')->orderBy('first_name')->get()
                    ->map(fn (Parishioner $p) => [
                        'id' => $p->parishioner_id,
                        'name' => $this->nameOf($p),
                        'born' => $p->date_of_birth?->format('Y'),
                    ])->values(),
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/secretary/documents',
        summary: 'Upload one file (multipart), optionally linked to a record',
        description: 'Fields: file, link (register | request | parishioner | none), target_id, label (for request and parishioner links).',
        tags: ['Staff'],
        responses: [new OA\Response(response: 201, description: 'The new file'), new OA\Response(response: 422, description: 'Missing or unsupported file, or no record chosen')],
    )]
    public function store(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', ...RecordRequests::fileRules()]], [
            'file.required' => 'Choose the file to upload.',
            'file.mimes' => 'Upload a PDF, JPG, or PNG file.',
            'file.max' => 'The file is too large. The limit is '.round(config('record_requests.max_upload_kb') / 1024).' MB.',
        ]);
        $link = $this->validatedLink($request);
        /** @var User $me */
        $me = $request->user();

        $document = DB::transaction(function () use ($request, $link, $me) {
            $document = $this->storeFile($request->file('file'), $me);
            $this->applyLink($document, $link);

            return $document;
        });

        $this->audit->log('DOCUMENT_ADDED', 'documents', $document->document_id, $me, ['file' => $document->file_name, 'link' => $this->describe($document->fresh())]);

        return response()->json(['data' => $this->present($this->fresh($document))], 201);
    }

    #[OA\Patch(
        path: '/api/secretary/documents/{document}/link',
        summary: 'Change what a file is linked to',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 409, description: 'A request upload, which stays with its request')],
    )]
    public function relink(Request $request, Document $document): JsonResponse
    {
        if ($document->requestDocuments()->exists()) {
            return response()->json(['message' => 'This file belongs to a record request, so it stays with that request.'], 409);
        }
        $link = $this->validatedLink($request);
        $before = $this->describe($document);

        DB::transaction(function () use ($document, $link) {
            $document->forceFill(['record_id' => null, 'parishioner_id' => null, 'label' => null]);
            $this->applyLink($document, $link);
        });

        /** @var User $me */
        $me = $request->user();
        $this->audit->log('DOCUMENT_LINKED', 'documents', $document->document_id, $me, [
            'file' => $document->file_name, 'from' => $before, 'to' => $this->describe($document->fresh()),
        ]);

        return response()->json(['data' => $this->present($this->fresh($document))]);
    }

    /**
     * @return array{kind: string, target: SacramentalRecord|RecordRequest|Parishioner|null, label: string|null}
     */
    private function validatedLink(Request $request): array
    {
        $data = $request->validate([
            'link' => ['required', Rule::in(['register', 'request', 'parishioner', 'none'])],
            'target_id' => ['required_unless:link,none', 'nullable', 'uuid'],
            'label' => ['nullable', Rule::enum(DocumentLabel::class)],
        ], [
            'link.required' => 'Choose what the file is linked to.',
            'target_id.required_unless' => 'Choose the record this file belongs to.',
            'target_id.uuid' => 'Choose the record this file belongs to.',
        ]);

        $kind = $data['link'];
        $id = $data['target_id'] ?? null;
        $target = match ($kind) {
            'register' => SacramentalRecord::query()->find($id),
            'request' => RecordRequest::query()->find($id),
            'parishioner' => Parishioner::query()->find($id),
            default => null,
        };
        if ($kind !== 'none' && ! $target) {
            throw ValidationException::withMessages(['target_id' => 'That record no longer exists. Reload and choose again.']);
        }
        if ($target instanceof RecordRequest && ! $this->takesFiles($target)) {
            throw ValidationException::withMessages(['target_id' => 'Files can only be added to a request while the office is still checking it.']);
        }
        if ($target instanceof Parishioner && $target->is_archived) {
            throw ValidationException::withMessages(['target_id' => 'That parishioner is archived. Restore them first.']);
        }

        return ['kind' => $kind, 'target' => $target, 'label' => $kind === 'register' ? self::REGISTER_SCAN : ($data['label'] ?? DocumentLabel::Other->value)];
    }

    /**
     * @param  array{kind: string, target: SacramentalRecord|RecordRequest|Parishioner|null, label: string|null}  $link
     */
    private function applyLink(Document $document, array $link): void
    {
        $target = $link['target'];
        $document->forceFill([
            'record_id' => $target instanceof SacramentalRecord ? $target->record_id : null,
            'parishioner_id' => $target instanceof Parishioner ? $target->parishioner_id : null,
            'label' => $link['kind'] === 'none' ? null : $link['label'],
        ])->save();

        if ($target instanceof RecordRequest) {
            // Filed with the request like a requester's upload, waiting for staff to check it.
            RequestDocument::query()->create([
                'request_id' => $target->request_id,
                'document_id' => $document->document_id,
                'document_label' => $link['label'],
                'title' => $link['label'],
            ]);
        }
    }

    private function storeFile(UploadedFile $file, User $me): Document
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'bin');
        $path = $file->storeAs('documents', Str::uuid().'.'.$ext, ['disk' => RecordRequests::disk()]);
        if ($path === false) {
            throw new \RuntimeException('The file could not be saved.');
        }

        return Document::query()->create([
            'file_name' => Str::limit($file->getClientOriginalName(), 250, ''),
            'file_path' => $path,
            'file_type' => (string) ($file->getMimeType() ?? $file->getClientMimeType()),
            'file_size' => (int) $file->getSize(),
            'uploaded_by_user_id' => $me->user_id,
        ]);
    }

    /** Pending, or being checked and not yet with the priest. */
    private function takesFiles(RecordRequest $r): bool
    {
        return $r->status === RecordRequestStatus::Pending
            || ($r->status === RecordRequestStatus::UnderVerification && $r->sent_to_priest_at === null);
    }

    private function fresh(Document $d): Document
    {
        return $d->fresh(['uploadedBy', 'record.sacramentType', 'record.primaryParishioner', 'record.secondaryParishioner', 'parishioner', 'requestDocuments.recordRequest']);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Document $d): array
    {
        $requestFile = $d->requestDocuments->first();
        $uploader = DisplayName::of($d->uploadedBy)
            ?? ($requestFile?->recordRequest ? $requestFile->recordRequest->client_full_name.' (requester)' : 'Unknown');

        return [
            'id' => $d->document_id,
            'name' => $d->file_name,
            'file_type' => $this->shortType($d),
            'size_kb' => max(1, (int) round($d->file_size / 1024)),
            'uploaded_by' => $uploader,
            'uploaded_at' => $d->uploaded_at?->toIso8601String(),
            'link' => $this->describe($d),
            // Request uploads stay with their request.
            'movable' => $requestFile === null,
        ];
    }

    /**
     * @return array{kind: string, target_id: string|null, label: string|null, title: string, detail: string|null, type?: string}
     */
    private function describe(Document $d): array
    {
        $requestFile = $d->requestDocuments->first();
        if ($requestFile?->recordRequest) {
            $r = $requestFile->recordRequest;

            return [
                'kind' => 'request', 'target_id' => $r->request_id, 'label' => $requestFile->title ?? $requestFile->document_label->value,
                'title' => "Request {$r->request_number}", 'detail' => ($requestFile->title ?? $requestFile->document_label->value).' · '.RecordRequests::subject($r),
            ];
        }
        if ($d->record) {
            $r = $d->record;

            return [
                'kind' => 'register', 'target_id' => $r->record_id, 'label' => self::REGISTER_SCAN, 'type' => $r->sacramentType?->name,
                'title' => "{$r->sacramentType?->name} register", 'detail' => "{$this->subject($r)} · book {$r->book_number}, page {$r->page_number}",
            ];
        }
        if ($d->parishioner) {
            return [
                'kind' => 'parishioner', 'target_id' => $d->parishioner->parishioner_id, 'label' => $d->label ?? DocumentLabel::Other->value,
                'title' => $this->nameOf($d->parishioner), 'detail' => $d->label ?? DocumentLabel::Other->value,
            ];
        }

        return ['kind' => 'none', 'target_id' => null, 'label' => null, 'title' => 'Not linked yet', 'detail' => null];
    }

    private function subject(SacramentalRecord $r): string
    {
        return $this->register->subjectOf($r);
    }

    private function shortType(Document $d): string
    {
        $ext = strtolower(pathinfo($d->file_name, PATHINFO_EXTENSION));

        return match (true) {
            str_contains($d->file_type, 'pdf') || $ext === 'pdf' => 'PDF',
            str_contains($d->file_type, 'png') || $ext === 'png' => 'PNG',
            default => 'JPG',
        };
    }

    private function nameOf(Parishioner $p): string
    {
        return implode(' ', array_filter([$p->first_name, $p->last_name, $p->suffix]));
    }
}

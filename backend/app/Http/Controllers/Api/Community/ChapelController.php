<?php

namespace App\Http\Controllers\Api\Community;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Controller;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\Sona;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Chapels & Officers for GKK and PYA-KKK Officers: the chapel directory and
 * each chapel's officers per term. New chapels and officers wait for a PPC
 * Officer's approval; edits to approved ones apply right away. Officers can
 * only be added to an approved chapel.
 */
class ChapelController extends Controller
{
    private const CHAPEL_NOT_APPROVED = 'Officers can be added once the PPC approves this chapel.';

    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/community/chapels',
        summary: 'Every Sona, chapel (active or not), and chapel officer',
        description: 'One parish is small enough to load whole; the page filters it.',
        tags: ['Community'],
        responses: [new OA\Response(response: 200, description: 'sonas, chapels, and officers')],
    )]
    public function index(): JsonResponse
    {
        return response()->json([
            'sonas' => Sona::query()->orderBy('name')->get(['sona_id', 'name']),
            'chapels' => Chapel::query()->orderBy('name')->get()->map($this->presentChapel(...)),
            'officers' => ChapelOfficer::query()->orderByDesc('term_year')->orderBy('name')->get()->map($this->presentOfficer(...)),
        ]);
    }

    #[OA\Post(path: '/api/community/chapels', summary: 'Add a chapel; it waits for PPC approval', tags: ['Community'], responses: [new OA\Response(response: 201, description: 'Added as Pending'), new OA\Response(response: 422, description: 'Invalid, or the Sona already has a chapel by that name')])]
    public function store(Request $request): JsonResponse
    {
        $chapel = Chapel::create([...$this->chapelData($request), ...$this->submitted($request)]);
        $this->audit->log('CHAPEL_CREATED', 'chapels', (string) $chapel->chapel_id, $request->user(), ['name' => $chapel->name]);

        return response()->json(['data' => $this->presentChapel($chapel)], 201);
    }

    #[OA\Patch(path: '/api/community/chapels/{chapel}', summary: 'Edit a chapel, including marking it inactive; editing a rejected one sends it back to the PPC', tags: ['Community'], responses: [new OA\Response(response: 200, description: 'Saved')])]
    public function update(Request $request, Chapel $chapel): JsonResponse
    {
        $chapel->fill($this->chapelData($request, $chapel));
        $this->resubmitIfRejected($chapel, $request);
        $changes = $this->changes($chapel);
        $chapel->save();
        if ($changes) {
            $this->audit->log('CHAPEL_UPDATED', 'chapels', (string) $chapel->chapel_id, $request->user(), ['name' => $chapel->name, 'changes' => $changes]);
        }

        return response()->json(['data' => $this->presentChapel($chapel)]);
    }

    #[OA\Delete(path: '/api/community/chapels/{chapel}', summary: 'Delete a chapel the PPC has not approved', tags: ['Community'], responses: [new OA\Response(response: 204, description: 'Deleted'), new OA\Response(response: 409, description: 'Approved chapels stay; mark them inactive instead')])]
    public function destroy(Request $request, Chapel $chapel): JsonResponse
    {
        if ($chapel->approval_status === ApprovalStatus::Approved) {
            return response()->json(['message' => 'Approved chapels stay in the directory. Mark it inactive instead.'], 409);
        }
        $chapel->delete();
        $this->audit->log('CHAPEL_DELETED', 'chapels', (string) $chapel->chapel_id, $request->user(), ['name' => $chapel->name, 'status' => $chapel->approval_status->value]);

        return response()->json(null, 204);
    }

    #[OA\Post(path: '/api/community/officers', summary: 'Add an officer to an approved chapel for a term; it waits for PPC approval', tags: ['Community'], responses: [new OA\Response(response: 201, description: 'Added as Pending'), new OA\Response(response: 422, description: 'Invalid, or the chapel is not approved yet')])]
    public function storeOfficer(Request $request): JsonResponse
    {
        $officer = ChapelOfficer::create([...$this->officerData($request), ...$this->submitted($request)]);
        $this->audit->log('OFFICER_ADDED', 'chapel_officers', $officer->officer_id, $request->user(), $this->officerSummary($officer));

        return response()->json(['data' => $this->presentOfficer($officer)], 201);
    }

    #[OA\Patch(path: '/api/community/officers/{officer}', summary: 'Edit an officer; editing a rejected one sends it back to the PPC', tags: ['Community'], responses: [new OA\Response(response: 200, description: 'Saved')])]
    public function updateOfficer(Request $request, ChapelOfficer $officer): JsonResponse
    {
        $officer->fill($this->officerData($request));
        $this->resubmitIfRejected($officer, $request);
        $changes = $this->changes($officer);
        $officer->save();
        if ($changes) {
            $this->audit->log('OFFICER_UPDATED', 'chapel_officers', $officer->officer_id, $request->user(), [...$this->officerSummary($officer), 'changes' => $changes]);
        }

        return response()->json(['data' => $this->presentOfficer($officer)]);
    }

    #[OA\Delete(path: '/api/community/officers/{officer}', summary: 'Remove an officer from a term’s list; they come off any events too', tags: ['Community'], responses: [new OA\Response(response: 204, description: 'Removed')])]
    public function destroyOfficer(Request $request, ChapelOfficer $officer): JsonResponse
    {
        $summary = $this->officerSummary($officer);
        $officer->delete();
        $this->deletePhotos([$officer->photo_path]);
        $this->audit->log('OFFICER_REMOVED', 'chapel_officers', $officer->officer_id, $request->user(), $summary);

        return response()->json(null, 204);
    }

    #[OA\Post(
        path: '/api/community/officers/{officer}/photo',
        summary: 'Upload or replace an officer’s profile picture (JPG, PNG, or WebP up to 2 MB)',
        tags: ['Community'],
        responses: [new OA\Response(response: 200, description: 'The updated officer'), new OA\Response(response: 422, description: 'Not an image, or too large')],
    )]
    public function storeOfficerPhoto(Request $request, ChapelOfficer $officer): JsonResponse
    {
        $old = $officer->photo_path;
        $officer->forceFill(['photo_path' => ProfileController::storeUploadedPhoto($request)])->save();
        $this->deletePhotos([$old]);
        $this->audit->log('OFFICER_PHOTO_UPDATED', 'chapel_officers', $officer->officer_id, $request->user(), $this->officerSummary($officer));

        return response()->json(['data' => $this->presentOfficer($officer)]);
    }

    #[OA\Delete(path: '/api/community/officers/{officer}/photo', summary: 'Remove an officer’s profile picture', tags: ['Community'], responses: [new OA\Response(response: 200, description: 'The updated officer')])]
    public function destroyOfficerPhoto(Request $request, ChapelOfficer $officer): JsonResponse
    {
        if ($officer->photo_path) {
            $this->deletePhotos([$officer->photo_path]);
            $officer->forceFill(['photo_path' => null])->save();
            $this->audit->log('OFFICER_PHOTO_REMOVED', 'chapel_officers', $officer->officer_id, $request->user(), $this->officerSummary($officer));
        }

        return response()->json(['data' => $this->presentOfficer($officer)]);
    }

    #[OA\Post(
        path: '/api/community/chapels/{chapel}/officers/import',
        summary: 'Add a checked officer list to an approved chapel for a term; the officers wait for PPC approval',
        description: 'The page reads the spreadsheet and sends the rows. With replace, the term’s current officers are removed first.',
        tags: ['Community'],
        responses: [new OA\Response(response: 200, description: 'The chapel’s officers for that term'), new OA\Response(response: 422, description: 'A row is invalid, or the chapel is not approved yet; nothing is saved')],
    )]
    public function importOfficers(Request $request, Chapel $chapel): JsonResponse
    {
        if ($chapel->approval_status !== ApprovalStatus::Approved) {
            throw ValidationException::withMessages(['chapel_id' => self::CHAPEL_NOT_APPROVED]);
        }

        $data = $request->validate([
            'term_year' => ['required', 'integer', 'digits:4'],
            'replace' => ['boolean'],
            'officers' => ['required', 'array', 'min:1', 'max:200'],
            ...collect($this->officerFieldRules())->mapWithKeys(fn ($rules, $field) => ["officers.*.{$field}" => $rules])->all(),
        ]);

        $replaced = DB::transaction(function () use ($chapel, $data, $request) {
            $replaced = 0;
            if ($data['replace'] ?? false) {
                $old = $chapel->officers()->where('term_year', $data['term_year']);
                $this->deletePhotos($old->clone()->pluck('photo_path')->all());
                $replaced = $old->delete();
            }
            foreach ($data['officers'] as $row) {
                $chapel->officers()->create([...$this->blankToNull($row), 'term_year' => $data['term_year'], ...$this->submitted($request)]);
            }

            return $replaced;
        });

        $this->audit->log('OFFICERS_IMPORTED', 'chapels', (string) $chapel->chapel_id, $request->user(), [
            'chapel' => $chapel->name,
            'term_year' => $data['term_year'],
            'imported' => count($data['officers']),
            'replaced' => $replaced,
        ]);

        $officers = $chapel->officers()->where('term_year', $data['term_year'])->orderBy('name')->get();

        return response()->json(['data' => $officers->map($this->presentOfficer(...))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function chapelData(Request $request, ?Chapel $chapel = null): array
    {
        $data = $request->validate([
            'sona_id' => ['required', 'integer', Rule::exists('sonas', 'sona_id')],
            'name' => [
                'required', 'string', 'max:100',
                Rule::unique('chapels')->where('sona_id', $request->integer('sona_id'))->ignore($chapel?->chapel_id, 'chapel_id'),
            ],
            'patron' => ['nullable', 'string', 'max:100'],
            'fiesta_date' => ['nullable', 'string', 'max:50'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'fb_account_name' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ], ['name.unique' => 'This Sona already has a chapel with that name.']);

        return $this->blankToNull($data);
    }

    /**
     * @return array<string, mixed>
     */
    private function officerData(Request $request): array
    {
        $data = $request->validate([
            'chapel_id' => ['required', 'integer', Rule::exists('chapels', 'chapel_id')->where('approval_status', ApprovalStatus::Approved->value)],
            'term_year' => ['required', 'integer', 'digits:4'],
            ...$this->officerFieldRules(),
        ], ['chapel_id.exists' => self::CHAPEL_NOT_APPROVED]);

        return $this->blankToNull($data);
    }

    /**
     * New work from a GKK or PYA-KKK Officer starts as Pending.
     *
     * @return array<string, mixed>
     */
    private function submitted(Request $request): array
    {
        return ['approval_status' => ApprovalStatus::Pending, 'created_by_user_id' => $request->user()->user_id];
    }

    /** Editing something the PPC rejected sends it back for another look. */
    private function resubmitIfRejected(Chapel|ChapelOfficer $model, Request $request): void
    {
        if ($model->approval_status === ApprovalStatus::Rejected) {
            $model->forceFill([
                'approval_status' => ApprovalStatus::Pending,
                'created_by_user_id' => $request->user()->user_id,
                'reviewed_by_user_id' => null,
                'reviewed_at' => null,
                'review_note' => null,
            ]);
        }
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function officerFieldRules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'position' => ['required', 'string', 'max:100'],
            'ministry' => ['nullable', 'string', 'max:100'],
            'age' => ['nullable', 'integer', 'min:0', 'max:130'],
            'fb_account' => ['nullable', 'string', 'max:100'],
            'contact_number' => ['nullable', 'string', 'max:20'],
        ];
    }

    /**
     * Trims text and stores empty optional fields as NULL, as the nullable columns expect.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function blankToNull(array $data): array
    {
        return array_map(fn ($v) => is_string($v) ? (trim($v) === '' ? null : trim($v)) : $v, $data);
    }

    /**
     * @return array<string, array{0: mixed, 1: mixed}>
     */
    private function changes(Chapel|ChapelOfficer $model): array
    {
        $plain = fn ($v) => $v instanceof \BackedEnum ? $v->value : $v;

        return collect($model->getDirty())->mapWithKeys(fn ($new, $field) => [$field => [$plain($model->getOriginal($field)), $plain($new)]])->all();
    }

    /**
     * Removes officer pictures from the local disk, skipping officers without one.
     *
     * @param  list<string|null>  $paths
     */
    private function deletePhotos(array $paths): void
    {
        $paths = array_values(array_filter($paths));
        if ($paths) {
            Storage::disk('local')->delete($paths);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function officerSummary(ChapelOfficer $o): array
    {
        return ['name' => $o->name, 'position' => $o->position, 'chapel_id' => $o->chapel_id, 'term_year' => $o->term_year];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentChapel(Chapel $c): array
    {
        return [
            'chapel_id' => $c->chapel_id,
            'sona_id' => $c->sona_id,
            'name' => $c->name,
            'patron' => $c->patron,
            'fiesta_date' => $c->fiesta_date,
            'contact_number' => $c->contact_number,
            'fb_account_name' => $c->fb_account_name,
            'is_active' => $c->is_active,
            'approval_status' => $c->approval_status->value,
            'review_note' => $c->review_note,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentOfficer(ChapelOfficer $o): array
    {
        return [
            'officer_id' => $o->officer_id,
            'chapel_id' => $o->chapel_id,
            'name' => $o->name,
            'position' => $o->position,
            'ministry' => $o->ministry,
            'age' => $o->age,
            'fb_account' => $o->fb_account,
            'contact_number' => $o->contact_number,
            'photo_url' => $o->photoUrl(),
            'term_year' => $o->term_year,
            'approval_status' => $o->approval_status->value,
            'review_note' => $o->review_note,
        ];
    }
}

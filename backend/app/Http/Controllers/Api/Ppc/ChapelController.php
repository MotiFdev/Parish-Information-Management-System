<?php

namespace App\Http\Controllers\Api\Ppc;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Services\Approvals;
use App\Services\AuditLogger;
use App\Support\DisplayName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * The PPC portal: approve or reject the chapels and chapel officers that GKK
 * and PYA-KKK Officers add.
 */
class ChapelController extends Controller
{
    public function __construct(private AuditLogger $audit, private Approvals $approvals) {}

    #[OA\Get(
        path: '/api/ppc/chapels',
        summary: 'Chapels and officers added by GKK and PYA-KKK Officers, by approval status',
        tags: ['PPC'],
        parameters: [new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['Pending', 'Approved', 'Rejected']))],
        responses: [new OA\Response(response: 200, description: 'chapels and officers with that status (Pending by default)')],
    )]
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(ApprovalStatus::class)]])['status'] ?? ApprovalStatus::Pending->value;

        $chapels = Chapel::query()->with(['sona', 'createdBy.role', 'reviewedBy.role'])
            ->where('approval_status', $status)->orderBy('name')->get();
        $officers = ChapelOfficer::query()->with(['chapel.sona', 'createdBy.role', 'reviewedBy.role'])
            ->where('approval_status', $status)->orderBy('chapel_id')->orderByDesc('term_year')->orderBy('name')->get();

        return response()->json([
            'chapels' => $chapels->map($this->presentChapel(...)),
            'officers' => $officers->map($this->presentOfficer(...)),
        ]);
    }

    #[OA\Post(path: '/api/ppc/chapels/{chapel}/approve', summary: 'Approve a Pending chapel', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Approved'), new OA\Response(response: 409, description: 'Already decided')])]
    public function approveChapel(Request $request, Chapel $chapel): JsonResponse
    {
        return $this->decideChapel($request, $chapel, ApprovalStatus::Approved, null);
    }

    #[OA\Post(path: '/api/ppc/chapels/{chapel}/reject', summary: 'Reject a Pending chapel with a reason', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 409, description: 'Already decided'), new OA\Response(response: 422, description: 'No reason given')])]
    public function rejectChapel(Request $request, Chapel $chapel): JsonResponse
    {
        $reason = $request->validate(Approvals::reasonRules(), Approvals::reasonMessages())['reason'];

        return $this->decideChapel($request, $chapel, ApprovalStatus::Rejected, trim($reason));
    }

    #[OA\Post(
        path: '/api/ppc/officers/approve',
        summary: 'Approve one or more Pending officers',
        description: 'Officers already decided are skipped and listed in skipped.',
        tags: ['PPC'],
        responses: [new OA\Response(response: 200, description: 'approved and skipped officer ids')],
    )]
    public function approveOfficers(Request $request): JsonResponse
    {
        $ids = $request->validate([
            'officer_ids' => ['required', 'array', 'min:1', 'max:500'],
            'officer_ids.*' => ['uuid', 'distinct'],
        ])['officer_ids'];

        $approved = [];
        $skipped = [];
        foreach (ChapelOfficer::query()->whereIn('officer_id', $ids)->get() as $officer) {
            $decided = $this->approvals->decide($officer, 'approval_status', ApprovalStatus::Approved, null, $request->user());
            if ($decided) {
                $approved[] = $decided->officer_id;
                $this->audit->log('OFFICER_APPROVED', 'chapel_officers', $decided->officer_id, $request->user(), $this->officerSummary($decided));
            } else {
                $skipped[] = $officer->officer_id;
            }
        }

        return response()->json(['approved' => $approved, 'skipped' => [...$skipped, ...array_values(array_diff($ids, $approved, $skipped))]]);
    }

    #[OA\Post(path: '/api/ppc/officers/{officer}/reject', summary: 'Reject a Pending officer with a reason', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 409, description: 'Already decided'), new OA\Response(response: 422, description: 'No reason given')])]
    public function rejectOfficer(Request $request, ChapelOfficer $officer): JsonResponse
    {
        $reason = trim($request->validate(Approvals::reasonRules(), Approvals::reasonMessages())['reason']);

        $decided = $this->approvals->decide($officer, 'approval_status', ApprovalStatus::Rejected, $reason, $request->user());
        if (! $decided) {
            return response()->json(['message' => 'This officer was already decided. Reload to see where it stands.'], 409);
        }
        $this->audit->log('OFFICER_REJECTED', 'chapel_officers', $decided->officer_id, $request->user(), [...$this->officerSummary($decided), 'reason' => $reason]);

        return response()->json(['data' => $this->presentOfficer($decided->load(['chapel.sona', 'createdBy.role', 'reviewedBy.role']))]);
    }

    private function decideChapel(Request $request, Chapel $chapel, ApprovalStatus $decision, ?string $reason): JsonResponse
    {
        $decided = $this->approvals->decide($chapel, 'approval_status', $decision, $reason, $request->user());
        if (! $decided) {
            return response()->json(['message' => 'This chapel was already decided. Reload to see where it stands.'], 409);
        }
        $this->audit->log($decision === ApprovalStatus::Approved ? 'CHAPEL_APPROVED' : 'CHAPEL_REJECTED', 'chapels', (string) $decided->chapel_id, $request->user(), [
            'name' => $decided->name,
            'reason' => $reason,
        ]);

        return response()->json(['data' => $this->presentChapel($decided->load(['sona', 'createdBy.role', 'reviewedBy.role']))]);
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
            'name' => $c->name,
            'sona_name' => $c->sona?->name,
            'patron' => $c->patron,
            'fiesta_date' => $c->fiesta_date,
            'contact_number' => $c->contact_number,
            'fb_account_name' => $c->fb_account_name,
            'approval_status' => $c->approval_status->value,
            'created_by' => DisplayName::of($c->createdBy),
            'reviewed_by' => DisplayName::of($c->reviewedBy),
            'reviewed_at' => $c->reviewed_at?->toIso8601String(),
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
            'chapel_name' => $o->chapel?->name,
            'sona_name' => $o->chapel?->sona?->name,
            'name' => $o->name,
            'position' => $o->position,
            'ministry' => $o->ministry,
            'age' => $o->age,
            'contact_number' => $o->contact_number,
            'fb_account' => $o->fb_account,
            'photo_url' => $o->photoUrl(),
            'term_year' => $o->term_year,
            'approval_status' => $o->approval_status->value,
            'created_by' => DisplayName::of($o->createdBy),
            'reviewed_by' => DisplayName::of($o->reviewedBy),
            'reviewed_at' => $o->reviewed_at?->toIso8601String(),
            'review_note' => $o->review_note,
        ];
    }
}

<?php

namespace App\Http\Controllers\Api\Ppc;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use App\Services\Approvals;
use App\Services\AuditLogger;
use App\Services\CommunityEvents;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * The PPC portal: approve or reject the events GKK and PYA-KKK Officers set up.
 */
class EventController extends Controller
{
    public function __construct(private AuditLogger $audit, private CommunityEvents $events, private Approvals $approvals) {}

    #[OA\Get(
        path: '/api/ppc/events',
        summary: 'GKK and PYA-KKK events; Pending ones first, oldest request first',
        tags: ['PPC'],
        parameters: [new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['Pending', 'Approved', 'Rejected']))],
        responses: [new OA\Response(response: 200, description: 'Events')],
    )]
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(ApprovalStatus::class)]])['status'] ?? null;

        $rows = CommunityEvent::query()
            ->with(CommunityEvents::WITH)
            ->when($status, fn ($q, $s) => $q->where('status', $s))
            ->orderByRaw("status <> 'Pending'")
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $rows->map(fn ($e) => $this->events->present($e))]);
    }

    #[OA\Post(path: '/api/ppc/events/{event}/approve', summary: 'Approve a Pending event', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Approved'), new OA\Response(response: 409, description: 'Already decided')])]
    public function approve(Request $request, CommunityEvent $event): JsonResponse
    {
        return $this->decide($request, $event, ApprovalStatus::Approved, null);
    }

    #[OA\Post(path: '/api/ppc/events/{event}/reject', summary: 'Reject a Pending event with a reason the organizers can read', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 409, description: 'Already decided'), new OA\Response(response: 422, description: 'No reason given')])]
    public function reject(Request $request, CommunityEvent $event): JsonResponse
    {
        $reason = $request->validate(Approvals::reasonRules(), Approvals::reasonMessages())['reason'];

        return $this->decide($request, $event, ApprovalStatus::Rejected, trim($reason));
    }

    private function decide(Request $request, CommunityEvent $event, ApprovalStatus $decision, ?string $reason): JsonResponse
    {
        $decided = $this->approvals->decide($event, 'status', $decision, $reason, $request->user());

        if (! $decided) {
            return response()->json(['message' => 'This event was already decided. Reload to see where it stands.'], 409);
        }

        $this->audit->log($decision === ApprovalStatus::Approved ? 'EVENT_APPROVED' : 'EVENT_REJECTED', 'community_events', $decided->event_id, $request->user(), [
            'name' => $decided->name,
            'event_date' => $decided->event_date->toDateString(),
            'start_time' => substr((string) $decided->start_time, 0, 5),
            'reason' => $reason,
        ]);

        return response()->json(['data' => $this->events->present($decided)]);
    }
}

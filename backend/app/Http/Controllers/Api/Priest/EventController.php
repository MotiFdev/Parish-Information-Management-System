<?php

namespace App\Http\Controllers\Api\Priest;

use App\Enums\EventStatus;
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
 * Event Approvals in the priest portal: the final approval or rejection of
 * GKK and PYA-KKK events the PPC pre-approved. Only approved events reach the
 * public home page.
 */
class EventController extends Controller
{
    public function __construct(private AuditLogger $audit, private CommunityEvents $events) {}

    #[OA\Get(
        path: '/api/priest/events',
        summary: 'GKK and PYA-KKK events; Pre-Approved ones first, soonest first',
        tags: ['Priest'],
        parameters: [new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['Pending', 'Pre-Approved', 'Approved', 'Rejected']))],
        responses: [new OA\Response(response: 200, description: 'Events')],
    )]
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(EventStatus::class)]])['status'] ?? null;

        $rows = CommunityEvent::query()
            ->with(CommunityEvents::WITH)
            ->when($status, fn ($q, $s) => $q->where('status', $s))
            ->orderByRaw("status <> 'Pre-Approved'")
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $rows->map(fn ($e) => $this->events->present($e))]);
    }

    #[OA\Post(path: '/api/priest/events/{event}/approve', summary: 'Give the final approval to a Pre-Approved event; it then shows on the public home page', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Approved'), new OA\Response(response: 409, description: 'Not waiting for the priest')])]
    public function approve(Request $request, CommunityEvent $event): JsonResponse
    {
        return $this->decide($request, $event, EventStatus::Approved, null);
    }

    #[OA\Post(path: '/api/priest/events/{event}/reject', summary: 'Reject a Pre-Approved event with a reason the organizers and PPC can read', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 409, description: 'Not waiting for the priest'), new OA\Response(response: 422, description: 'No reason given')])]
    public function reject(Request $request, CommunityEvent $event): JsonResponse
    {
        $reason = $request->validate(Approvals::reasonRules(), Approvals::reasonMessages())['reason'];

        return $this->decide($request, $event, EventStatus::Rejected, trim($reason));
    }

    private function decide(Request $request, CommunityEvent $event, EventStatus $decision, ?string $reason): JsonResponse
    {
        $decided = $this->events->decide($event, EventStatus::PreApproved, $decision, $request->user(), $reason);

        if (! $decided) {
            return response()->json(['message' => 'This event is no longer waiting for your approval. Reload to see where it stands.'], 409);
        }

        $this->audit->log($decision === EventStatus::Approved ? 'EVENT_APPROVED' : 'EVENT_REJECTED_BY_PRIEST', 'community_events', $decided->event_id, $request->user(), [
            'name' => $decided->name,
            'event_date' => $decided->event_date->toDateString(),
            'start_time' => substr((string) $decided->start_time, 0, 5),
            'reason' => $reason,
        ]);

        return response()->json(['data' => $this->events->present($decided)]);
    }
}

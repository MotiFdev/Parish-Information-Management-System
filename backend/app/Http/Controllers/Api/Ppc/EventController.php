<?php

namespace App\Http\Controllers\Api\Ppc;

use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use App\Services\Approvals;
use App\Services\AuditLogger;
use App\Services\CommunityEvents;
use App\Services\OfficeNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * The PPC portal: pre-approve or reject the events GKK and PYA-KKK Officers
 * set up. Pre-approved events go to the parish priest for the final decision.
 */
class EventController extends Controller
{
    public function __construct(private AuditLogger $audit, private CommunityEvents $events, private OfficeNotifier $notifier) {}

    #[OA\Get(
        path: '/api/ppc/events',
        summary: 'GKK and PYA-KKK events; Pending ones first, soonest first',
        tags: ['PPC'],
        parameters: [new OA\Parameter(name: 'status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['Pending', 'Pre-Approved', 'Approved', 'Rejected']))],
        responses: [new OA\Response(response: 200, description: 'Events')],
    )]
    public function index(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(EventStatus::class)]])['status'] ?? null;

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

    #[OA\Post(path: '/api/ppc/events/{event}/pre-approve', summary: 'Pre-approve a Pending event and send it to the parish priest', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Pre-Approved'), new OA\Response(response: 409, description: 'Already decided')])]
    public function preApprove(Request $request, CommunityEvent $event): JsonResponse
    {
        $decided = $this->events->decide($event, EventStatus::Pending, EventStatus::PreApproved, $request->user());

        if (! $decided) {
            return $this->alreadyDecided();
        }

        $this->audit->log('EVENT_PREAPPROVED', 'community_events', $decided->event_id, $request->user(), $this->summary($decided));
        $this->notifier->eventAwaitingPriest($decided);

        return response()->json(['data' => $this->events->present($decided)]);
    }

    #[OA\Post(path: '/api/ppc/events/{event}/reject', summary: 'Reject a Pending event with a reason the organizers can read', tags: ['PPC'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 409, description: 'Already decided'), new OA\Response(response: 422, description: 'No reason given')])]
    public function reject(Request $request, CommunityEvent $event): JsonResponse
    {
        $reason = trim($request->validate(Approvals::reasonRules(), Approvals::reasonMessages())['reason']);
        $decided = $this->events->decide($event, EventStatus::Pending, EventStatus::Rejected, $request->user(), $reason);

        if (! $decided) {
            return $this->alreadyDecided();
        }

        $this->audit->log('EVENT_REJECTED', 'community_events', $decided->event_id, $request->user(), [...$this->summary($decided), 'reason' => $reason]);

        return response()->json(['data' => $this->events->present($decided)]);
    }

    private function alreadyDecided(): JsonResponse
    {
        return response()->json(['message' => 'This event was already decided. Reload to see where it stands.'], 409);
    }

    /**
     * @return array{name: string, event_date: string, start_time: string}
     */
    private function summary(CommunityEvent $event): array
    {
        return ['name' => $event->name, 'event_date' => $event->event_date->toDateString(), 'start_time' => substr((string) $event->start_time, 0, 5)];
    }
}

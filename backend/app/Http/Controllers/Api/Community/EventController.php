<?php

namespace App\Http\Controllers\Api\Community;

use App\Enums\ApprovalStatus;
use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use App\Services\AuditLogger;
use App\Services\CommunityEvents;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Events that GKK and PYA-KKK Officers set up: a name, purpose, venue, and date, with
 * chapel officers assigned. New and edited events wait for a PPC Officer to
 * pre-approve them, then for the parish priest's final approval.
 */
class EventController extends Controller
{
    public function __construct(private AuditLogger $audit, private CommunityEvents $events) {}

    #[OA\Get(path: '/api/community/events', summary: 'All GKK and PYA-KKK events, soonest first', tags: ['Community'], responses: [new OA\Response(response: 200, description: 'Events with their officers, status, and approval history')])]
    public function index(): JsonResponse
    {
        $rows = CommunityEvent::query()->with(CommunityEvents::WITH)->orderBy('event_date')->orderBy('start_time')->orderBy('name')->get();

        return response()->json(['data' => $rows->map(fn ($e) => $this->events->present($e))]);
    }

    #[OA\Post(path: '/api/community/events', summary: 'Set up an event (name, purpose, venue, date, start time, officers); it waits for PPC pre-approval', tags: ['Community'], responses: [new OA\Response(response: 201, description: 'Created as Pending'), new OA\Response(response: 422, description: 'Invalid input')])]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $event = DB::transaction(function () use ($data, $request) {
            $event = CommunityEvent::create([
                'name' => $data['name'],
                'purpose' => $data['purpose'],
                'venue' => $data['venue'],
                'event_date' => $data['event_date'],
                'start_time' => $data['start_time'],
                'status' => EventStatus::Pending,
                'created_by_user_id' => $request->user()->user_id,
            ]);
            $event->officers()->sync($data['officer_ids']);
            $this->events->record($event, 'Submitted', $request->user());

            return $event;
        });

        $this->audit->log('EVENT_CREATED', 'community_events', $event->event_id, $request->user(), [
            'name' => $event->name, 'event_date' => $data['event_date'], 'start_time' => $data['start_time'], 'officers' => count($data['officer_ids']),
        ]);

        return response()->json(['data' => $this->events->present($event)], 201);
    }

    #[OA\Patch(
        path: '/api/community/events/{event}',
        summary: 'Edit an event',
        description: 'Any change sends it back to the PPC as Pending, even if it was pre-approved, approved, or rejected.',
        tags: ['Community'],
        responses: [new OA\Response(response: 200, description: 'Saved and Pending again')],
    )]
    public function update(Request $request, CommunityEvent $event): JsonResponse
    {
        $data = $this->validated($request);
        $before = ['status' => $event->status->value, 'name' => $event->name, 'purpose' => $event->purpose, 'venue' => $event->venue, 'event_date' => $event->event_date->toDateString(), 'start_time' => substr((string) $event->start_time, 0, 5)];

        $changes = array_keys(array_filter([
            'name' => $data['name'] !== $before['name'],
            'purpose' => $data['purpose'] !== $before['purpose'],
            'venue' => $data['venue'] !== $before['venue'],
            'event_date' => $data['event_date'] !== $before['event_date'],
            'start_time' => $data['start_time'] !== $before['start_time'],
            'officers' => collect($data['officer_ids'])->sort()->values()->all() !== $event->officers()->pluck('chapel_officers.officer_id')->sort()->values()->all(),
        ]));

        DB::transaction(function () use ($event, $data, $request, $changes) {
            $event->forceFill([
                'name' => $data['name'],
                'purpose' => $data['purpose'],
                'venue' => $data['venue'],
                'event_date' => $data['event_date'],
                'start_time' => $data['start_time'],
                'status' => EventStatus::Pending,
                'preapproved_by_user_id' => null,
                'preapproved_at' => null,
                'reviewed_by_user_id' => null,
                'reviewed_at' => null,
                'review_note' => null,
            ])->save();
            $event->officers()->sync($data['officer_ids']);
            $this->events->record($event, 'Resubmitted', $request->user(), null, $changes);
        });

        $this->audit->log('EVENT_UPDATED', 'community_events', $event->event_id, $request->user(), [
            'before' => $before, 'name' => $event->name, 'event_date' => $data['event_date'], 'start_time' => $data['start_time'], 'officers' => count($data['officer_ids']),
        ]);

        return response()->json(['data' => $this->events->present($event->fresh())]);
    }

    #[OA\Delete(path: '/api/community/events/{event}', summary: 'Delete an event', tags: ['Community'], responses: [new OA\Response(response: 204, description: 'Deleted')])]
    public function destroy(Request $request, CommunityEvent $event): JsonResponse
    {
        $event->delete();
        $this->audit->log('EVENT_DELETED', 'community_events', $event->event_id, $request->user(), [
            'name' => $event->name, 'event_date' => $event->event_date->toDateString(), 'status' => $event->status->value,
        ]);

        return response()->json(null, 204);
    }

    /**
     * @return array{name: string, purpose: string, venue: string, event_date: string, start_time: string, officer_ids: list<string>}
     */
    private function validated(Request $request): array
    {
        $request->merge(array_map(fn ($v) => is_string($v) ? trim($v) : $v, $request->only(['name', 'purpose', 'venue'])));

        return $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'purpose' => ['required', 'string', 'max:1000'],
            'venue' => ['required', 'string', 'max:200'],
            'event_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.now((string) config('app.parish_timezone', 'Asia/Manila'))->toDateString()],
            'start_time' => ['required', 'date_format:H:i'],
            'officer_ids' => ['required', 'array', 'min:1'],
            'officer_ids.*' => ['uuid', 'distinct', Rule::exists('chapel_officers', 'officer_id')->where('approval_status', ApprovalStatus::Approved->value)],
        ], [
            'purpose.required' => 'Say what the event is for.',
            'event_date.after_or_equal' => 'Choose today or a later date.',
            'start_time.required' => 'Choose the time it starts.',
            'start_time.date_format' => 'Enter the time like 14:30.',
            'officer_ids.required' => 'Assign at least one officer.',
            'officer_ids.min' => 'Assign at least one officer.',
            'officer_ids.*.exists' => 'One of the chosen officers is not approved by the PPC or is no longer on the list. Reload and choose again.',
        ]);
    }
}

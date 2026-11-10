<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\CommunityEvent;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

/**
 * Upcoming GKK and PYA-KKK events for the public home page. Only events a PPC
 * Officer approved are shown; pending and rejected ones never leave the portals.
 */
class EventController extends Controller
{
    /** Enough for the home page; older events drop off as their date passes. */
    private const LIMIT = 30;

    #[OA\Get(
        path: '/api/public/events',
        summary: 'Approved GKK and PYA-KKK events from today on, soonest first',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'Events: name, venue, date, start time')],
    )]
    public function index(): JsonResponse
    {
        $today = now((string) config('app.parish_timezone', 'Asia/Manila'))->toDateString();

        $events = CommunityEvent::query()
            ->where('status', ApprovalStatus::Approved->value)
            ->whereDate('event_date', '>=', $today)
            ->orderBy('event_date')
            ->orderBy('start_time')
            ->orderBy('name')
            ->limit(self::LIMIT)
            ->get(['event_id', 'name', 'venue', 'event_date', 'start_time']);

        return response()->json(['data' => $events->map(fn (CommunityEvent $e) => [
            'event_id' => $e->event_id,
            'name' => $e->name,
            'venue' => $e->venue,
            'event_date' => $e->event_date->toDateString(),
            'start_time' => substr((string) $e->start_time, 0, 5),
        ])]);
    }
}

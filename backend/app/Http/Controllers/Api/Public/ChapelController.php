<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\Sona;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

/**
 * The public Chapels & Officers page: every active, PPC-approved chapel and
 * its approved council for the current term. Officers' ages, Facebook names,
 * and personal numbers stay in the portals; only the president's number is
 * shown, because chapel Masses and intentions are arranged through them.
 */
class ChapelController extends Controller
{
    #[OA\Get(
        path: '/api/public/chapels',
        summary: 'Active chapels with their current-term officers',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'term, sonas, chapels, and officers')],
    )]
    public function index(): JsonResponse
    {
        // Terms follow the calendar year in the parish's time zone.
        $term = (int) now((string) config('app.parish_timezone', 'Asia/Manila'))->format('Y');

        $chapels = Chapel::query()
            ->approved()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['chapel_id', 'sona_id', 'name', 'patron', 'fiesta_date', 'contact_number', 'fb_account_name']);

        $officers = ChapelOfficer::query()
            ->whereIn('chapel_id', $chapels->pluck('chapel_id'))
            ->where('term_year', $term)
            ->where('approval_status', ApprovalStatus::Approved->value)
            ->orderBy('name')
            ->get(['officer_id', 'chapel_id', 'name', 'position', 'ministry', 'contact_number', 'photo_path']);

        return response()->json(['data' => [
            'term' => $term,
            'sonas' => Sona::query()
                ->whereIn('sona_id', $chapels->pluck('sona_id'))
                // The order the parish lists its Sonas in, which is the order they were added.
                ->orderBy('sona_id')
                ->get(['sona_id', 'name']),
            'chapels' => $chapels->map(fn (Chapel $c) => [
                'chapel_id' => $c->chapel_id,
                'sona_id' => $c->sona_id,
                'name' => $c->name,
                'patron' => $c->patron,
                'fiesta' => $c->fiesta_date,
                'contact_number' => $c->contact_number,
                'fb_account' => $c->fb_account_name,
            ]),
            'officers' => $officers->map(fn (ChapelOfficer $o) => [
                'officer_id' => $o->officer_id,
                'chapel_id' => $o->chapel_id,
                'name' => $o->name,
                'position' => $o->position,
                'ministry' => $o->ministry,
                'contact_number' => $o->position === 'President' ? $o->contact_number : null,
                'photo_url' => $o->photoUrl(),
            ]),
        ]]);
    }
}

<?php

namespace App\Services;

use App\Models\ChapelOfficer;
use App\Models\CommunityEvent;
use App\Support\DisplayName;

/**
 * The JSON shape of a GKK or PYA-KKK event, shared by the portal that sets
 * events up and the PPC portal that approves them.
 */
class CommunityEvents
{
    /** Relations present() reads. */
    public const WITH = ['officers.chapel', 'createdBy.role', 'reviewedBy.role'];

    /**
     * @return array<string, mixed>
     */
    public function present(CommunityEvent $e): array
    {
        $e->loadMissing(self::WITH);

        return [
            'event_id' => $e->event_id,
            'name' => $e->name,
            'venue' => $e->venue,
            'event_date' => $e->event_date->toDateString(),
            // "14:30"; PostgreSQL returns time columns with seconds.
            'start_time' => substr((string) $e->start_time, 0, 5),
            'status' => $e->status->value,
            'officers' => $e->officers->sortBy('name')->values()->map(fn (ChapelOfficer $o) => [
                'officer_id' => $o->officer_id,
                'name' => $o->name,
                'position' => $o->position,
                'ministry' => $o->ministry,
                'chapel_name' => $o->chapel?->name,
                'term_year' => $o->term_year,
            ]),
            'created_by' => DisplayName::of($e->createdBy),
            'created_at' => $e->created_at?->toIso8601String(),
            'updated_at' => $e->updated_at?->toIso8601String(),
            'reviewed_by' => DisplayName::of($e->reviewedBy),
            'reviewed_at' => $e->reviewed_at?->toIso8601String(),
            'review_note' => $e->review_note,
        ];
    }
}

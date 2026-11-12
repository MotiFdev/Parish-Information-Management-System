<?php

namespace App\Services;

use App\Enums\EventStatus;
use App\Models\ChapelOfficer;
use App\Models\CommunityEvent;
use App\Models\CommunityEventHistory;
use App\Models\User;
use App\Support\DisplayName;
use Illuminate\Support\Facades\DB;

/**
 * GKK and PYA-KKK events across the three portals that handle them: the
 * officers set them up, the PPC pre-approves them, and the parish priest
 * gives the final approval. Holds the JSON shape and each approval step.
 */
class CommunityEvents
{
    /** Relations present() reads. */
    public const WITH = ['officers.chapel', 'createdBy.role', 'preapprovedBy.role', 'reviewedBy.role', 'history.actor.role'];

    /**
     * Moves an event from one status to the next and records the step.
     * Returns null when it was no longer in $from, e.g. someone else decided
     * it first.
     */
    public function decide(CommunityEvent $event, EventStatus $from, EventStatus $to, User $by, ?string $reason = null): ?CommunityEvent
    {
        return DB::transaction(function () use ($event, $from, $to, $by, $reason) {
            // Locked so two reviewers can't both decide the same event.
            $fresh = CommunityEvent::query()->lockForUpdate()->find($event->getKey());
            if (! $fresh || $fresh->status !== $from) {
                return null;
            }

            $fresh->forceFill($to === EventStatus::PreApproved
                ? ['status' => $to, 'preapproved_by_user_id' => $by->user_id, 'preapproved_at' => now()]
                : ['status' => $to, 'reviewed_by_user_id' => $by->user_id, 'reviewed_at' => now(), 'review_note' => $reason],
            )->save();
            $this->record($fresh, $to->value, $by, $reason);

            return $fresh;
        });
    }

    /**
     * Adds a step to the event's history.
     *
     * @param  list<string>|null  $changes  Fields edited, on a resubmission.
     */
    public function record(CommunityEvent $event, string $action, User $by, ?string $note = null, ?array $changes = null): void
    {
        CommunityEventHistory::create([
            'event_id' => $event->event_id,
            'action' => $action,
            'actor_user_id' => $by->user_id,
            'actor_role' => $by->loadMissing('role')->role?->role_name,
            'note' => $note,
            'changes' => $changes,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function present(CommunityEvent $e): array
    {
        $e->loadMissing(self::WITH);

        return [
            'event_id' => $e->event_id,
            'name' => $e->name,
            'purpose' => $e->purpose,
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
            'preapproved_by' => DisplayName::of($e->preapprovedBy),
            'preapproved_at' => $e->preapproved_at?->toIso8601String(),
            'reviewed_by' => DisplayName::of($e->reviewedBy),
            'reviewed_at' => $e->reviewed_at?->toIso8601String(),
            // The PPC rejects only before pre-approving; the priest only after.
            'rejected_by_role' => $e->status === EventStatus::Rejected ? ($e->preapproved_by_user_id ? 'priest' : 'ppc') : null,
            'review_note' => $e->review_note,
            'history' => $e->history->map(fn (CommunityEventHistory $h) => [
                'action' => $h->action,
                'by' => DisplayName::of($h->actor),
                'by_role' => $h->actor_role,
                'note' => $h->note,
                'changes' => $h->changes,
                'at' => $h->created_at?->toIso8601String(),
            ])->values(),
        ];
    }
}

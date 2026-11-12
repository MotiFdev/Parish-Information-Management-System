<?php

namespace App\Models;

use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An event a GKK or PYA-KKK Officer set up: name, venue, date and start time, and the chapel
 * officers assigned to it. A PPC Officer pre-approves or rejects it, then the
 * parish priest gives the final approval or rejection.
 */
#[Table(name: 'community_events', key: 'event_id')]
#[Fillable(['name', 'purpose', 'venue', 'event_date', 'start_time', 'status', 'created_by_user_id', 'preapproved_by_user_id', 'preapproved_at', 'reviewed_by_user_id', 'reviewed_at', 'review_note'])]
class CommunityEvent extends Model
{
    use HasUuids;

    /**
     * Mirrors the column default so a new, unsaved model reads as Pending.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'Pending',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'event_date' => 'date',
            'status' => EventStatus::class,
            'preapproved_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * The chapel officers assigned to the event.
     *
     * @return BelongsToMany<ChapelOfficer, $this>
     */
    public function officers(): BelongsToMany
    {
        return $this->belongsToMany(ChapelOfficer::class, 'community_event_officers', 'event_id', 'officer_id');
    }

    /**
     * The GKK or PYA-KKK Officer who set it up.
     *
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * The PPC Officer who pre-approved it for the priest.
     *
     * @return BelongsTo<User, $this>
     */
    public function preapprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'preapproved_by_user_id');
    }

    /**
     * Each step it went through, oldest first.
     *
     * @return HasMany<CommunityEventHistory, $this>
     */
    public function history(): HasMany
    {
        return $this->hasMany(CommunityEventHistory::class, 'event_id')->orderBy('created_at');
    }

    /**
     * Who made the final decision: the priest, or the PPC Officer who rejected it.
     *
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}

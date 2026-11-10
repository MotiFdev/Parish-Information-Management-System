<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Table(key: 'chapel_id', timestamps: false)]
#[Fillable(['sona_id', 'name', 'patron', 'fiesta_date', 'contact_number', 'fb_account_name', 'is_active', 'approval_status', 'created_by_user_id', 'reviewed_by_user_id', 'reviewed_at', 'review_note'])]
class Chapel extends Model
{
    /**
     * Mirrors the column default so a new, unsaved model reads as active.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_active' => true,
        'approval_status' => 'Pending',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'approval_status' => ApprovalStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * Only what the PPC has approved.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function approved(Builder $query): void
    {
        $query->where('approval_status', ApprovalStatus::Approved->value);
    }

    /**
     * The GKK or PYA-KKK Officer who added it; null for rows that predate PPC approval.
     *
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * The PPC Officer who approved or rejected it.
     *
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    /**
     * @return BelongsTo<Sona, $this>
     */
    public function sona(): BelongsTo
    {
        return $this->belongsTo(Sona::class, 'sona_id');
    }

    /**
     * @return HasMany<ChapelOfficer, $this>
     */
    public function officers(): HasMany
    {
        return $this->hasMany(ChapelOfficer::class, 'chapel_id');
    }

    /**
     * The PPC-approved president for the latest term, shown to staff coordinating chapel events.
     *
     * @return HasOne<ChapelOfficer, $this>
     */
    public function president(): HasOne
    {
        return $this->hasOne(ChapelOfficer::class, 'chapel_id')
            ->where('position', 'President')
            ->where('approval_status', ApprovalStatus::Approved->value)
            // Not latestOfMany(): its tie-break runs MAX() on the UUID key, which PostgreSQL lacks.
            // Eager loading keeps the first row per chapel, so ordering picks the latest term.
            ->orderByDesc('term_year');
    }

    /**
     * @return HasMany<Parishioner, $this>
     */
    public function parishioners(): HasMany
    {
        return $this->hasMany(Parishioner::class, 'chapel_id');
    }

    /**
     * @return HasMany<Appointment, $this>
     */
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'chapel_id');
    }
}

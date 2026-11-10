<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Table(key: 'officer_id', timestamps: false)]
#[Fillable([
    'chapel_id',
    'parishioner_id',
    'name',
    'position',
    'ministry',
    'age',
    'fb_account',
    'contact_number',
    'term_year',
    'approval_status',
    'created_by_user_id',
    'reviewed_by_user_id',
    'reviewed_at',
    'review_note',
])]
class ChapelOfficer extends Model
{
    use HasUuids;

    /**
     * Mirrors the column default: a new officer waits for PPC approval.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
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
            'age' => 'integer',
            'term_year' => 'integer',
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
     * @return BelongsTo<Chapel, $this>
     */
    public function chapel(): BelongsTo
    {
        return $this->belongsTo(Chapel::class, 'chapel_id');
    }

    /**
     * @return BelongsTo<Parishioner, $this>
     */
    public function parishioner(): BelongsTo
    {
        return $this->belongsTo(Parishioner::class, 'parishioner_id');
    }

    /**
     * GKK and PYA-KKK events the officer is assigned to.
     *
     * @return BelongsToMany<CommunityEvent, $this>
     */
    public function events(): BelongsToMany
    {
        return $this->belongsToMany(CommunityEvent::class, 'community_event_officers', 'officer_id', 'event_id');
    }
}

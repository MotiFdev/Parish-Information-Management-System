<?php

namespace App\Models;

use App\Enums\ApprovalStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A staff edit to a register entry, waiting for (or decided by) the parish priest.
 */
#[Table(key: 'correction_id')]
#[Fillable(['record_id', 'proposed_values', 'changes', 'status', 'requested_by_user_id', 'reviewed_by_user_id', 'reviewed_at', 'review_note'])]
class SacramentalRecordCorrection extends Model
{
    use HasUuids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'Pending',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'proposed_values' => 'array',
            'changes' => 'array',
            'status' => ApprovalStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SacramentalRecord, $this>
     */
    public function record(): BelongsTo
    {
        return $this->belongsTo(SacramentalRecord::class, 'record_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}

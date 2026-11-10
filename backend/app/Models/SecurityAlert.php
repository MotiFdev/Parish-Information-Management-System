<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'alert_id')]
#[Fillable(['type', 'severity', 'title', 'detail', 'ip_address', 'user_id', 'dedupe_key', 'occurrences', 'first_seen_at', 'last_seen_at'])]
class SecurityAlert extends Model
{
    use HasUuids;

    public const HIGH = 'high';

    public const REVIEW = 'review';

    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurrences' => 'integer',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @param  Builder<SecurityAlert>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereNull('reviewed_at');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}

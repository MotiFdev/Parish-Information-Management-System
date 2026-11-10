<?php

namespace App\Models;

use Database\Factories\OfferingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Money the parish received: one collection, offering, or fee, on one day.
 */
#[Table(key: 'offering_id')]
#[Fillable(['category', 'description', 'amount', 'received_on', 'recorded_by_user_id'])]
class Offering extends Model
{
    /** @use HasFactory<OfferingFactory> */
    use HasFactory, HasUuids;

    /** Suggested categories; people may type their own. */
    public const CATEGORIES = [
        'Sunday collection',
        'Mass intention',
        'Baptism stole fee',
        'Wedding stole fee',
        'Funeral stole fee',
        'Certificate fee',
        'Donation',
        'Special collection',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'received_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_user_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Table(key: 'record_id')]
#[Fillable([
    'sacrament_type_id',
    'primary_parishioner_id',
    'secondary_parishioner_id',
    'officiating_minister',
    'event_date',
    'event_place',
    'book_number',
    'page_number',
    'line_number',
    'remarks',
    'source_request_id',
    'is_corrected',
    'created_by_user_id',
])]
class SacramentalRecord extends Model
{
    use HasUuids;

    /**
     * Mirrors the column default so a new, unsaved model reads as uncorrected.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'is_corrected' => false,
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
            'is_corrected' => 'boolean',
        ];
    }

    /**
     * @return HasOne<SacramentalRecordDetail, $this>
     */
    public function details(): HasOne
    {
        return $this->hasOne(SacramentalRecordDetail::class, 'record_id');
    }

    /**
     * The New Registration request that produced this entry, if any.
     *
     * @return BelongsTo<RecordRequest, $this>
     */
    public function sourceRequest(): BelongsTo
    {
        return $this->belongsTo(RecordRequest::class, 'source_request_id');
    }

    /**
     * @return BelongsTo<SacramentType, $this>
     */
    public function sacramentType(): BelongsTo
    {
        return $this->belongsTo(SacramentType::class, 'sacrament_type_id');
    }

    /**
     * @return BelongsTo<Parishioner, $this>
     */
    public function primaryParishioner(): BelongsTo
    {
        return $this->belongsTo(Parishioner::class, 'primary_parishioner_id');
    }

    /**
     * The spouse on a Marriage record.
     *
     * @return BelongsTo<Parishioner, $this>
     */
    public function secondaryParishioner(): BelongsTo
    {
        return $this->belongsTo(Parishioner::class, 'secondary_parishioner_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * @return HasMany<SacramentalSponsor, $this>
     */
    public function sponsors(): HasMany
    {
        return $this->hasMany(SacramentalSponsor::class, 'record_id');
    }

    /**
     * @return HasMany<SacramentalRecordCorrection, $this>
     */
    public function corrections(): HasMany
    {
        return $this->hasMany(SacramentalRecordCorrection::class, 'record_id');
    }

    /**
     * @return HasMany<Document, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'record_id');
    }

    /**
     * @return HasMany<RecordEmbedding, $this>
     */
    public function embeddings(): HasMany
    {
        return $this->hasMany(RecordEmbedding::class, 'record_id');
    }

    /**
     * @return HasMany<RecordRequest, $this>
     */
    public function recordRequests(): HasMany
    {
        return $this->hasMany(RecordRequest::class, 'record_id');
    }
}

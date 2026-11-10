<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table(key: 'document_id')]
#[Fillable([
    'record_id',
    'parishioner_id',
    'file_name',
    'file_path',
    'file_type',
    'file_size',
    'uploaded_by_user_id',
    'label',
])]
class Document extends Model
{
    use HasUuids;

    public const CREATED_AT = 'uploaded_at';

    public const UPDATED_AT = null;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
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
     * @return BelongsTo<Parishioner, $this>
     */
    public function parishioner(): BelongsTo
    {
        return $this->belongsTo(Parishioner::class, 'parishioner_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }

    /**
     * @return HasMany<RecordEmbedding, $this>
     */
    public function embeddings(): HasMany
    {
        return $this->hasMany(RecordEmbedding::class, 'document_id');
    }

    /**
     * The record requests this upload supports, with each link's verification status.
     *
     * @return HasMany<RequestDocument, $this>
     */
    public function requestDocuments(): HasMany
    {
        return $this->hasMany(RequestDocument::class, 'document_id');
    }
}

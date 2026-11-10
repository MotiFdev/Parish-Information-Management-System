<?php

namespace App\Models;

use App\Enums\EmbeddingSourceType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Casts\AsVector;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'embedding_id')]
#[Fillable([
    'record_id',
    'parishioner_id',
    'document_id',
    'source_type',
    'searchable_text_chunk',
    'vector_embedding',
    'embedding_model',
])]
// 1536 floats per row; keep it out of JSON responses.
#[Hidden(['vector_embedding'])]
class RecordEmbedding extends Model
{
    use HasUuids;

    public const CREATED_AT = 'indexed_at';

    public const UPDATED_AT = null;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'source_type' => EmbeddingSourceType::class,
            'vector_embedding' => AsVector::class,
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
     * @return BelongsTo<Document, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }
}

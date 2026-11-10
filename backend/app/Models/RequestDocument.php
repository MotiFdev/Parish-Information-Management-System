<?php

namespace App\Models;

use App\Enums\DocumentLabel;
use App\Enums\DocumentVerificationStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'request_document_id', timestamps: false)]
#[Fillable([
    'request_id',
    'document_id',
    'document_label',
    'verification_status',
    'verified_by_user_id',
    'verified_at',
    'title',
    'review_note',
])]
class RequestDocument extends Model
{
    use HasUuids;

    /**
     * Mirrors the column default so a new, unsaved model reads as Pending.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'verification_status' => 'Pending',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'document_label' => DocumentLabel::class,
            'verification_status' => DocumentVerificationStatus::class,
            'verified_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<RecordRequest, $this>
     */
    public function recordRequest(): BelongsTo
    {
        return $this->belongsTo(RecordRequest::class, 'request_id');
    }

    /**
     * @return BelongsTo<Document, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by_user_id');
    }
}

<?php

namespace App\Models;

use App\Enums\RecordRequestStatus;
use App\Enums\RecordRequestType;
use App\Enums\RelationshipToSubject;
use App\Support\ReferenceNumber;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Table(key: 'request_id')]
#[Fillable([
    'requested_by_user_id',
    'record_type_id',
    'request_type',
    'relationship_to_subject',
    'client_full_name',
    'client_contact_number',
    'client_email',
    'client_address',
    'parish',
    'purpose',
    'subject_details',
    'record_id',
    'privacy_consent',
    'status',
    'verified_by_staff_id',
    'approved_by_priest_id',
    'remarks',
    'handled_by_staff_id',
    'register_book',
    'register_page',
    'register_line',
    'started_at',
    'sent_to_priest_at',
    'decided_at',
    'ready_at',
    'completed_at',
])]
class RecordRequest extends Model
{
    use HasUuids;

    public const CREATED_AT = 'requested_at';

    /**
     * Mirrors the column default so a new, unsaved model reads as Pending.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'Pending',
    ];

    protected static function booted(): void
    {
        static::creating(function (RecordRequest $request) {
            $request->request_number ??= self::newRequestNumber();
        });
    }

    /**
     * The reference the requester tracks the request with, e.g. RR-7K3M-9QX2.
     */
    public static function newRequestNumber(): string
    {
        do {
            $number = ReferenceNumber::generate(ReferenceNumber::RECORD_REQUEST);
        } while (self::query()->where('request_number', $number)->exists());

        return $number;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'request_type' => RecordRequestType::class,
            'relationship_to_subject' => RelationshipToSubject::class,
            'subject_details' => 'array',
            'privacy_consent' => 'boolean',
            'status' => RecordRequestStatus::class,
            'started_at' => 'datetime',
            'sent_to_priest_at' => 'datetime',
            'decided_at' => 'datetime',
            'ready_at' => 'datetime',
            'completed_at' => 'datetime',
            'requested_at' => 'datetime',
            'details_returned_at' => 'datetime',
            'details_updated_at' => 'datetime',
        ];
    }

    /**
     * The parishioner account that sent it, for requests made before
     * parishioners stopped signing in. Null for requests from the public site.
     *
     * @return BelongsTo<User, $this>
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    /**
     * Baptism, Confirmation, Marriage, or Burial.
     *
     * @return BelongsTo<SacramentType, $this>
     */
    public function recordType(): BelongsTo
    {
        return $this->belongsTo(SacramentType::class, 'record_type_id');
    }

    /**
     * The register entry found or created for this request.
     *
     * @return BelongsTo<SacramentalRecord, $this>
     */
    public function record(): BelongsTo
    {
        return $this->belongsTo(SacramentalRecord::class, 'record_id');
    }

    /**
     * The register entry a New Registration request produced.
     *
     * @return HasOne<SacramentalRecord, $this>
     */
    public function createdRecord(): HasOne
    {
        return $this->hasOne(SacramentalRecord::class, 'source_request_id');
    }

    /**
     * The staff member who started checking the request.
     *
     * @return BelongsTo<User, $this>
     */
    public function handledByStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by_staff_id');
    }

    /**
     * Remarks and additional requirements, oldest first.
     *
     * @return HasMany<RecordRequestRemark, $this>
     */
    public function remarkThread(): HasMany
    {
        return $this->hasMany(RecordRequestRemark::class, 'request_id')->orderBy('created_at');
    }

    /** True once staff marked it verified and sent it to the priest. */
    public function isWithPriest(): bool
    {
        return $this->status === RecordRequestStatus::UnderVerification && $this->sent_to_priest_at !== null;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function verifiedByStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by_staff_id');
    }

    /**
     * The priest who signed or rejected the request.
     *
     * @return BelongsTo<User, $this>
     */
    public function approvedByPriest(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_priest_id');
    }

    /**
     * @return HasMany<RequestDocument, $this>
     */
    public function requestDocuments(): HasMany
    {
        return $this->hasMany(RequestDocument::class, 'request_id');
    }

    /**
     * @return HasMany<Notification, $this>
     */
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'request_id');
    }
}

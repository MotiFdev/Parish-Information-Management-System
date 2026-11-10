<?php

namespace App\Models;

use App\Enums\AppointmentStatus;
use App\Enums\IntentionCategory;
use App\Enums\VenueType;
use App\Support\ReferenceNumber;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table(name: 'appointments_and_events', key: 'appointment_id')]
#[Fillable([
    'requested_by_user_id',
    'event_type',
    'event_title',
    'scheduled_start',
    'scheduled_end',
    'status',
    'assigned_staff_id',
    'venue_type',
    'sona_id',
    'chapel_id',
    'house_address',
    'requester_name',
    'requester_contact',
    'requester_email',
    'intention_category',
    'intention_details',
    'attendee_count',
    'event_details',
    'privacy_consent',
    'staff_remarks',
])]
class Appointment extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

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
        static::creating(function (Appointment $appointment) {
            $appointment->reference_number ??= self::newReferenceNumber();
        });
    }

    /**
     * The reference the requester tracks the appointment with, e.g. AP-7K3M-9QX2.
     */
    public static function newReferenceNumber(): string
    {
        do {
            $number = ReferenceNumber::generate(ReferenceNumber::APPOINTMENT);
        } while (self::query()->where('reference_number', $number)->exists());

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
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'status' => AppointmentStatus::class,
            'venue_type' => VenueType::class,
            'intention_category' => IntentionCategory::class,
            'attendee_count' => 'integer',
            'event_details' => 'array',
            'privacy_consent' => 'boolean',
        ];
    }

    /**
     * The parishioner account that booked it, for bookings made before
     * parishioners stopped signing in. Null for bookings from the public site.
     *
     * @return BelongsTo<User, $this>
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_user_id');
    }

    /**
     * The staff member or priest handling the appointment.
     *
     * @return BelongsTo<User, $this>
     */
    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    /**
     * @return BelongsTo<Sona, $this>
     */
    public function sona(): BelongsTo
    {
        return $this->belongsTo(Sona::class, 'sona_id');
    }

    /**
     * The chapel venue, or the nearest chapel tagged for a Home venue.
     *
     * @return BelongsTo<Chapel, $this>
     */
    public function chapel(): BelongsTo
    {
        return $this->belongsTo(Chapel::class, 'chapel_id');
    }

    /**
     * @return HasMany<Notification, $this>
     */
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'appointment_id');
    }
}

<?php

namespace App\Models;

use App\Enums\NotificationChannel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'notification_id')]
#[Fillable(['user_id', 'request_id', 'appointment_id', 'announcement_id', 'kind', 'link', 'message', 'channel', 'is_read', 'created_at'])]
class Notification extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    /**
     * Mirrors the column defaults so a new, unsaved model reads as an unread in-app notice.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'channel' => 'in_app',
        'is_read' => false,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'channel' => NotificationChannel::class,
            'is_read' => 'boolean',
        ];
    }

    /**
     * The recipient.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<RecordRequest, $this>
     */
    public function recordRequest(): BelongsTo
    {
        return $this->belongsTo(RecordRequest::class, 'request_id');
    }

    /**
     * @return BelongsTo<Appointment, $this>
     */
    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class, 'appointment_id');
    }
}

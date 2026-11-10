<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Notifications\SetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Table(key: 'user_id')]
#[Fillable(['role_id', 'first_name', 'last_name', 'email', 'username', 'password_hash', 'is_active'])]
#[Hidden(['password_hash', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasUuids, Notifiable;

    protected $authPasswordName = 'password_hash';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed',
            'is_active' => 'boolean',
            'last_login' => 'datetime',
            'preferences' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Role, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /** "First Last", or the username for accounts created before names were stored. */
    public function displayName(): string
    {
        return trim("{$this->first_name} {$this->last_name}") ?: $this->username;
    }

    /** Where the profile picture is served, or null when there isn't one. */
    public function photoUrl(): ?string
    {
        return $this->photo_path ? route('profile-photos.show', basename($this->photo_path)) : null;
    }

    /**
     * Laravel's default reset email links to a backend route this API doesn't
     * have; send the parish's own email, which links to the frontend instead.
     */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new SetPasswordNotification($token));
    }

    public function roleType(): ?UserRole
    {
        return UserRole::tryFrom((string) $this->role?->role_name);
    }

    public function hasRole(UserRole ...$roles): bool
    {
        return in_array($this->roleType(), $roles, true);
    }

    /**
     * The parishioner profile this portal account is linked to, if any.
     *
     * @return HasOne<Parishioner, $this>
     */
    public function parishioner(): HasOne
    {
        return $this->hasOne(Parishioner::class, 'user_id');
    }

    /**
     * @return HasMany<SacramentalRecord, $this>
     */
    public function createdSacramentalRecords(): HasMany
    {
        return $this->hasMany(SacramentalRecord::class, 'created_by_user_id');
    }

    /**
     * @return HasMany<Document, $this>
     */
    public function uploadedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'uploaded_by_user_id');
    }

    /**
     * @return HasMany<RecordRequest, $this>
     */
    public function recordRequests(): HasMany
    {
        return $this->hasMany(RecordRequest::class, 'requested_by_user_id');
    }

    /**
     * @return HasMany<RecordRequest, $this>
     */
    public function verifiedRecordRequests(): HasMany
    {
        return $this->hasMany(RecordRequest::class, 'verified_by_staff_id');
    }

    /**
     * Requests this priest signed or rejected.
     *
     * @return HasMany<RecordRequest, $this>
     */
    public function approvedRecordRequests(): HasMany
    {
        return $this->hasMany(RecordRequest::class, 'approved_by_priest_id');
    }

    /**
     * Named apart from Notifiable::notifications(), which expects Laravel's own table layout.
     *
     * @return HasMany<Notification, $this>
     */
    public function parishNotifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    /**
     * @return HasMany<Appointment, $this>
     */
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'requested_by_user_id');
    }

    /**
     * @return HasMany<Appointment, $this>
     */
    public function assignedAppointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'assigned_staff_id');
    }

    /**
     * @return HasMany<Announcement, $this>
     */
    public function announcements(): HasMany
    {
        return $this->hasMany(Announcement::class, 'created_by_user_id');
    }

    /**
     * @return HasMany<AuditLog, $this>
     */
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }
}

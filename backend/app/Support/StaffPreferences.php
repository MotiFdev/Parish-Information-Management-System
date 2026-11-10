<?php

namespace App\Support;

use App\Models\User;

/**
 * A staff member's own settings, stored in users.preferences: which office
 * events notify them (and whether by email too), and where the office pages
 * open. Anything not saved yet reads as the default.
 */
final class StaffPreferences
{
    /** @var array<string, bool> */
    public const NOTIFY = [
        'email' => true,
        'newRequests' => true,
        'resubmissions' => true,
        'priestDecisions' => true,
        'bookings' => true,
        'announcements' => false,
    ];

    /** @var array<string, string> */
    public const DEFAULTS = [
        'register' => 'Baptism',
        'calendarView' => 'month',
        'reportPeriod' => 'last12',
        'pageSize' => '10',
    ];

    /** @var array<string, list<string>> */
    public const CHOICES = [
        'register' => ['Baptism', 'Confirmation', 'Marriage', 'Burial'],
        'calendarView' => ['month', 'week', 'day'],
        'reportPeriod' => ['last12', 'year'],
        'pageSize' => ['10', '25', '50'],
    ];

    /**
     * @return array{notify: array<string, bool>, defaults: array<string, string>}
     */
    public static function of(User $user): array
    {
        $saved = $user->preferences ?? [];

        return [
            'notify' => array_merge(self::NOTIFY, array_intersect_key($saved['notify'] ?? [], self::NOTIFY)),
            'defaults' => array_merge(self::DEFAULTS, array_intersect_key($saved['defaults'] ?? [], self::DEFAULTS)),
        ];
    }

    public static function wants(User $user, string $event): bool
    {
        return self::of($user)['notify'][$event] ?? false;
    }
}

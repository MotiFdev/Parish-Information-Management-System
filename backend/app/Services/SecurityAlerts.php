<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\SecurityAlert;
use App\Models\User;

/**
 * Raises the alerts shown on the admin dashboard. Repeats of the same event
 * update the open alert (occurrences, last_seen_at) instead of adding rows.
 */
class SecurityAlerts
{
    /** Privileged roles whose sign-ins from a new address are worth a look. */
    private const WATCHED_ROLES = [UserRole::SystemAdministrator, UserRole::ParishPriest, UserRole::ParishStaff];

    private const NEW_ADDRESS_LOOKBACK_DAYS = 30;

    /** Sign-in was paused for this login and address after too many wrong passwords. */
    public function repeatedFailedSignIns(string $login, string $ip, int $attempts, ?User $user): SecurityAlert
    {
        $who = $user ? "{$user->displayName()} ({$user->roleType()?->value})" : "\"{$login}\"";

        return $this->raise(
            type: 'failed_sign_ins',
            severity: SecurityAlert::HIGH,
            dedupeKey: 'failed_sign_ins:'.mb_strtolower($login),
            title: $user ? "Repeated failed sign-ins for {$user->displayName()}" : 'Repeated failed sign-ins for an unknown account',
            detail: "{$attempts} wrong passwords in a row for {$who}. Sign-in from this address is paused for a few minutes. "
                .($user ? 'If the account owner did not do this, reset their password.' : 'No account uses this username or email.'),
            ip: $ip,
            user: $user,
        );
    }

    /**
     * Call before the LOGIN audit entry for this sign-in is written, so the
     * current sign-in is not counted as "seen before".
     */
    public function checkNewAddress(User $user, string $ip): ?SecurityAlert
    {
        if (! $user->hasRole(...self::WATCHED_ROLES)) {
            return null;
        }

        $logins = AuditLog::query()->where('action', 'LOGIN')->where('user_id', $user->user_id);

        // A first-ever sign-in has nothing to compare with.
        if (! (clone $logins)->exists()) {
            return null;
        }

        $seenHere = (clone $logins)
            ->where('ip_address', $ip)
            ->where('timestamp', '>=', now()->subDays(self::NEW_ADDRESS_LOOKBACK_DAYS))
            ->exists();

        if ($seenHere) {
            return null;
        }

        $role = $user->roleType()?->value;

        return $this->raise(
            type: 'new_address_sign_in',
            severity: SecurityAlert::REVIEW,
            dedupeKey: "new_address_sign_in:{$user->user_id}:{$ip}",
            title: "{$role} account signed in from a new address",
            detail: "{$user->displayName()} signed in from an address not used in the last ".self::NEW_ADDRESS_LOOKBACK_DAYS
                .' days. Confirm with them that it was them.',
            ip: $ip,
            user: $user,
        );
    }

    /** An export at night or very early is unusual for a parish office; flag it for a second look. */
    public function auditLogExported(User $user, string $ip, string $format, int $entries): ?SecurityAlert
    {
        $local = now((string) config('app.parish_timezone', 'Asia/Manila'));
        [$opens, $closes] = config('app.office_hours', [7, 19]);
        if ($local->hour >= $opens && $local->hour < $closes) {
            return null;
        }

        return $this->raise(
            type: 'after_hours_export',
            severity: SecurityAlert::REVIEW,
            dedupeKey: "after_hours_export:{$user->user_id}:".$local->format('Y-m-d'),
            title: 'Audit log exported outside office hours',
            detail: "{$user->displayName()} downloaded {$entries} audit log ".($entries === 1 ? 'entry' : 'entries')
                ." as {$format} at {$local->format('g:i A')}.",
            ip: $ip,
            user: $user,
        );
    }

    private function raise(string $type, string $severity, string $dedupeKey, string $title, string $detail, string $ip, ?User $user): SecurityAlert
    {
        $open = SecurityAlert::open()->where('dedupe_key', $dedupeKey)->where('last_seen_at', '>=', now()->subDay())->first();

        if ($open) {
            $open->forceFill([
                'occurrences' => $open->occurrences + 1,
                'last_seen_at' => now(),
                'detail' => $detail,
                'ip_address' => $ip,
            ])->save();

            return $open;
        }

        return SecurityAlert::create([
            'type' => $type,
            'severity' => $severity,
            'title' => $title,
            'detail' => $detail,
            'ip_address' => $ip,
            'user_id' => $user?->user_id,
            'dedupe_key' => $dedupeKey,
            'first_seen_at' => now(),
            'last_seen_at' => now(),
        ]);
    }
}

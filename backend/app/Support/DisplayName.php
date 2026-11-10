<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;

final class DisplayName
{
    /** "Fr. Antonio Reyes" for priests, "Liza Mercado" for others, or the username. */
    public static function of(?User $user): ?string
    {
        if (! $user) {
            return null;
        }
        $name = trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->username;

        return $user->roleType() === UserRole::ParishPriest ? "Fr. {$name}" : $name;
    }
}

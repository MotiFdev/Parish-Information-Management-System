<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * One account per portal role for trying the portals locally (Parish Priest,
 * Secretary, GKK, PYA-KKK, and PPC Officer), all with the password "password". Runs only when
 * APP_ENV=local; real accounts are added from the admin portal's User
 * Management, which emails a set-password link. Existing accounts are left
 * unchanged.
 */
class PortalUserSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $accounts = [
            [UserRole::ParishPriest, 'Antonio', 'Reyes', 'priest', 'priest@parish.local'],
            [UserRole::ParishStaff, 'Liza', 'Mercado', 'secretary', 'secretary@parish.local'],
            [UserRole::GkkOfficer, 'Rosa', 'Lim', 'gkk', 'gkk@parish.local'],
            [UserRole::PyaKkkOfficer, 'Paolo', 'Reyes', 'pya', 'pya@parish.local'],
            [UserRole::PpcOfficer, 'Noel', 'Santos', 'ppc', 'ppc@parish.local'],
        ];

        foreach ($accounts as [$role, $firstName, $lastName, $username, $email]) {
            $exists = User::query()
                ->whereRaw('LOWER(username) = LOWER(?)', [$username])
                ->orWhereRaw('LOWER(email) = LOWER(?)', [$email])
                ->exists();

            if ($exists) {
                $this->command?->info("{$role->value} account [{$username}] already exists; left unchanged.");

                continue;
            }

            User::create([
                'role_id' => DB::table('roles')->where('role_name', $role->value)->value('role_id'),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'username' => $username,
                'email' => $email,
                'password_hash' => 'password',
                'is_active' => true,
            ]);

            $this->command?->info("{$role->value} account [{$username}] created.");
        }
    }
}

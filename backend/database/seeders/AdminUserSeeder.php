<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * The first System Administrator account, so the admin portal can be signed
 * into before user management exists. Credentials come from ADMIN_* in .env.
 * Re-running never changes an existing account's password.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $username = (string) env('ADMIN_USERNAME', 'admin');
        $email = (string) env('ADMIN_EMAIL', 'admin@parish.local');
        $password = env('ADMIN_PASSWORD');

        if (blank($password)) {
            if (app()->isProduction()) {
                throw new RuntimeException('Set ADMIN_PASSWORD in .env before seeding the administrator account.');
            }
            $password = 'password';
        }

        $exists = User::query()
            ->whereRaw('LOWER(username) = LOWER(?)', [$username])
            ->orWhereRaw('LOWER(email) = LOWER(?)', [$email])
            ->exists();

        if ($exists) {
            $this->command?->info("Administrator account [{$username}] already exists; left unchanged.");

            return;
        }

        User::create([
            'role_id' => DB::table('roles')->where('role_name', UserRole::SystemAdministrator->value)->value('role_id'),
            'first_name' => 'System',
            'last_name' => 'Administrator',
            'username' => $username,
            'email' => $email,
            'password_hash' => $password,
            'is_active' => true,
        ]);

        $this->command?->info("Administrator account [{$username}] created.");
    }
}

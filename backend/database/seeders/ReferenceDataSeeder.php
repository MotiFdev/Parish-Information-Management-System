<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Lookup rows that other tables reference by foreign key. Safe to re-run.
 */
class ReferenceDataSeeder extends Seeder
{
    public function run(): void
    {
        foreach (UserRole::cases() as $role) {
            DB::table('roles')->updateOrInsert(['role_name' => $role->value]);
        }

        foreach (['Baptism', 'Confirmation', 'Marriage', 'Burial'] as $sacrament) {
            DB::table('sacrament_types')->updateOrInsert(['name' => $sacrament]);
        }
    }
}

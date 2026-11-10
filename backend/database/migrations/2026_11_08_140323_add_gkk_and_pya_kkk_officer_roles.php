<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds the roles to databases that were seeded before they existed;
     * ReferenceDataSeeder adds them on a fresh install.
     */
    public function up(): void
    {
        foreach (['GKK Officer', 'PYA-KKK Officer'] as $role) {
            DB::table('roles')->updateOrInsert(['role_name' => $role]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * Fails while any account still has one of these roles.
     */
    public function down(): void
    {
        DB::table('roles')->whereIn('role_name', ['GKK Officer', 'PYA-KKK Officer'])->delete();
    }
};

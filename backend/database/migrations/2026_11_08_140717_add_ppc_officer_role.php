<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds the role to databases that were seeded before it existed;
     * ReferenceDataSeeder adds it on a fresh install.
     */
    public function up(): void
    {
        DB::table('roles')->updateOrInsert(['role_name' => 'PPC Officer']);
    }

    /**
     * Reverse the migrations.
     *
     * Fails while any account still has this role.
     */
    public function down(): void
    {
        DB::table('roles')->where('role_name', 'PPC Officer')->delete();
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staff, priests, and administrators have no parishioner profile, so the
 * account itself carries the name shown in User Management and the portal
 * header. Nullable so accounts created before this keep working.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name', 100)->nullable()->after('role_id');
            $table->string('last_name', 100)->nullable()->after('first_name');
            $table->index(['last_name', 'first_name']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['last_name', 'first_name']);
            $table->dropColumn(['first_name', 'last_name']);
        });
    }
};

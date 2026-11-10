<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Appointments take one requested date and time; the optional alternate
 * schedule is no longer collected.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE appointments_and_events DROP CONSTRAINT IF EXISTS appointments_and_events_alt_range_check');

        Schema::table('appointments_and_events', function (Blueprint $table) {
            $table->dropColumn(['alt_start', 'alt_end']);
        });
    }

    public function down(): void
    {
        Schema::table('appointments_and_events', function (Blueprint $table) {
            $table->timestampTz('alt_start')->nullable();
            $table->timestampTz('alt_end')->nullable();
        });

        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_alt_range_check
            CHECK ((alt_start IS NULL AND alt_end IS NULL) OR alt_end > alt_start)');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The NOT NULL columns have no default: on a table that already holds
     * appointments this fails and rolls back rather than inventing values.
     */
    public function up(): void
    {
        Schema::table('appointments_and_events', function (Blueprint $table) {
            $table->string('venue_type', 30);
            $table->integer('sona_id')->nullable()->index();
            $table->integer('chapel_id')->nullable()->index();
            $table->string('house_address', 250)->nullable();
            $table->string('requester_name', 200);
            $table->string('requester_contact', 20);
            $table->string('requester_email', 150)->nullable();
            $table->timestampTz('alt_start')->nullable();
            $table->timestampTz('alt_end')->nullable();
            $table->string('intention_category', 50)->nullable();
            $table->text('intention_details')->nullable();
            $table->integer('attendee_count')->nullable();
            // Type-specific details, such as the couple's names for a Wedding Pre-interview.
            $table->jsonb('event_details')->nullable();
            $table->boolean('privacy_consent');
            $table->text('staff_remarks')->nullable();

            $table->foreign('sona_id')->references('sona_id')->on('sonas')
                ->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('chapel_id')->references('chapel_id')->on('chapels')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        DB::statement("ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_venue_type_check
            CHECK (venue_type IN ('Parish Church', 'Chapel', 'Home'))");
        DB::statement("ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_home_address_check
            CHECK (venue_type <> 'Home' OR house_address IS NOT NULL)");
        DB::statement("ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_chapel_venue_check
            CHECK (venue_type <> 'Chapel' OR chapel_id IS NOT NULL)");
        DB::statement("ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_intention_category_check
            CHECK (intention_category IS NULL OR intention_category IN ('Thanksgiving', 'Souls', 'Healing', 'Special'))");
        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_alt_range_check
            CHECK ((alt_start IS NULL AND alt_end IS NULL) OR alt_end > alt_start)');
        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_attendee_count_check
            CHECK (attendee_count IS NULL OR attendee_count > 0)');
        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_privacy_consent_check
            CHECK (privacy_consent)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments_and_events', function (Blueprint $table) {
            $table->dropForeign(['sona_id']);
            $table->dropForeign(['chapel_id']);
            $table->dropColumn([
                'venue_type',
                'sona_id',
                'chapel_id',
                'house_address',
                'requester_name',
                'requester_contact',
                'requester_email',
                'alt_start',
                'alt_end',
                'intention_category',
                'intention_details',
                'attendee_count',
                'event_details',
                'privacy_consent',
                'staff_remarks',
            ]);
        });
    }
};

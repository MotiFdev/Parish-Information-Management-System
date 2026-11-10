<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('appointments_and_events', function (Blueprint $table) {
            $table->uuid('appointment_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('requested_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->string('event_type', 100);
            $table->string('event_title', 150);
            $table->timestampTz('scheduled_start');
            $table->timestampTz('scheduled_end');
            $table->string('status', 50)->default('Pending')->index();
            $table->foreignUuid('assigned_staff_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['scheduled_start', 'scheduled_end']);
        });

        DB::statement("ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_status_check
            CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled'))");
        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_time_range_check
            CHECK (scheduled_end > scheduled_start)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointments_and_events');
    }
};

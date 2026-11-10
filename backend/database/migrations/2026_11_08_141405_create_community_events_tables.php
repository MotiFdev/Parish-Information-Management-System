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
     * Events that GKK and PYA-KKK Officers set up, with the chapel officers
     * assigned to them. Each waits for a PPC Officer to approve or reject it.
     */
    public function up(): void
    {
        Schema::create('community_events', function (Blueprint $table) {
            $table->uuid('event_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name', 150);
            $table->string('venue', 200);
            $table->date('event_date')->index();
            $table->string('status', 20)->default('Pending')->index();
            $table->foreignUuid('created_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->foreignUuid('reviewed_by_user_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            // The PPC Officer's reason when rejecting.
            $table->text('review_note')->nullable();
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_status_check
            CHECK (status IN ('Pending', 'Approved', 'Rejected'))");
        // Approval gate: a decided event names who decided it, and a rejection says why.
        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_review_check
            CHECK (status = 'Pending' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))");
        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_rejection_reason_check
            CHECK (status <> 'Rejected' OR review_note IS NOT NULL)");

        Schema::create('community_event_officers', function (Blueprint $table) {
            $table->foreignUuid('event_id')->constrained('community_events', 'event_id')->cascadeOnDelete();
            // Removing an officer from the chapel list takes them off its events too.
            $table->foreignUuid('officer_id')->index()->constrained('chapel_officers', 'officer_id')->cascadeOnDelete();
            $table->primary(['event_id', 'officer_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('community_event_officers');
        Schema::dropIfExists('community_events');
    }
};

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
     * The PPC's approval becomes a pre-approval; the parish priest makes the
     * final decision. Events the PPC already approved wait for the priest, as
     * Pre-Approved. Every step is kept in community_event_history.
     */
    public function up(): void
    {
        Schema::table('community_events', function (Blueprint $table) {
            $table->foreignUuid('preapproved_by_user_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('preapproved_at')->nullable();
        });

        Schema::create('community_event_history', function (Blueprint $table) {
            $table->uuid('history_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('event_id')->index()->constrained('community_events', 'event_id')->cascadeOnDelete();
            $table->string('action', 20);
            $table->foreignUuid('actor_user_id')->nullable()->constrained('users', 'user_id')->nullOnDelete();
            // The actor's role when they acted, so the history reads the same if it changes later.
            $table->string('actor_role', 40)->nullable();
            // The rejection reason.
            $table->text('note')->nullable();
            // On a resubmission: which fields were edited.
            $table->jsonb('changes')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['event_id', 'created_at']);
        });
        DB::statement("ALTER TABLE community_event_history ADD CONSTRAINT community_event_history_action_check
            CHECK (action IN ('Submitted', 'Resubmitted', 'Pre-Approved', 'Approved', 'Rejected'))");

        DB::statement('ALTER TABLE community_events DROP CONSTRAINT community_events_status_check');
        DB::statement('ALTER TABLE community_events DROP CONSTRAINT community_events_review_check');

        // History for events set up before it was kept.
        DB::statement("INSERT INTO community_event_history (event_id, action, actor_user_id, actor_role, created_at)
            SELECT e.event_id, 'Submitted', e.created_by_user_id, r.role_name, e.created_at
            FROM community_events e JOIN users u ON u.user_id = e.created_by_user_id JOIN roles r ON r.role_id = u.role_id");
        DB::statement("INSERT INTO community_event_history (event_id, action, actor_user_id, actor_role, note, created_at)
            SELECT e.event_id, CASE WHEN e.status = 'Approved' THEN 'Pre-Approved' ELSE 'Rejected' END,
                e.reviewed_by_user_id, r.role_name, e.review_note, e.reviewed_at
            FROM community_events e JOIN users u ON u.user_id = e.reviewed_by_user_id JOIN roles r ON r.role_id = u.role_id
            WHERE e.status IN ('Approved', 'Rejected')");

        // The PPC's approvals so far become pre-approvals for the priest to decide.
        DB::statement("UPDATE community_events
            SET status = 'Pre-Approved', preapproved_by_user_id = reviewed_by_user_id, preapproved_at = reviewed_at,
                reviewed_by_user_id = NULL, reviewed_at = NULL, review_note = NULL
            WHERE status = 'Approved'");

        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_status_check
            CHECK (status IN ('Pending', 'Pre-Approved', 'Approved', 'Rejected'))");
        // Approval gate: a PPC pre-approval comes before the priest's approval, and a final decision names who made it.
        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_preapproval_check
            CHECK (status NOT IN ('Pre-Approved', 'Approved') OR (preapproved_by_user_id IS NOT NULL AND preapproved_at IS NOT NULL))");
        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_review_check
            CHECK (status IN ('Pending', 'Pre-Approved') OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))");
    }

    /**
     * Reverse the migrations.
     *
     * Pre-approved events go back to being approved by the PPC; approvals the
     * priest gave stay approved.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE community_events DROP CONSTRAINT community_events_status_check');
        DB::statement('ALTER TABLE community_events DROP CONSTRAINT community_events_preapproval_check');
        DB::statement('ALTER TABLE community_events DROP CONSTRAINT community_events_review_check');

        DB::statement("UPDATE community_events
            SET status = 'Approved', reviewed_by_user_id = preapproved_by_user_id, reviewed_at = preapproved_at
            WHERE status = 'Pre-Approved'");

        Schema::dropIfExists('community_event_history');
        Schema::table('community_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('preapproved_by_user_id');
            $table->dropColumn('preapproved_at');
        });

        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_status_check
            CHECK (status IN ('Pending', 'Approved', 'Rejected'))");
        DB::statement("ALTER TABLE community_events ADD CONSTRAINT community_events_review_check
            CHECK (status = 'Pending' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL))");
    }
};

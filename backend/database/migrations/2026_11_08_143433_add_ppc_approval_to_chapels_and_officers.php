<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = ['chapels', 'chapel_officers'];

    /**
     * Run the migrations.
     *
     * Chapels and officers that GKK and PYA-KKK Officers add wait for a PPC
     * Officer's approval. Rows that already exist are counted as approved; new
     * rows start as Pending.
     */
    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->string('approval_status', 20)->default('Approved')->index();
                $t->foreignUuid('created_by_user_id')->nullable()->index()
                    ->constrained('users', 'user_id')->restrictOnDelete();
                $t->foreignUuid('reviewed_by_user_id')->nullable()->index()
                    ->constrained('users', 'user_id')->restrictOnDelete();
                $t->timestampTz('reviewed_at')->nullable();
                // The PPC Officer's reason when rejecting.
                $t->text('review_note')->nullable();
            });

            // Existing rows were filled in as Approved above; from now on new rows start as Pending.
            DB::statement("ALTER TABLE {$table} ALTER COLUMN approval_status SET DEFAULT 'Pending'");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_approval_status_check
                CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'))");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$table}_rejection_reason_check
                CHECK (approval_status <> 'Rejected' OR review_note IS NOT NULL)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        foreach (self::TABLES as $table) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$table}_approval_status_check");
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT IF EXISTS {$table}_rejection_reason_check");
            Schema::table($table, function (Blueprint $t) {
                $t->dropForeign(['created_by_user_id']);
                $t->dropForeign(['reviewed_by_user_id']);
                $t->dropColumn(['approval_status', 'created_by_user_id', 'reviewed_by_user_id', 'reviewed_at', 'review_note']);
            });
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What staff need to type register books into Sacramental Records:
 *
 * - People named in a register entry often have no address, birthday, or
 *   birthplace on file (a 1985 burial, a confirmand's sponsor), so those
 *   parishioner columns become optional.
 * - The register's free-text people (parents as written, a couple's parents)
 *   get columns on sacramental_record_details.
 * - Edits to an entry wait for the priest in sacramental_record_corrections;
 *   only one can be waiting per entry.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const OPTIONAL_PARISHIONER_COLUMNS = ['gender', 'sex', 'date_of_birth', 'place_of_birth', 'address_street', 'address_barangay', 'address_city'];

    public function up(): void
    {
        foreach (self::OPTIONAL_PARISHIONER_COLUMNS as $column) {
            DB::statement("ALTER TABLE parishioners ALTER COLUMN {$column} DROP NOT NULL");
        }

        Schema::table('sacramental_record_details', function (Blueprint $table) {
            $table->string('father_name', 200)->nullable();
            $table->string('mother_name', 200)->nullable();
            /** Burial: the deceased's parents, as written. */
            $table->string('parents_names', 300)->nullable();
            $table->string('groom_parents', 300)->nullable();
            $table->string('bride_parents', 300)->nullable();
        });

        Schema::create('sacramental_record_corrections', function (Blueprint $table) {
            $table->uuid('correction_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('record_id')->constrained('sacramental_records', 'record_id')->cascadeOnDelete();
            /** The whole entry as staff want it to read, keyed like the form. */
            $table->jsonb('proposed_values');
            /** @var list<array{field: string, from: string, to: string}> */
            $table->jsonb('changes');
            $table->string('status', 20)->default('Pending');
            $table->foreignUuid('requested_by_user_id')->constrained('users', 'user_id')->restrictOnDelete();
            $table->foreignUuid('reviewed_by_user_id')->nullable()->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->timestampsTz();
            $table->index(['status', 'created_at']);
        });

        DB::statement("ALTER TABLE sacramental_record_corrections ADD CONSTRAINT sacramental_record_corrections_status_check CHECK (status IN ('Pending', 'Approved', 'Rejected'))");
        DB::statement("ALTER TABLE sacramental_record_corrections ADD CONSTRAINT sacramental_record_corrections_reason_check CHECK (status <> 'Rejected' OR review_note IS NOT NULL)");
        DB::statement("CREATE UNIQUE INDEX sacramental_record_corrections_one_pending ON sacramental_record_corrections (record_id) WHERE status = 'Pending'");
    }

    public function down(): void
    {
        Schema::dropIfExists('sacramental_record_corrections');

        Schema::table('sacramental_record_details', function (Blueprint $table) {
            $table->dropColumn(['father_name', 'mother_name', 'parents_names', 'groom_parents', 'bride_parents']);
        });

        // Fails if entries were added without these details; fill them in first.
        foreach (self::OPTIONAL_PARISHIONER_COLUMNS as $column) {
            DB::statement("ALTER TABLE parishioners ALTER COLUMN {$column} SET NOT NULL");
        }
    }
};

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
        // No endpoint ever wrote certificate requests, so the table is dropped rather than migrated.
        Schema::dropIfExists('certificate_requests');

        // Backs the human-readable request_number; see RecordRequest::nextRequestNumber().
        DB::statement('CREATE SEQUENCE IF NOT EXISTS record_requests_number_seq');

        Schema::create('record_requests', function (Blueprint $table) {
            $table->uuid('request_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('request_number', 30)->unique();
            $table->foreignUuid('requested_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->integer('record_type_id')->index();
            $table->string('request_type', 30)->index();
            $table->string('relationship_to_subject', 50);
            $table->string('client_full_name', 200);
            $table->string('client_contact_number', 20);
            $table->string('client_email', 150);
            $table->string('client_address', 300);
            $table->string('parish', 150);
            $table->text('purpose');
            // Record-type-specific subject, couple, or informant data from the request form.
            $table->jsonb('subject_details');
            // Nullable: staff link the register entry once it is found (or created, for New Registration).
            $table->foreignUuid('record_id')->nullable()->index()
                ->constrained('sacramental_records', 'record_id')->restrictOnDelete();
            $table->boolean('privacy_consent');
            $table->string('status', 30)->default('Pending')->index();
            $table->foreignUuid('verified_by_staff_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->foreignUuid('approved_by_priest_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->text('remarks')->nullable();
            $table->timestampTz('requested_at')->useCurrent()->index();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('record_type_id')->references('sacrament_type_id')->on('sacrament_types')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        // Owned by the table so migrate:fresh (which drops tables, not loose sequences) removes it too.
        DB::statement('ALTER SEQUENCE record_requests_number_seq OWNED BY record_requests.request_number');

        DB::statement("ALTER TABLE record_requests ADD CONSTRAINT record_requests_status_check
            CHECK (status IN ('Pending', 'Under Verification', 'Approved', 'Rejected', 'Ready for Collection', 'Completed'))");
        DB::statement("ALTER TABLE record_requests ADD CONSTRAINT record_requests_request_type_check
            CHECK (request_type IN ('New Registration', 'Certificate Request', 'Record Correction'))");
        DB::statement("ALTER TABLE record_requests ADD CONSTRAINT record_requests_relationship_check
            CHECK (relationship_to_subject IN ('Self', 'Parent', 'Spouse', 'Child', 'Relative', 'Authorized Representative'))");
        DB::statement('ALTER TABLE record_requests ADD CONSTRAINT record_requests_privacy_consent_check
            CHECK (privacy_consent)');
        // Approval gate: nothing is approved or released without staff verification and a priest's sign-off.
        DB::statement("ALTER TABLE record_requests ADD CONSTRAINT record_requests_approval_gate_check
            CHECK (status NOT IN ('Approved', 'Ready for Collection', 'Completed')
                OR (verified_by_staff_id IS NOT NULL AND approved_by_priest_id IS NOT NULL))");
        DB::statement("ALTER TABLE record_requests ADD CONSTRAINT record_requests_rejection_reason_check
            CHECK (status <> 'Rejected' OR (approved_by_priest_id IS NOT NULL AND remarks IS NOT NULL))");

        Schema::table('sacramental_records', function (Blueprint $table) {
            // No default: fails (and rolls back) if register entries already exist without a place.
            $table->string('event_place', 200);
            $table->foreignUuid('source_request_id')->nullable()->index()
                ->constrained('record_requests', 'request_id')->nullOnDelete();
            $table->boolean('is_corrected')->default(false);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sacramental_records', function (Blueprint $table) {
            $table->dropForeign(['source_request_id']);
            $table->dropColumn(['event_place', 'source_request_id', 'is_corrected']);
        });

        Schema::dropIfExists('record_requests');
        DB::statement('DROP SEQUENCE IF EXISTS record_requests_number_seq');

        Schema::create('certificate_requests', function (Blueprint $table) {
            $table->uuid('request_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('requested_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->integer('sacrament_type_id')->index();
            $table->foreignUuid('record_id')->nullable()->index()
                ->constrained('sacramental_records', 'record_id')->restrictOnDelete();
            $table->text('purpose');
            $table->string('status', 50)->default('Pending')->index();
            $table->foreignUuid('approved_by_priest_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('requested_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('sacrament_type_id')->references('sacrament_type_id')->on('sacrament_types')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        DB::statement("ALTER TABLE certificate_requests ADD CONSTRAINT certificate_requests_status_check
            CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Ready for Collection'))");
    }
};

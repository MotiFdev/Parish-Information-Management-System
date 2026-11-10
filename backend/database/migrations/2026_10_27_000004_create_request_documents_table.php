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
        Schema::create('request_documents', function (Blueprint $table) {
            $table->uuid('request_document_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('request_id')->index()
                ->constrained('record_requests', 'request_id')->cascadeOnDelete();
            $table->foreignUuid('document_id')->index()
                ->constrained('documents', 'document_id')->restrictOnDelete();
            $table->string('document_label', 100);
            $table->string('verification_status', 30)->default('Pending')->index();
            $table->foreignUuid('verified_by_user_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('verified_at')->nullable();

            $table->unique(['request_id', 'document_id']);
        });

        DB::statement("ALTER TABLE request_documents ADD CONSTRAINT request_documents_label_check
            CHECK (document_label IN ('Valid ID', 'Birth Certificate', 'Baptismal Certificate', 'Death Certificate', 'Burial Permit', 'Other'))");
        DB::statement("ALTER TABLE request_documents ADD CONSTRAINT request_documents_verification_status_check
            CHECK (verification_status IN ('Pending', 'Verified', 'Rejected', 'Needs Resubmission'))");
        // A reviewed document must say who reviewed it and when.
        DB::statement("ALTER TABLE request_documents ADD CONSTRAINT request_documents_reviewer_check
            CHECK (verification_status = 'Pending' OR (verified_by_user_id IS NOT NULL AND verified_at IS NOT NULL))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('request_documents');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What the Record Requests workflow needs beyond the original tables:
 * - who on staff is handling a request and when each step happened;
 * - the register reference (book, page, line) as written in the paper register,
 *   for entries that are not yet in the digital register;
 * - per-document titles ("PSA birth certificate"), staff notes, and documents staff
 *   asked for that are not uploaded yet (document_id is null until then);
 * - a remarks thread, so each remark or requirement keeps its author and time.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_requests', function (Blueprint $table) {
            $table->foreignUuid('handled_by_staff_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->string('register_book', 50)->nullable();
            $table->string('register_page', 50)->nullable();
            $table->string('register_line', 50)->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('sent_to_priest_at')->nullable();
            $table->timestampTz('decided_at')->nullable();
            $table->timestampTz('ready_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
        });

        DB::statement('ALTER TABLE record_requests ADD CONSTRAINT record_requests_register_ref_check
            CHECK ((register_book IS NULL AND register_page IS NULL AND register_line IS NULL)
                OR (register_book IS NOT NULL AND register_page IS NOT NULL AND register_line IS NOT NULL))');

        Schema::table('request_documents', function (Blueprint $table) {
            $table->uuid('document_id')->nullable()->change();
            $table->string('title', 150)->nullable();
            $table->text('review_note')->nullable();
        });

        // A document can't be checked before it is uploaded.
        DB::statement("ALTER TABLE request_documents ADD CONSTRAINT request_documents_uploaded_before_review_check
            CHECK (document_id IS NOT NULL OR verification_status = 'Pending')");

        Schema::create('record_request_remarks', function (Blueprint $table) {
            $table->uuid('remark_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('request_id')->index()
                ->constrained('record_requests', 'request_id')->cascadeOnDelete();
            $table->foreignUuid('user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->string('kind', 20);
            $table->text('body');
            $table->timestampTz('created_at')->useCurrent();
        });

        DB::statement("ALTER TABLE record_request_remarks ADD CONSTRAINT record_request_remarks_kind_check
            CHECK (kind IN ('remark', 'requirement'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('record_request_remarks');

        DB::statement('ALTER TABLE request_documents DROP CONSTRAINT IF EXISTS request_documents_uploaded_before_review_check');
        DB::table('request_documents')->whereNull('document_id')->delete();
        Schema::table('request_documents', function (Blueprint $table) {
            $table->dropColumn(['title', 'review_note']);
            $table->uuid('document_id')->nullable(false)->change();
        });

        DB::statement('ALTER TABLE record_requests DROP CONSTRAINT IF EXISTS record_requests_register_ref_check');
        Schema::table('record_requests', function (Blueprint $table) {
            $table->dropForeign(['handled_by_staff_id']);
            $table->dropColumn([
                'handled_by_staff_id', 'register_book', 'register_page', 'register_line',
                'started_at', 'sent_to_priest_at', 'decided_at', 'ready_at', 'completed_at',
            ]);
        });
    }
};

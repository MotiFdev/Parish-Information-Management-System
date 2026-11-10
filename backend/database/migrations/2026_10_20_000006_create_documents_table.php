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
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('document_id')->primary()->default(DB::raw('gen_random_uuid()'));
            // Both links are optional so a scan can be uploaded first and linked later.
            $table->foreignUuid('record_id')->nullable()->index()
                ->constrained('sacramental_records', 'record_id')->restrictOnDelete();
            $table->foreignUuid('parishioner_id')->nullable()->index()
                ->constrained('parishioners', 'parishioner_id')->restrictOnDelete();
            $table->string('file_name', 255);
            $table->string('file_path', 500)->unique();
            $table->string('file_type', 50);
            $table->integer('file_size');
            $table->foreignUuid('uploaded_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('uploaded_at')->useCurrent();
        });

        DB::statement('ALTER TABLE documents ADD CONSTRAINT documents_file_size_check CHECK (file_size >= 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};

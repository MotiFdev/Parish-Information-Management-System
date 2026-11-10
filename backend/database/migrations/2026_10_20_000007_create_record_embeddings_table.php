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
        Schema::create('record_embeddings', function (Blueprint $table) {
            $table->uuid('embedding_id')->primary()->default(DB::raw('gen_random_uuid()'));
            // Embeddings are derived data: they go away with their source and are rebuilt by re-indexing.
            $table->foreignUuid('record_id')->nullable()->index()
                ->constrained('sacramental_records', 'record_id')->cascadeOnDelete();
            $table->foreignUuid('parishioner_id')->nullable()->index()
                ->constrained('parishioners', 'parishioner_id')->cascadeOnDelete();
            $table->foreignUuid('document_id')->nullable()->index()
                ->constrained('documents', 'document_id')->cascadeOnDelete();
            $table->string('source_type', 50)->index();
            $table->text('searchable_text_chunk');
            $table->vector('vector_embedding', dimensions: 1536);
            $table->timestampTz('indexed_at')->useCurrent();

            $table->vectorIndex('vector_embedding');
        });

        DB::statement("ALTER TABLE record_embeddings ADD CONSTRAINT record_embeddings_source_type_check
            CHECK (source_type IN ('Sacramental Record', 'Parishioner Profile', 'Scanned Document'))");
        DB::statement('ALTER TABLE record_embeddings ADD CONSTRAINT record_embeddings_has_source_check
            CHECK (num_nonnulls(record_id, parishioner_id, document_id) >= 1)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('record_embeddings');
    }
};

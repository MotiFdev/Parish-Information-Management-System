<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * AI Engine Settings: which embedding model made each vector. Vectors from
 * different models can't be compared, so search only reads rows made with
 * the model chosen in settings. Existing rows were made with the configured one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_embeddings', function (Blueprint $table) {
            $table->string('embedding_model', 100)->nullable()->index();
        });
        DB::table('record_embeddings')->update(['embedding_model' => config('services.gemini.embedding_model', 'gemini-embedding-001')]);
    }

    public function down(): void
    {
        Schema::table('record_embeddings', function (Blueprint $table) {
            $table->dropColumn('embedding_model');
        });
    }
};

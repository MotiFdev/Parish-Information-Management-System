<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * AI Record Search history: each person's own recent questions and the
 * filters they used, so a search can be run again. Only its owner sees it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_search_history', function (Blueprint $table) {
            $table->uuid('search_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('user_id')->constrained('users', 'user_id')->cascadeOnDelete();
            $table->string('query', 300);
            $table->jsonb('filters');
            $table->unsignedInteger('result_count');
            $table->timestampTz('searched_at')->useCurrent();
            $table->index(['user_id', 'searched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_search_history');
    }
};

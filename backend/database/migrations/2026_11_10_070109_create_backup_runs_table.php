<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Backup & Recovery: one row per backup of the relational database (pg_dump)
 * or the vector database (the AI search embeddings). This table is left out
 * of the backups themselves, so restoring never rewrites the history.
 *
 * user_id has no foreign key on purpose: a restore drops and recreates the
 * users table, which a constraint from this table would block.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('backup_runs', function (Blueprint $table) {
            $table->uuid('backup_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('database', 20);
            $table->string('trigger', 20);
            $table->uuid('user_id')->nullable();
            $table->string('by_name', 120)->nullable();
            $table->string('status', 20);
            $table->string('file_path', 300)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->text('error')->nullable();
            $table->timestampTz('started_at');
            $table->timestampTz('finished_at')->nullable();
            $table->index(['database', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_runs');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staff edit announcements from the portal: keep when each was last edited.
 * content_markdown holds the editor's sanitized HTML.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->timestampTz('updated_at')->nullable();
        });
        DB::statement('UPDATE announcements SET updated_at = created_at');
    }

    public function down(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn('updated_at');
        });
    }
};

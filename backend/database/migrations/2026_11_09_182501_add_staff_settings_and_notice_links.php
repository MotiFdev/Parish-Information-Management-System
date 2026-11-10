<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staff Settings: each person's notification choices and page defaults
 * (users.preferences), settings the whole office shares (parish_settings),
 * and office notices in the header inbox (what kind, where it opens, and
 * the announcement a "now live" notice is about).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->jsonb('preferences')->nullable();
        });

        Schema::create('parish_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->text('value');
            $table->foreignUuid('updated_by_user_id')->nullable()->constrained('users', 'user_id')->nullOnDelete();
            $table->timestampTz('updated_at')->useCurrent();
        });
        DB::table('parish_settings')->insert(['key' => 'office_hours', 'value' => 'Monday to Saturday, 8:00 AM to 5:00 PM']);

        Schema::table('notifications', function (Blueprint $table) {
            $table->string('kind', 30)->nullable();
            $table->string('link', 300)->nullable();
            // A "your scheduled announcement is live" notice is written ahead with created_at at the publish time.
            $table->foreignUuid('announcement_id')->nullable()->index()
                ->constrained('announcements', 'announcement_id')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('announcement_id');
            $table->dropColumn(['kind', 'link']);
        });
        Schema::dropIfExists('parish_settings');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('preferences');
        });
    }
};

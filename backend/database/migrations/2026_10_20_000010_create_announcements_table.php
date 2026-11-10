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
        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('announcement_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('title', 200);
            $table->text('content_markdown');
            $table->string('status', 50)->default('Draft');
            // A future published_at on a Published row is a scheduled publication.
            $table->timestampTz('published_at')->nullable();
            $table->foreignUuid('created_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['status', 'published_at']);
        });

        DB::statement("ALTER TABLE announcements ADD CONSTRAINT announcements_status_check
            CHECK (status IN ('Draft', 'Published', 'Archived'))");
        DB::statement("ALTER TABLE announcements ADD CONSTRAINT announcements_published_at_check
            CHECK (status <> 'Published' OR published_at IS NOT NULL)");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};

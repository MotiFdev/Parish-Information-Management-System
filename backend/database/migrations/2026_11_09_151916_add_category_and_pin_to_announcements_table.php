<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What the home page needs to show announcements: a category to filter by and
 * a pin for the one notice the parish wants everyone to see. A post scheduled
 * for later is Published with a future published_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('category', 30)->default('Parish');
            $table->boolean('is_pinned')->default(false);
        });
        DB::statement("ALTER TABLE announcements ADD CONSTRAINT announcements_category_check CHECK (category IN ('Parish', 'Liturgy', 'Sacraments', 'Chapels'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_category_check');
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['category', 'is_pinned']);
        });
    }
};

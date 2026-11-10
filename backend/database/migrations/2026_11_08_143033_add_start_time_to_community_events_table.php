<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The time an event starts, in parish time. Required with no default: no
     * events existed when it was added, so none is left without a time.
     */
    public function up(): void
    {
        Schema::table('community_events', function (Blueprint $table) {
            $table->time('start_time')->after('event_date');
            $table->index(['event_date', 'start_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('community_events', function (Blueprint $table) {
            $table->dropIndex(['event_date', 'start_time']);
            $table->dropColumn('start_time');
        });
    }
};

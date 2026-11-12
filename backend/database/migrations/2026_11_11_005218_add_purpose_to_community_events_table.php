<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Why the event is being held, for the PPC and the priest to weigh. New
     * and edited events must give one; events set up before it was asked for
     * are left without.
     */
    public function up(): void
    {
        Schema::table('community_events', function (Blueprint $table) {
            $table->text('purpose')->nullable()->after('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('community_events', function (Blueprint $table) {
            $table->dropColumn('purpose');
        });
    }
};

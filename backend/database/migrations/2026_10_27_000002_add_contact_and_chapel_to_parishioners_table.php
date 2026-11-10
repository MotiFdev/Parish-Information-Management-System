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
        Schema::table('parishioners', function (Blueprint $table) {
            // Added nullable first so existing rows can be backfilled before NOT NULL applies.
            $table->string('sex', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->integer('chapel_id')->nullable()->index();

            $table->foreign('chapel_id')->references('chapel_id')->on('chapels')
                ->cascadeOnUpdate()->nullOnDelete();
        });

        // gender is kept; sex starts as a copy of it until parish policy says otherwise.
        DB::statement('UPDATE parishioners SET sex = gender WHERE sex IS NULL');
        DB::statement('ALTER TABLE parishioners ALTER COLUMN sex SET NOT NULL');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parishioners', function (Blueprint $table) {
            $table->dropForeign(['chapel_id']);
            $table->dropColumn(['sex', 'email', 'chapel_id']);
        });
    }
};

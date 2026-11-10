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
        Schema::create('sonas', function (Blueprint $table) {
            $table->increments('sona_id');
            $table->string('name', 100)->unique();
        });

        Schema::create('chapels', function (Blueprint $table) {
            $table->increments('chapel_id');
            $table->integer('sona_id')->index();
            $table->string('name', 100);
            $table->string('patron', 100)->nullable();
            // Free text: fiestas are often described as recurring dates ("last Sunday of May").
            $table->string('fiesta_date', 50)->nullable();
            $table->string('contact_number', 20)->nullable();
            $table->string('fb_account_name', 100)->nullable();
            $table->boolean('is_active')->default(true);

            $table->foreign('sona_id')->references('sona_id')->on('sonas')
                ->cascadeOnUpdate()->restrictOnDelete();

            $table->unique(['sona_id', 'name']);
        });

        Schema::create('chapel_officers', function (Blueprint $table) {
            $table->uuid('officer_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->integer('chapel_id')->index();
            // Optional: officers imported from a spreadsheet may not have a parishioner profile yet.
            $table->foreignUuid('parishioner_id')->nullable()->index()
                ->constrained('parishioners', 'parishioner_id')->nullOnDelete();
            $table->string('name', 150);
            $table->string('position', 100);
            $table->string('ministry', 100)->nullable();
            $table->integer('age')->nullable();
            $table->string('fb_account', 100)->nullable();
            $table->string('contact_number', 20)->nullable();
            $table->integer('term_year');

            $table->foreign('chapel_id')->references('chapel_id')->on('chapels')
                ->cascadeOnUpdate()->cascadeOnDelete();

            $table->index(['chapel_id', 'term_year']);
        });

        DB::statement('ALTER TABLE chapel_officers ADD CONSTRAINT chapel_officers_age_check
            CHECK (age IS NULL OR age >= 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chapel_officers');
        Schema::dropIfExists('chapels');
        Schema::dropIfExists('sonas');
    }
};

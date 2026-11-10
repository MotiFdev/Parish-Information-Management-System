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
        Schema::create('sacramental_record_details', function (Blueprint $table) {
            // One-to-one with the register entry; each column applies only to some sacrament types.
            $table->uuid('record_id')->primary();
            $table->date('baptism_date')->nullable();
            $table->string('baptismal_parish', 200)->nullable();

            // Marriage
            $table->string('spouse_baptismal_parish', 200)->nullable();
            $table->string('license_number', 50)->nullable();
            $table->date('civil_marriage_date')->nullable();
            $table->string('civil_marriage_place', 200)->nullable();

            // Burial
            $table->date('date_of_death')->nullable();
            $table->integer('age_at_death')->nullable();
            $table->string('place_of_death', 200)->nullable();
            $table->string('cause_of_death', 200)->nullable();
            $table->string('civil_status', 30)->nullable();
            $table->string('spouse_name', 200)->nullable();
            $table->date('funeral_mass_date')->nullable();
            $table->string('burial_place', 200)->nullable();
            // The informant is kept apart from the deceased's own details.
            $table->string('informant_name', 200)->nullable();
            $table->string('informant_relationship', 50)->nullable();
            $table->string('informant_contact', 20)->nullable();
            $table->string('informant_address', 300)->nullable();

            $table->foreign('record_id')->references('record_id')->on('sacramental_records')
                ->cascadeOnDelete();
        });

        DB::statement('ALTER TABLE sacramental_record_details ADD CONSTRAINT sacramental_record_details_age_check
            CHECK (age_at_death IS NULL OR age_at_death >= 0)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sacramental_record_details');
    }
};

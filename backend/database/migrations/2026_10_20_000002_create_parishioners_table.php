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
        Schema::create('parishioners', function (Blueprint $table) {
            $table->uuid('parishioner_id')->primary()->default(DB::raw('gen_random_uuid()'));
            // Unique: a portal account links to at most one parishioner profile.
            $table->foreignUuid('user_id')->nullable()->unique()
                ->constrained('users', 'user_id')->nullOnDelete();
            $table->string('first_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100);
            $table->string('suffix', 20)->nullable();
            $table->string('gender', 10);
            $table->date('date_of_birth');
            $table->string('place_of_birth', 150);
            $table->string('contact_number', 20)->nullable();
            $table->string('address_street', 150);
            $table->string('address_barangay', 100);
            $table->string('address_city', 100);
            $table->uuid('father_parishioner_id')->nullable()->index();
            $table->uuid('mother_parishioner_id')->nullable()->index();
            $table->boolean('is_archived')->default(false)->index();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->index(['last_name', 'first_name']);
        });

        // Self-references must be added after the table exists so the primary key is in place.
        Schema::table('parishioners', function (Blueprint $table) {
            $table->foreign('father_parishioner_id')->references('parishioner_id')->on('parishioners')
                ->nullOnDelete();
            $table->foreign('mother_parishioner_id')->references('parishioner_id')->on('parishioners')
                ->nullOnDelete();
        });

        DB::statement('ALTER TABLE parishioners ADD CONSTRAINT parishioners_father_not_self_check
            CHECK (father_parishioner_id IS NULL OR father_parishioner_id <> parishioner_id)');
        DB::statement('ALTER TABLE parishioners ADD CONSTRAINT parishioners_mother_not_self_check
            CHECK (mother_parishioner_id IS NULL OR mother_parishioner_id <> parishioner_id)');
        DB::statement('ALTER TABLE parishioners ADD CONSTRAINT parishioners_distinct_parents_check
            CHECK (father_parishioner_id IS NULL OR father_parishioner_id IS DISTINCT FROM mother_parishioner_id)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parishioners');
    }
};

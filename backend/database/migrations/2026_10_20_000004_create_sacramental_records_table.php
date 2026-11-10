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
        Schema::create('sacramental_records', function (Blueprint $table) {
            $table->uuid('record_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->integer('sacrament_type_id')->index();
            $table->foreignUuid('primary_parishioner_id')->index()
                ->constrained('parishioners', 'parishioner_id')->restrictOnDelete();
            $table->foreignUuid('secondary_parishioner_id')->nullable()->index()
                ->constrained('parishioners', 'parishioner_id')->restrictOnDelete();
            $table->string('officiating_minister', 150);
            $table->date('event_date')->index();
            $table->string('book_number', 50);
            $table->string('page_number', 50);
            $table->string('line_number', 50);
            $table->text('remarks')->nullable();
            $table->foreignUuid('created_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('sacrament_type_id')->references('sacrament_type_id')->on('sacrament_types')
                ->cascadeOnUpdate()->restrictOnDelete();

            // One register line holds one entry per sacrament register.
            $table->unique(
                ['sacrament_type_id', 'book_number', 'page_number', 'line_number'],
                'sacramental_records_register_entry_unique'
            );
        });

        DB::statement('ALTER TABLE sacramental_records ADD CONSTRAINT sacramental_records_distinct_parties_check
            CHECK (secondary_parishioner_id IS NULL OR secondary_parishioner_id <> primary_parishioner_id)');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sacramental_records');
    }
};

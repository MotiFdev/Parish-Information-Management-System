<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Offerings and fees the parish receives (Sunday collections, Mass intentions,
 * stole fees, certificate fees, donations), entered by staff or the priest.
 * The priest's Financial report adds them up.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offerings', function (Blueprint $table) {
            $table->uuid('offering_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('category', 80);
            $table->string('description', 255)->nullable();
            $table->decimal('amount', 12, 2);
            $table->date('received_on')->index();
            $table->foreignUuid('recorded_by_user_id')->nullable()->constrained('users', 'user_id')->nullOnDelete();
            $table->timestampsTz();
        });
        DB::statement('ALTER TABLE offerings ADD CONSTRAINT offerings_amount_positive CHECK (amount > 0)');
    }

    public function down(): void
    {
        Schema::dropIfExists('offerings');
    }
};

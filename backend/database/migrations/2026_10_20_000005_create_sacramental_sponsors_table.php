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
        Schema::create('sacramental_sponsors', function (Blueprint $table) {
            $table->uuid('sponsor_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('record_id')->index()
                ->constrained('sacramental_records', 'record_id')->cascadeOnDelete();
            $table->string('sponsor_name', 150);
            $table->string('sponsor_type', 50);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sacramental_sponsors');
    }
};

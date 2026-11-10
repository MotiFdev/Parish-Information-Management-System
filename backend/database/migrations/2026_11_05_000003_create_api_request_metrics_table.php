<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per API request with how long it took, for the dashboard's response
 * time chart. Rows older than a day are pruned by App\Services\ApiLatency.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_request_metrics', function (Blueprint $table) {
            $table->id();
            $table->timestampTz('recorded_at')->useCurrent()->index();
            $table->unsignedInteger('duration_ms');
            $table->unsignedSmallInteger('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_request_metrics');
    }
};

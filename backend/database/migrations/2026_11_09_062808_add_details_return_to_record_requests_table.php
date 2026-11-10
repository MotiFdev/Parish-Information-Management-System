<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staff can send a request back for the requester to correct the details they
 * typed. While details_returned_at is set the request can't go to the priest;
 * the requester's fix clears it and stamps details_updated_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('record_requests', function (Blueprint $table) {
            $table->timestampTz('details_returned_at')->nullable();
            $table->text('details_return_note')->nullable();
            $table->timestampTz('details_updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('record_requests', function (Blueprint $table) {
            $table->dropColumn(['details_returned_at', 'details_return_note', 'details_updated_at']);
        });
    }
};

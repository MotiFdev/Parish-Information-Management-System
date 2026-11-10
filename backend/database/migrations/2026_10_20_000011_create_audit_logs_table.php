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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('log_id')->primary()->default(DB::raw('gen_random_uuid()'));
            // Nullable for events with no signed-in actor, such as a failed login.
            // Restrict: a user with audit history is deactivated, never deleted.
            $table->foreignUuid('user_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->string('action', 100)->index();
            $table->string('table_affected', 100);
            $table->string('record_id_affected', 100);
            $table->string('ip_address', 45);
            $table->jsonb('details')->nullable();
            $table->timestampTz('timestamp')->useCurrent()->index();

            $table->index(['table_affected', 'record_id_affected']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};

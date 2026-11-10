<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The parish notification log, not the table Laravel's database channel expects.
     */
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('notification_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('user_id')
                ->constrained('users', 'user_id')->cascadeOnDelete();
            $table->foreignUuid('request_id')->nullable()->index()
                ->constrained('record_requests', 'request_id')->cascadeOnDelete();
            $table->foreignUuid('appointment_id')->nullable()->index()
                ->constrained('appointments_and_events', 'appointment_id')->cascadeOnDelete();
            $table->text('message');
            $table->string('channel', 20)->default('in_app');
            $table->boolean('is_read')->default(false);
            $table->timestampTz('created_at')->useCurrent();

            // The inbox query: a user's unread notifications, newest first.
            $table->index(['user_id', 'is_read', 'created_at']);
        });

        DB::statement("ALTER TABLE notifications ADD CONSTRAINT notifications_channel_check
            CHECK (channel IN ('in_app', 'email'))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};

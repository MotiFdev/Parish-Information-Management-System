<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Events an administrator should look at, raised by App\Services\SecurityAlerts
 * (repeated failed sign-ins, privileged sign-ins from a new address). They stay
 * on the dashboard until someone marks them reviewed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('security_alerts', function (Blueprint $table) {
            $table->uuid('alert_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('type', 50)->index();
            $table->string('severity', 10);
            $table->string('title', 200);
            $table->text('detail');
            $table->string('ip_address', 45);
            // The account the alert is about, when there is one.
            $table->foreignUuid('user_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            // Groups repeats of the same event so one burst of failures is one alert.
            $table->string('dedupe_key', 200)->index();
            $table->unsignedInteger('occurrences')->default(1);
            $table->timestampTz('first_seen_at')->useCurrent();
            $table->timestampTz('last_seen_at')->useCurrent()->index();
            $table->timestampTz('reviewed_at')->nullable()->index();
            $table->foreignUuid('reviewed_by_user_id')->nullable()
                ->constrained('users', 'user_id')->restrictOnDelete();
        });

        DB::statement("ALTER TABLE security_alerts ADD CONSTRAINT security_alerts_severity_check CHECK (severity IN ('high', 'review'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('security_alerts');
    }
};

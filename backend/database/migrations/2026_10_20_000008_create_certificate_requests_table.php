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
        Schema::create('certificate_requests', function (Blueprint $table) {
            $table->uuid('request_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->foreignUuid('requested_by_user_id')->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->integer('sacrament_type_id')->index();
            // Nullable: a parishioner submits the request; staff link the matching record during review.
            $table->foreignUuid('record_id')->nullable()->index()
                ->constrained('sacramental_records', 'record_id')->restrictOnDelete();
            $table->text('purpose');
            $table->string('status', 50)->default('Pending')->index();
            $table->foreignUuid('approved_by_priest_id')->nullable()->index()
                ->constrained('users', 'user_id')->restrictOnDelete();
            $table->timestampTz('requested_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('sacrament_type_id')->references('sacrament_type_id')->on('sacrament_types')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        DB::statement("ALTER TABLE certificate_requests ADD CONSTRAINT certificate_requests_status_check
            CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Ready for Collection'))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificate_requests');
    }
};

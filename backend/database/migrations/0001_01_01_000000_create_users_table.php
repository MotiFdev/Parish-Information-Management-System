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
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('user_id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->integer('role_id')->index();
            $table->string('email', 150);
            $table->string('username', 50);
            $table->string('password_hash', 255);
            $table->boolean('is_active')->default(true);
            $table->timestampTz('last_login')->nullable();
            $table->rememberToken();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('role_id')->references('role_id')->on('roles')
                ->cascadeOnUpdate()->restrictOnDelete();
        });

        // Case-insensitive uniqueness so "Juan@x.com" and "juan@x.com" cannot be two accounts.
        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email))');
        DB::statement('CREATE UNIQUE INDEX users_username_unique ON users (LOWER(username))');

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};

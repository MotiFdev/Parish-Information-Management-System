<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a file kept on a parishioner's record (or not filed yet) is: Valid ID,
 * Birth Certificate, and so on. Request uploads keep their label on
 * request_documents; register scans are "Register scan".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('label', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('label');
        });
    }
};

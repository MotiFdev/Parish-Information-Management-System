<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A profile picture for chapel officers, shown in the portals and on the
 * public Chapels page. Stored like account photos: a random file name on the
 * local disk, served by the profile-photos route.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chapel_officers', function (Blueprint $table) {
            $table->string('photo_path', 255)->nullable()->after('contact_number');
        });
    }

    public function down(): void
    {
        Schema::table('chapel_officers', function (Blueprint $table) {
            $table->dropColumn('photo_path');
        });
    }
};

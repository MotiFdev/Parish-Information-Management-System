<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::ensureVectorExtensionExists();
    }

    /**
     * Reverse the migrations.
     *
     * The extension is left installed: other databases or a later migration
     * may depend on it, and dropping it would destroy every vector column.
     */
    public function down(): void
    {
        //
    }
};

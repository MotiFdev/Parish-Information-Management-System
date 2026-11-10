<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([ReferenceDataSeeder::class, ParishStructureSeeder::class, AdminUserSeeder::class, PortalUserSeeder::class, ChapelDirectorySeeder::class, ParishionerDirectorySeeder::class, SacramentalRegisterSeeder::class, DocumentSampleSeeder::class, AnnouncementSampleSeeder::class]);
    }
}

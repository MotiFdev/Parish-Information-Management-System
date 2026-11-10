<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * The parish's Sonas and their chapels, so parishioners can pick theirs on
 * My Profile. Sona names are the examples in the specification (section 7.8);
 * the chapels, patrons, and fiesta dates match the portal's sample data and
 * should be confirmed with the parish office. Safe to re-run: rows are matched
 * by name and never duplicated.
 */
class ParishStructureSeeder extends Seeder
{
    /** @var array<string, list<array{name: string, patron: string, fiesta: string}>> */
    private const SONAS = [
        'Sona San Isidro Labrador' => [
            ['name' => 'San Isidro Labrador Chapel', 'patron' => 'San Isidro Labrador', 'fiesta' => 'May 15'],
        ],
        'Sona Birhen sa Fatima' => [
            ['name' => 'Our Lady of Fatima Chapel', 'patron' => 'Our Lady of Fatima', 'fiesta' => 'May 13'],
        ],
        'Sona Birhen sa Carmen' => [
            ['name' => 'Our Lady of Mount Carmel Chapel', 'patron' => 'Our Lady of Mount Carmel', 'fiesta' => 'July 16'],
        ],
        'Sona San Ignacio de Loyola' => [
            ['name' => 'San Ignacio Chapel', 'patron' => 'San Ignacio de Loyola', 'fiesta' => 'July 31'],
            ['name' => 'San Lorenzo Ruiz Chapel', 'patron' => 'San Lorenzo Ruiz', 'fiesta' => 'Last Sunday of September'],
        ],
        'Sona San Antonio de Padua' => [
            ['name' => 'San Antonio de Padua Chapel', 'patron' => 'San Antonio de Padua', 'fiesta' => 'June 13'],
        ],
        "Sona Inahan sa Kanunay'ng Panabang" => [
            ['name' => 'Perpetual Help Chapel', 'patron' => 'Our Mother of Perpetual Help', 'fiesta' => 'June 27'],
        ],
    ];

    public function run(): void
    {
        foreach (self::SONAS as $sonaName => $chapels) {
            DB::table('sonas')->updateOrInsert(['name' => $sonaName]);
            $sonaId = DB::table('sonas')->where('name', $sonaName)->value('sona_id');

            foreach ($chapels as $chapel) {
                $exists = DB::table('chapels')->where('sona_id', $sonaId)->where('name', $chapel['name'])->exists();
                // Only fill in new chapels: details the office has since edited stay as they are.
                if (! $exists) {
                    DB::table('chapels')->insert([
                        'sona_id' => $sonaId,
                        'name' => $chapel['name'],
                        'patron' => $chapel['patron'],
                        'fiesta_date' => $chapel['fiesta'],
                        'is_active' => true,
                        // The parish's own list, so it needs no PPC approval.
                        'approval_status' => 'Approved',
                    ]);
                }
            }
        }
    }
}

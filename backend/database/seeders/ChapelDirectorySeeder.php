<?php

namespace Database\Seeders;

use App\Enums\ApprovalStatus;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\Sona;
use Illuminate\Database\Seeder;

/**
 * Sample chapel contacts and officer councils for trying the public Chapels
 * page and the portals locally. It is the same data the page used to show
 * from frontend/src/features/community/chapels/chapelsData.ts. Runs only when
 * APP_ENV=local, because the names and numbers are made up. Safe to re-run:
 * chapel contacts are filled in only where empty, and an officer is added only
 * if the chapel has nobody by that name for that term.
 */
class ChapelDirectorySeeder extends Seeder
{
    private const CURRENT_TERM = 2026;

    /**
     * In the order the sample data numbers them (c1 to c7); the index feeds the generated names.
     *
     * @var list<array{sona: string, chapel: string, contact: string, fb: string, president: array{0: string, 1: string}}>
     */
    private const CHAPELS = [
        ['sona' => 'Sona San Isidro Labrador', 'chapel' => 'San Isidro Labrador Chapel', 'contact' => '0917 000 5101', 'fb' => 'San Isidro Labrador Chapel', 'president' => ['Ramon Aquino', '0917 000 6101']],
        ['sona' => 'Sona Birhen sa Fatima', 'chapel' => 'Our Lady of Fatima Chapel', 'contact' => '0917 000 5102', 'fb' => 'Fatima Chapel Sacred Heart', 'president' => ['Carmen Villareal', '0917 000 6102']],
        ['sona' => 'Sona Birhen sa Carmen', 'chapel' => 'Our Lady of Mount Carmel Chapel', 'contact' => '0917 000 5103', 'fb' => 'Mount Carmel Chapel', 'president' => ['Edgar Morales', '0917 000 6103']],
        ['sona' => 'Sona San Ignacio de Loyola', 'chapel' => 'San Ignacio Chapel', 'contact' => '0917 000 5104', 'fb' => 'San Ignacio Chapel', 'president' => ['Teresa Navarro', '0917 000 6104']],
        ['sona' => 'Sona San Ignacio de Loyola', 'chapel' => 'San Lorenzo Ruiz Chapel', 'contact' => '0917 000 5105', 'fb' => 'San Lorenzo Ruiz Chapel', 'president' => ['Benjie Castillo', '0917 000 6105']],
        ['sona' => 'Sona San Antonio de Padua', 'chapel' => 'San Antonio de Padua Chapel', 'contact' => '0917 000 5106', 'fb' => 'San Antonio de Padua Chapel', 'president' => ['Lorna Cruz', '0917 000 6106']],
        ['sona' => "Sona Inahan sa Kanunay'ng Panabang", 'chapel' => 'Perpetual Help Chapel', 'contact' => '0917 000 5107', 'fb' => 'Perpetual Help Chapel', 'president' => ['Dennis Lopez', '0917 000 6107']],
    ];

    /** Last year's councils for two chapels, so earlier terms can be browsed: chapel index => president. */
    private const PREVIOUS_TERM_PRESIDENTS = [
        0 => ['Nestor Bautista', '0917 000 6201'],
        2 => ['Edgar Morales', '0917 000 6103'],
    ];

    private const FIRST_NAMES = ['Rosario', 'Danilo', 'Marites', 'Rogelio', 'Imelda', 'Arnel', 'Luzviminda', 'Noel', 'Josefina', 'Ernesto', 'Cecilia', 'Reynaldo', 'Gloria', 'Jun', 'Analyn', 'Felipe', 'Rowena', 'Gerardo', 'Nenita', 'Wilfredo', 'Jocelyn', 'Ariel', 'Maricar', 'Bong'];

    private const LAST_NAMES = ['Dela Cruz', 'Bautista', 'Mendoza', 'Ramos', 'Garcia', 'Flores', 'Villanueva', 'Santiago', 'Pascual', 'Torres', 'Domingo', 'Salazar', 'Fernandez', 'Lim', 'Manalo', 'Ocampo'];

    /** The roles each council fills after the president, so every position and ministry appears. */
    private const COUNCIL = [
        ['V-President', null],
        ['Secretary', null],
        ['Treasurer', null],
        ['Auditor', null],
        ['Coordinator', 'Worship'],
        ['Coordinator', 'Evangelization'],
        ['Coordinator', 'Social Services'],
        ['Coordinator', 'Youth/Vocation'],
        ['Member', 'Temporalities'],
        ['Member', 'Organizing'],
    ];

    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        foreach (self::CHAPELS as $index => $row) {
            $chapel = $this->chapel($row['sona'], $row['chapel']);
            if (! $chapel) {
                $this->command?->warn("{$row['chapel']} is missing; run ParishStructureSeeder first.");

                continue;
            }

            $chapel->fill([
                'contact_number' => $chapel->contact_number ?: $row['contact'],
                'fb_account_name' => $chapel->fb_account_name ?: $row['fb'],
            ])->save();

            $this->council($chapel, $index, self::CURRENT_TERM, $row['president']);
            if (isset(self::PREVIOUS_TERM_PRESIDENTS[$index])) {
                $this->council($chapel, $index, self::CURRENT_TERM - 1, self::PREVIOUS_TERM_PRESIDENTS[$index]);
            }
        }

        // One inactive chapel, so the portals' status filter has something to show.
        $sonaId = Sona::query()->where('name', 'Sona Birhen sa Carmen')->value('sona_id');
        if ($sonaId) {
            Chapel::query()->firstOrCreate(
                ['sona_id' => $sonaId, 'name' => 'Santo Niño Chapel (old site)'],
                ['patron' => 'Santo Niño', 'fiesta_date' => 'Third Sunday of January', 'is_active' => false, 'approval_status' => ApprovalStatus::Approved],
            );
        }
    }

    private function chapel(string $sonaName, string $chapelName): ?Chapel
    {
        return Chapel::query()
            ->whereHas('sona', fn ($q) => $q->where('name', $sonaName))
            ->where('name', $chapelName)
            ->first();
    }

    /**
     * Generated the same way as the sample data, so the page shows the same people.
     *
     * @param  array{0: string, 1: string}  $president
     */
    private function council(Chapel $chapel, int $chapelIndex, int $term, array $president): void
    {
        [$presidentName, $presidentContact] = $president;
        $rows = [[
            'name' => $presidentName,
            'position' => 'President',
            'ministry' => null,
            'age' => 48 + $chapelIndex,
            'fb_account' => $presidentName,
            'contact_number' => $presidentContact,
        ]];

        foreach (self::COUNCIL as $i => [$position, $ministry]) {
            $n = $chapelIndex * 11 + $i + (self::CURRENT_TERM - $term) * 5;
            $name = self::FIRST_NAMES[($n * 7 + 3) % count(self::FIRST_NAMES)].' '.self::LAST_NAMES[($n * 5 + $chapelIndex) % count(self::LAST_NAMES)];
            $rows[] = [
                'name' => $name,
                'position' => $position,
                'ministry' => $ministry,
                // Youth coordinators read younger; the rest spread over a council's usual ages.
                'age' => $ministry === 'Youth/Vocation' ? 21 + ($n % 6) : 30 + (($n * 13) % 38),
                'fb_account' => $i % 3 === 2 ? null : $name,
                'contact_number' => $i % 4 === 3 ? null : '0918 000 '.str_pad((string) (7000 + $chapelIndex * 20 + $i), 4, '0', STR_PAD_LEFT),
            ];
        }

        foreach ($rows as $row) {
            ChapelOfficer::query()->firstOrCreate(
                ['chapel_id' => $chapel->chapel_id, 'term_year' => $term, 'name' => $row['name']],
                [...$row, 'approval_status' => ApprovalStatus::Approved],
            );
        }
    }
}

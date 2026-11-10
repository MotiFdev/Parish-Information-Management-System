<?php

namespace Database\Seeders;

use App\Models\Chapel;
use App\Models\Parishioner;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Sample households for trying the staff Parishioners directory locally: the
 * same families the page used to show from
 * frontend/src/features/staff/parishioners/parishionerData.ts, generated from
 * the same fixed seed. Runs only when APP_ENV=local, because every name is
 * made up. Safe to re-run: a person with the same name and birth date is
 * reused, not added again.
 */
class ParishionerDirectorySeeder extends Seeder
{
    private const LAST = ['Santos', 'Dela Cruz', 'Reyes', 'Garcia', 'Mendoza', 'Ramos', 'Navarro', 'Lopez', 'Castillo', 'Villanueva', 'Bautista', 'Domingo', 'Pascual', 'Soriano', 'Valdez', 'Aquino', 'Flores', 'Morales', 'Villareal', 'Cruz', 'Gonzales', 'Salazar'];

    private const MALE = ['Jose', 'Juan', 'Miguel', 'Paolo', 'Carlo', 'Ramon', 'Dennis', 'Arnel', 'Edgar', 'Victor', 'Roberto', 'Benjie', 'Ricardo', 'Mark', 'Joshua', 'Gabriel', 'Andres', 'Pedro'];

    private const FEMALE = ['Maria', 'Teresa', 'Andrea', 'Liza', 'Grace', 'Carmen', 'Rosario', 'Jocelyn', 'Nina', 'Lorna', 'Angela', 'Maricel', 'Elena', 'Rosa', 'Kristine', 'Patricia', 'Joy', 'Bea'];

    private const STREETS = ['Mabini St.', 'Rizal Ave.', 'Bonifacio St.', 'Luna St.', 'Del Pilar St.', 'Quezon Ave.'];

    private const BARANGAYS = ['Brgy. San Isidro', 'Brgy. Poblacion', 'Brgy. Santa Cruz', 'Brgy. San Roque', 'Brgy. Bagong Silang'];

    private const PLACES = ['San Miguel', 'Malolos', 'Quezon City', 'Manila', 'Cebu City'];

    /** The frontend's Sonas, in order, each with its chapels (by name in the chapels table). */
    private const SONAS = [
        ['San Isidro Labrador Chapel'],
        ['Our Lady of Fatima Chapel'],
        ['Our Lady of Mount Carmel Chapel'],
        ['San Ignacio Chapel', 'San Lorenzo Ruiz Chapel'],
        ['San Antonio de Padua Chapel'],
        ['Perpetual Help Chapel'],
    ];

    private int $state = 0;

    /** @var list<array<string, mixed>> */
    private array $people = [];

    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $chapelIds = Chapel::query()->pluck('chapel_id', 'name');
        $added = 0;
        $ids = [];
        foreach ($this->build() as $i => $p) {
            $p['chapel_id'] = $chapelIds[$p['chapel']] ?? null;
            $p['father_parishioner_id'] = $p['father'] !== null ? $ids[$p['father']] : null;
            $p['mother_parishioner_id'] = $p['mother'] !== null ? $ids[$p['mother']] : null;
            unset($p['chapel'], $p['father'], $p['mother']);

            $person = Parishioner::query()->firstOrCreate(
                ['first_name' => $p['first_name'], 'last_name' => $p['last_name'], 'date_of_birth' => $p['date_of_birth']],
                $p,
            );
            $added += $person->wasRecentlyCreated ? 1 : 0;
            $ids[$i] = $person->parishioner_id;
        }

        $this->command?->info("Added {$added} sample parishioners.");
    }

    /**
     * A PHP port of the frontend's generator; the order of random draws matches it exactly.
     *
     * @return list<array<string, mixed>>
     */
    private function build(): array
    {
        $this->state = 7;
        $this->people = [];

        $mariaHome = ['address_street' => 'Purok 3, Mabini St.', 'address_barangay' => 'Brgy. San Isidro', 'address_city' => 'San Miguel', 'chapel' => self::SONAS[0][0]];
        $ramon = $this->person(['first_name' => 'Ramon', 'middle_name' => 'Cruz', 'last_name' => 'Santos', 'sex' => 'Male', 'date_of_birth' => '1984-03-12', 'father' => null, 'mother' => null, ...$mariaHome]);
        $maria = $this->person(['first_name' => 'Maria', 'middle_name' => 'Lopez', 'last_name' => 'Santos', 'sex' => 'Female', 'date_of_birth' => '1986-07-21', 'father' => null, 'mother' => null, ...$mariaHome, 'email' => 'maria.santos@example.com', 'contact_number' => '0917 555 0142']);
        $this->person(['first_name' => 'Juan', 'middle_name' => 'Lopez', 'last_name' => 'Santos', 'sex' => 'Male', 'date_of_birth' => '2012-09-04', 'father' => $ramon, 'mother' => $maria, ...$mariaHome]);
        $this->person(['first_name' => 'Ana', 'middle_name' => 'Lopez', 'last_name' => 'Santos', 'sex' => 'Female', 'date_of_birth' => '2016-02-18', 'father' => $ramon, 'mother' => $maria, ...$mariaHome]);

        for ($f = 0; $f < 22; $f++) {
            $last = self::LAST[$f % count(self::LAST)];
            $sona = self::SONAS[$f % count(self::SONAS)];
            $chapel = $sona[$f % count($sona)];
            $street = (10 + $f * 3).' '.$this->pick(self::STREETS);
            $home = ['address_street' => $street, 'address_barangay' => $this->pick(self::BARANGAYS), 'address_city' => 'San Miguel', 'chapel' => $chapel];
            $fy = 1955 + (int) floor($this->rnd() * 40);
            $father = $this->person(['first_name' => $this->pick(self::MALE), 'middle_name' => $this->pick(self::LAST), 'last_name' => $last, 'sex' => 'Male', 'date_of_birth' => $this->date($fy), 'father' => null, 'mother' => null, ...$home]);
            $motherFirst = $this->pick(self::FEMALE);
            $motherMiddle = $this->pick(self::LAST);
            $motherYear = $fy + 1 + (int) floor($this->rnd() * 4);
            $mother = $this->person(['first_name' => $motherFirst, 'middle_name' => $motherMiddle, 'last_name' => $last, 'sex' => 'Female', 'date_of_birth' => $this->date($motherYear), 'father' => null, 'mother' => null, ...$home]);
            $kids = 1 + (int) floor($this->rnd() * 3);
            for ($k = 0; $k < $kids; $k++) {
                $male = $this->rnd() < 0.5;
                $ky = min(2024, $fy + 24 + $k * 3 + (int) floor($this->rnd() * 3));
                $parentFirst = $male ? $this->people[$father]['first_name'] : $this->people[$mother]['first_name'];
                do {
                    $first = $male ? $this->pick(self::MALE) : $this->pick(self::FEMALE);
                } while ($first === $parentFirst);
                $born = $this->date($ky);
                $suffix = $male && $k === 0 && $this->rnd() < 0.2 ? 'Jr.' : null;
                $this->person([
                    'first_name' => $first, 'middle_name' => $this->people[$mother]['middle_name'], 'last_name' => $last,
                    'sex' => $male ? 'Male' : 'Female', 'date_of_birth' => $born, 'father' => $father, 'mother' => $mother, ...$home,
                    'suffix' => $suffix,
                ]);
            }
        }

        // A few moved away or died; they are archived, not deleted.
        foreach ([9, 27, 44] as $i) {
            if (isset($this->people[$i])) {
                $this->people[$i]['is_archived'] = true;
            }
        }

        return $this->people;
    }

    /**
     * Adds a person and returns their index; draws the place of birth and (for adults) the email chance, as the frontend does.
     *
     * @param  array<string, mixed>  $p
     */
    private function person(array $p): int
    {
        $n = count($this->people) + 1;
        $adult = CarbonImmutable::parse($p['date_of_birth'])->age >= 18;
        $place = $this->pick(self::PLACES);
        $hasEmail = $adult && $this->rnd() < 0.6;
        $this->people[] = [
            'suffix' => null,
            'place_of_birth' => $place,
            'contact_number' => $adult ? '0917 000 '.substr((string) (2000 + $n * 23), -4) : null,
            'email' => $hasEmail ? strtolower(str_replace(' ', '', "{$p['first_name']}.{$p['last_name']}")).'@example.com' : null,
            'is_archived' => false,
            ...$p,
        ];

        return count($this->people) - 1;
    }

    private function date(int $year): string
    {
        $month = 1 + (int) floor($this->rnd() * 12);
        $day = 1 + (int) floor($this->rnd() * 27);

        return sprintf('%d-%02d-%02d', $year, $month, $day);
    }

    /**
     * @param  list<string>  $xs
     */
    private function pick(array $xs): string
    {
        return $xs[(int) floor($this->rnd() * count($xs))];
    }

    /** Mulberry32, matching the frontend's seeded() bit for bit. */
    private function rnd(): float
    {
        $this->state = $this->int32($this->state + 0x6D2B79F5);
        $a = $this->state;
        $t = $this->imul($a ^ $this->ushr($a, 15), 1 | $a);
        $t = $this->int32($this->int32($t + $this->imul($t ^ $this->ushr($t, 7), 61 | $t)) ^ $t);

        return ($this->int32($t ^ $this->ushr($t, 14)) & 0xFFFFFFFF) / 4294967296;
    }

    private function int32(int $x): int
    {
        $x &= 0xFFFFFFFF;

        return $x >= 0x80000000 ? $x - 0x100000000 : $x;
    }

    private function ushr(int $x, int $bits): int
    {
        return ($x & 0xFFFFFFFF) >> $bits;
    }

    private function imul(int $a, int $b): int
    {
        $a &= 0xFFFFFFFF;
        $b &= 0xFFFFFFFF;
        $low = ($a & 0xFFFF) * ($b & 0xFFFF);
        $high = ((($a >> 16) * ($b & 0xFFFF) + ($a & 0xFFFF) * ($b >> 16)) & 0xFFFF) << 16;

        return $this->int32($low + $high);
    }
}

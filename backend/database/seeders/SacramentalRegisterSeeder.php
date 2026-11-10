<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\SacramentalRecord;
use App\Models\SacramentalRecordCorrection;
use App\Models\User;
use App\Services\SacramentalRegister;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Sample register entries for trying Sacramental Records locally: the same
 * entries the page used to show from frontend/src/features/priest/registerData.ts,
 * generated from the same fixed seeds. Runs only when APP_ENV=local, because
 * every name is made up. Safe to re-run: a place in a book that already holds
 * an entry is skipped.
 */
class SacramentalRegisterSeeder extends Seeder
{
    private const FIRST_M = ['Jose', 'Juan', 'Miguel', 'Paolo', 'Carlo', 'Ramon', 'Dennis', 'Arnel', 'Edgar', 'Victor', 'Roberto', 'Antonio', 'Rafael', 'Benjie', 'Ricardo', 'Mark', 'Joshua', 'Gabriel'];

    private const FIRST_F = ['Maria', 'Teresa', 'Andrea', 'Liza', 'Grace', 'Carmen', 'Rosario', 'Jocelyn', 'Nina', 'Lorna', 'Angela', 'Maricel', 'Elena', 'Rosa', 'Kristine', 'Patricia', 'Joy', 'Bea'];

    private const LAST = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Ramos', 'Navarro', 'Lopez', 'Castillo', 'Villanueva', 'Bautista', 'Domingo', 'Pascual', 'Soriano', 'Valdez', 'Aquino', 'Flores', 'Morales', 'Gonzaga', 'Lim', 'Tan', 'Uy'];

    private const PARISH = 'Sacred Heart of Jesus Parish';

    private int $state = 0;

    public function __construct(private SacramentalRegister $register) {}

    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $by = User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::ParishStaff->value))->first()
            ?? User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::SystemAdministrator->value))->first();
        if (! $by) {
            $this->command?->warn('No staff or admin account to record the entries under; run PortalUserSeeder first.');

            return;
        }

        $added = 0;
        foreach ([['Baptism', 34, 11], ['Confirmation', 22, 23], ['Marriage', 18, 37], ['Burial', 21, 41]] as [$type, $count, $seed]) {
            foreach ($this->build($type, $count, $seed) as $entry) {
                $added += $this->add($type, $entry, $by) ? 1 : 0;
            }
        }

        foreach ($this->named() as $entry) {
            $added += $this->add('Baptism', $entry, $by) ? 1 : 0;
        }

        // The corrected entry the sample audit log refers to.
        $corrected = $this->add('Baptism', [
            'place' => [12, 48, 3],
            'values' => $this->baptismValues('Elena Santos Dela Cruz', 'Female', '2019-05-02', '2019-06-18', 'Ramon Dela Cruz', 'Maria Santos Dela Cruz', 'Victor Tan, Rosa Uy', 'Fr. Antonio Reyes'),
        ], $by);
        if ($corrected) {
            $added++;
            $corrected->forceFill(['is_corrected' => true])->save();
            $priest = User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::ParishPriest->value))->first() ?? $by;
            SacramentalRecordCorrection::query()->create([
                'record_id' => $corrected->record_id,
                'proposed_values' => $this->register->valuesOf($corrected->load(SacramentalRegister::relations())),
                'changes' => [['field' => 'Mother', 'from' => 'Maria Santos', 'to' => 'Maria Santos Dela Cruz']],
                'status' => 'Approved',
                'requested_by_user_id' => $by->user_id,
                'reviewed_by_user_id' => $priest->user_id,
                'reviewed_at' => CarbonImmutable::parse('2026-10-31 10:00', 'Asia/Manila'),
            ]);
        }

        $this->command?->info("Added {$added} sample register entries.");
    }

    /**
     * @param  array{place: array{0: int, 1: int, 2: int}, values: array<string, string>}  $entry
     */
    private function add(string $type, array $entry, User $by): ?SacramentalRecord
    {
        [$book, $page, $line] = array_map('strval', $entry['place']);
        $taken = SacramentalRecord::query()
            ->whereHas('sacramentType', fn ($q) => $q->where('name', $type))
            ->where('book_number', $book)->where('page_number', $page)->where('line_number', $line)
            ->exists();

        return $taken ? null : DB::transaction(fn () => $this->register->create($type, ['book' => $book, 'page' => $page, 'line' => $line], $entry['values'], $by));
    }

    /**
     * @return array<string, string>
     */
    private function baptismValues(string $name, string $sex, string $birth, string $date, string $father, string $mother, string $godparents, string $minister): array
    {
        return [
            'baptized' => $name, 'sex' => $sex, 'date_of_birth' => $birth, 'date_of_baptism' => $date,
            'place_of_baptism' => self::PARISH, 'minister' => $minister, 'father' => $father, 'mother' => $mother, 'godparents' => $godparents,
        ];
    }

    /**
     * Named entries other sample pages point at.
     *
     * @return list<array{place: array{0: int, 1: int, 2: int}, values: array<string, string>}>
     */
    private function named(): array
    {
        return [
            ['place' => [1, 112, 4], 'values' => $this->baptismValues('Juan Miguel Dela Cruz', 'Male', '1987-02-14', '1987-03-22', 'Pedro Dela Cruz', 'Lourdes Dela Cruz (née Santos)', 'Ramon Aquino, Carmen Flores', 'Fr. Jose Ramirez')],
            ['place' => [2, 9, 6], 'values' => $this->baptismValues('Juan Dela Cruz', 'Male', '1987-12-03', '1988-01-17', 'Andres Dela Cruz', 'Rosa Dela Cruz (née Ramos)', 'Victor Tan, Elena Uy', 'Fr. Jose Ramirez')],
        ];
    }

    /**
     * A PHP port of the frontend's generator, so the books hold the same people.
     *
     * @return list<array{place: array{0: int, 1: int, 2: int}, values: array<string, string>}>
     */
    private function build(string $type, int $count, int $seed): array
    {
        $this->state = $seed;
        $pick = fn (array $xs) => $xs[(int) floor($this->rnd() * count($xs))];
        $iso = fn (int $ms) => gmdate('Y-m-d', intdiv($ms, 1000));
        $day = 86_400_000;
        $entries = [];

        for ($i = 0; $i < $count; $i++) {
            // Spread across 1985 to October 2026, newest entries most common.
            $year = 2026 - (int) floor(pow($this->rnd(), 1.6) * 41);
            $month = $year === 2026 ? (int) floor($this->rnd() * 10) : (int) floor($this->rnd() * 12);
            $date = gmmktime(0, 0, 0, $month + 1, 1 + (int) floor($this->rnd() * 27), $year) * 1000;
            // A register book holds about three years of entries.
            $place = [1 + intdiv($year - 1985, 3), 1 + (int) floor($this->rnd() * 180), 1 + (int) floor($this->rnd() * 10)];
            $last = $pick(self::LAST);
            $male = $this->rnd() < 0.5;
            $first = $male ? $pick(self::FIRST_M) : $pick(self::FIRST_F);
            $name = "{$first} {$last}";
            $father = $pick(self::FIRST_M)." {$last}";
            $motherMaiden = $pick(self::LAST);
            $mother = $pick(self::FIRST_F)." {$last} (née {$motherMaiden})";
            $priest = $year >= 2016 ? 'Fr. Antonio Reyes' : ($year >= 2001 ? 'Fr. Miguel Torres' : 'Fr. Jose Ramirez');

            if ($type === 'Baptism') {
                $birth = $date - (20 + (int) floor($this->rnd() * 200)) * $day;
                $godparents = $pick(self::FIRST_M).' '.$pick(self::LAST).', '.$pick(self::FIRST_F).' '.$pick(self::LAST);
                $values = $this->baptismValues($name, $male ? 'Male' : 'Female', $iso($birth), $iso($date), $father, $mother, $godparents, $priest);
            } elseif ($type === 'Confirmation') {
                $birthYear = $year - 12 - (int) floor($this->rnd() * 4);
                $birthMonth = (int) floor($this->rnd() * 12);
                $birth = gmmktime(0, 0, 0, $birthMonth + 1, 1 + (int) floor($this->rnd() * 27), $birthYear) * 1000;
                $sponsor = $pick(self::FIRST_M).' '.$pick(self::LAST);
                $values = [
                    'confirmed' => $name, 'date_of_birth' => $iso($birth), 'date_of_confirmation' => $iso($date), 'place_of_confirmation' => self::PARISH,
                    'father' => $father, 'mother' => $mother, 'sponsor' => $sponsor, 'minister' => '',
                    'baptismal_parish' => $this->rnd() < 0.8 ? self::PARISH : 'San Isidro Labrador Parish',
                ];
            } elseif ($type === 'Marriage') {
                $groom = $pick(self::FIRST_M)." {$last}";
                $brideMaiden = $pick(self::LAST);
                $bride = $pick(self::FIRST_F)." {$last}";
                $license = sprintf('%d-%02d%02d-%d', $year, $month + 1, (int) gmdate('j', intdiv($date, 1000)), 100 + (int) floor($this->rnd() * 800));
                $witnesses = $pick(self::FIRST_M).' '.$pick(self::LAST).', '.$pick(self::FIRST_F).' '.$pick(self::LAST);
                $values = [
                    'groom' => $groom, 'bride' => "{$bride} (née {$brideMaiden})", 'date_of_marriage' => $iso($date), 'place_of_marriage' => self::PARISH,
                    'presiding_priest' => $priest, 'marriage_license_no' => $license, 'witnesses' => $witnesses,
                ];
            } else {
                $age = 45 + (int) floor($this->rnd() * 50);
                $death = $date - (2 + (int) floor($this->rnd() * 4)) * $day;
                $values = [
                    'deceased' => $name, 'sex' => $male ? 'Male' : 'Female', 'date_of_death' => $iso($death), 'age_at_death' => (string) $age,
                    'civil_status' => $pick(['Married', 'Widowed', 'Single']), 'funeral_mass' => $iso($date - $day), 'date_of_burial' => $iso($date),
                    'place_of_burial' => $pick(['Municipal Cemetery', 'Sacred Heart Memorial Park']), 'church' => self::PARISH, 'officiating_priest' => $priest,
                ];
            }

            $entries[] = ['place' => $place, 'values' => $values];
        }

        return $entries;
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

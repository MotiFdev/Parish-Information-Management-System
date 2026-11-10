<?php

namespace App\Services;

use App\Models\Offering;
use App\Models\Parishioner;
use App\Models\Sona;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * The parish priest's reports (section 4.2): who is in the parish directory,
 * and the offerings and fees received. The sacramental counts are the staff
 * report's (StaffReports::sacramentalCounts). Same shape as the staff reports.
 */
class ParishReports
{
    public const AGE_GROUPS = ['Under 18' => [0, 17], '18 to 35' => [18, 35], '36 to 59' => [36, 59], '60 and over' => [60, 200]];

    private const NOT_RECORDED = 'Not recorded';

    public function __construct(private StaffReports $staff) {}

    /**
     * Parishioners in the directory today (archived people left out), by Sona, age group, or sex.
     *
     * @return array<string, mixed>
     */
    public function demographic(string $groupBy): array
    {
        $tz = StaffReports::timezone();
        $today = CarbonImmutable::now($tz);
        $people = Parishioner::query()->with('chapel')->where('is_archived', false)
            ->get(['parishioner_id', 'sex', 'date_of_birth', 'chapel_id']);
        $total = $people->count();
        $base = ['period' => 'As of '.$today->format('F j, Y'), 'note' => 'Archived parishioners are not counted.'];
        $share = fn (int $n) => $total ? number_format($n / $total * 100, 1).'%' : '0%';
        $sexOf = fn (Parishioner $p) => in_array($p->sex, ['Female', 'Male'], true) ? $p->sex : self::NOT_RECORDED;

        if ($groupBy === 'sona') {
            $groups = Sona::query()->orderBy('sona_id')->get()
                ->map(fn (Sona $s) => ['label' => $s->name, 'people' => $people->filter(fn (Parishioner $p) => $p->chapel?->sona_id === $s->sona_id)]);
            $none = $people->filter(fn (Parishioner $p) => ! $p->chapel);
            if ($none->isNotEmpty()) {
                $groups->push(['label' => 'No chapel on file', 'people' => $none]);
            }
            $row = fn (string $label, Collection $xs) => [
                $label, $xs->count(),
                $xs->filter(fn ($p) => $sexOf($p) === 'Female')->count(),
                $xs->filter(fn ($p) => $sexOf($p) === 'Male')->count(),
                $xs->filter(fn ($p) => $sexOf($p) === self::NOT_RECORDED)->count(),
            ];

            return [
                ...$base,
                'title' => 'Parishioners by Sona',
                'columns' => ['Sona', 'Parishioners', 'Female', 'Male', 'Sex not recorded'],
                'rows' => $groups->map(fn ($g) => $row($g['label'], $g['people']))->values(),
                'total' => $row('Total', $people),
                'chart' => ['title' => 'Parishioners per Sona', 'kind' => 'bars', 'items' => $groups->map(fn ($g) => ['label' => $g['label'], 'value' => $g['people']->count()])->values()],
            ];
        }

        if ($groupBy === 'age') {
            $ageOf = function (Parishioner $p) use ($today): string {
                if (! $p->date_of_birth) {
                    return self::NOT_RECORDED;
                }
                $age = (int) CarbonImmutable::parse($p->date_of_birth->toDateString())->diffInYears($today->startOfDay());
                foreach (self::AGE_GROUPS as $label => [$lo, $hi]) {
                    if ($age >= $lo && $age <= $hi) {
                        return $label;
                    }
                }

                return self::NOT_RECORDED;
            };
            $counts = $people->countBy($ageOf);
            $labels = collect(array_keys(self::AGE_GROUPS))->when(($counts[self::NOT_RECORDED] ?? 0) > 0, fn ($c) => $c->push('Birthdate not recorded'));
            $value = fn (string $l) => (int) ($counts[$l === 'Birthdate not recorded' ? self::NOT_RECORDED : $l] ?? 0);

            return [
                ...$base,
                'title' => 'Parishioners by age group',
                'columns' => ['Age group', 'Parishioners', 'Share'],
                'rows' => $labels->map(fn ($l) => [$l, $value($l), $share($value($l))])->values(),
                'total' => ['Total', $total, $total ? '100%' : '0%'],
                'chart' => ['title' => 'Parishioners per age group', 'kind' => 'bars', 'items' => $labels->map(fn ($l) => ['label' => $l, 'value' => $value($l)])->values()],
            ];
        }

        $counts = $people->countBy($sexOf);
        $labels = collect(['Female', 'Male'])->when(($counts[self::NOT_RECORDED] ?? 0) > 0, fn ($c) => $c->push(self::NOT_RECORDED));

        return [
            ...$base,
            'title' => 'Parishioners by sex',
            'columns' => ['Sex', 'Parishioners', 'Share'],
            'rows' => $labels->map(fn ($l) => [$l, (int) ($counts[$l] ?? 0), $share((int) ($counts[$l] ?? 0))])->values(),
            'total' => ['Total', $total, $total ? '100%' : '0%'],
            'chart' => ['title' => 'Parishioners by sex', 'kind' => 'bars', 'items' => $labels->map(fn ($l) => ['label' => $l, 'value' => (int) ($counts[$l] ?? 0)])->values()],
        ];
    }

    /**
     * Offerings and fees received in the month range, by category, largest first.
     *
     * @return array<string, mixed>
     */
    public function financial(string $from, string $to): array
    {
        [$start, $end, $months] = $this->staff->months($from, $to);

        $byCategory = Offering::query()
            ->where('received_on', '>=', $start->toDateString())->where('received_on', '<', $end->toDateString())
            ->groupBy('category')
            ->selectRaw('category, count(*) as entries, sum(amount) as amount')
            ->get()
            ->map(fn ($r) => ['label' => $r->category, 'entries' => (int) $r->entries, 'amount' => round((float) $r->amount, 2)])
            ->sortByDesc('amount')
            ->values();
        $total = round($byCategory->sum('amount'), 2);
        $share = fn (float $n) => $total > 0 ? number_format($n / $total * 100, 1).'%' : '0%';

        return [
            'title' => 'Offerings and fees',
            'period' => $this->staff->periodLabel($months),
            'months' => $months->count(),
            'note' => 'By the day the money was received, as entered in the offerings ledger.',
            'columns' => ['Category', 'Entries', 'Amount', 'Share'],
            'rows' => $byCategory->map(fn ($c) => [$c['label'], $c['entries'], $c['amount'], $share($c['amount'])])->values(),
            'total' => ['Total', $byCategory->sum('entries'), $total, $total > 0 ? '100%' : '0%'],
            'money' => [2],
            'chart' => ['title' => 'Amount per category', 'kind' => 'bars', 'money' => true, 'items' => $byCategory->map(fn ($c) => ['label' => $c['label'], 'value' => $c['amount']])->values()],
        ];
    }
}

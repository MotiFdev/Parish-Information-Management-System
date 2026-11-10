<?php

namespace App\Services;

use App\Enums\ApprovalStatus;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\RecordRequest;
use App\Models\SacramentalRecord;
use App\Support\AuditActions;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * The four staff reports (section 4.3), in the shape the frontend's report
 * views draw: title, period, columns, rows, an optional total row, and a
 * chart. Days and months are the parish's calendar (Asia/Manila).
 *
 * - Daily Log: the office's own audit entries on one day.
 * - Sacramental Count Summary: register entries per month, by the sacrament's date.
 * - Request Turnaround: days from submission to ready for collection.
 * - Appointments by Chapel: decided booking requests per venue.
 */
class StaffReports
{
    /** Audit categories that are office work; sign-ins, accounts, and backups belong to the administrator. */
    public const OFFICE_CATEGORIES = ['requests', 'documents', 'certificates', 'records', 'appointments', 'announcements', 'offerings'];

    public const EVENT_TYPES = ['Mass Intention', 'House Blessing', 'Wedding Pre-interview', 'General Counseling'];

    private const PLURAL = ['Baptism' => 'Baptisms', 'Confirmation' => 'Confirmations', 'Marriage' => 'Marriages', 'Burial' => 'Burials'];

    /** The longest month range one report covers. */
    public const MAX_MONTHS = 60;

    public static function timezone(): string
    {
        return (string) config('app.parish_timezone', 'Asia/Manila');
    }

    /**
     * Refuses a month range that runs backwards, reaches past this month, or is too long.
     *
     * @throws ValidationException
     */
    public function checkRange(string $from, string $to): void
    {
        $tz = self::timezone();
        $today = CarbonImmutable::now($tz);
        $a = CarbonImmutable::createFromFormat('!Y-m', $from, $tz);
        $b = CarbonImmutable::createFromFormat('!Y-m', $to, $tz);
        $message = match (true) {
            $a > $b => 'The start month is after the end month.',
            $b > $today->startOfMonth() => 'Choose this month or an earlier one.',
            $a->diffInMonths($b) + 1 > self::MAX_MONTHS => 'Choose at most '.self::MAX_MONTHS.' months.',
            default => null,
        };
        if ($message) {
            throw ValidationException::withMessages(['from' => $message]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function dailyLog(string $date, ?string $category, ?string $person): array
    {
        $tz = self::timezone();
        $day = CarbonImmutable::parse($date, $tz)->startOfDay();
        $codes = collect($category ? [$category] : self::OFFICE_CATEGORIES)->flatMap(fn ($c) => AuditActions::inCategory($c))->all();

        $logs = AuditLog::query()->with('user')
            ->whereNotNull('user_id')
            ->whereIn('action', $codes)
            ->where('timestamp', '>=', $day->utc())->where('timestamp', '<', $day->addDay()->utc())
            ->orderBy('timestamp')
            ->get()
            ->filter(fn (AuditLog $l) => ! $person || $l->user?->displayName() === $person)
            ->values();

        $byCategory = collect($category ? [$category] : self::OFFICE_CATEGORIES)->map(fn ($c) => [
            'label' => AuditActions::CATEGORIES[$c],
            'value' => $logs->filter(fn (AuditLog $l) => AuditActions::describe($l->action)['category'] === $c)->count(),
        ])->values();

        return [
            'title' => 'Daily Log',
            'period' => $day->format('l, F j, Y'),
            'columns' => ['Time', 'By', 'Activity', 'Record', 'Details'],
            'textColumns' => [1, 2, 3, 4],
            'rows' => $logs->map(fn (AuditLog $l) => [
                $l->timestamp->copy()->setTimezone($tz)->format('g:i A'),
                $l->user?->displayName() ?? 'System',
                AuditActions::describe($l->action)['label'],
                $this->recordOf($l),
                $this->detailsOf($l),
            ])->values(),
            'chart' => ['title' => 'Entries by kind of work', 'kind' => 'bars', 'items' => $byCategory],
        ];
    }

    /** Everyone who has logged office work, for the Daily Log's "Done by" choice. */
    public function logPeople(): Collection
    {
        $codes = collect(self::OFFICE_CATEGORIES)->flatMap(fn ($c) => AuditActions::inCategory($c))->all();

        return AuditLog::query()->with('user')->whereNotNull('user_id')->whereIn('action', $codes)
            ->select('user_id')->distinct()->get()
            ->map(fn (AuditLog $l) => $l->user?->displayName())->filter()->unique()->sort()->values();
    }

    /**
     * @param  list<string>  $types
     * @return array<string, mixed>
     */
    public function sacramentalCounts(string $from, string $to, array $types): array
    {
        [$start, $end, $months] = $this->months($from, $to);
        $types = array_values(array_intersect(SacramentalRegister::TYPES, $types));

        $counts = SacramentalRecord::query()
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->whereIn('sacrament_types.name', $types)
            ->where('event_date', '>=', $start->toDateString())->where('event_date', '<', $end->toDateString())
            ->selectRaw("sacrament_types.name as type, to_char(event_date, 'YYYY-MM') as month, count(*) as total")
            ->groupBy('sacrament_types.name', 'month')
            ->get()
            ->groupBy('month')
            ->map(fn ($rows) => $rows->pluck('total', 'type')->map(fn ($n) => (int) $n));

        $rows = $months->map(function (CarbonImmutable $m) use ($counts, $types) {
            $cells = array_map(fn ($t) => $counts[$m->format('Y-m')][$t] ?? 0, $types);

            return [$m->format('M Y'), ...$cells, array_sum($cells)];
        })->values();
        $sums = array_map(fn ($i) => $rows->sum(fn ($r) => $r[$i + 1]), array_keys($types));

        return [
            'title' => 'Sacramental Count Summary',
            'period' => $this->periodLabel($months),
            'months' => $months->count(),
            'note' => 'Counted by the date of the sacrament as written in the register.',
            'columns' => ['Month', ...array_map(fn ($t) => self::PLURAL[$t], $types), 'Total'],
            'rows' => $rows,
            'total' => ['Total', ...$sums, array_sum($sums)],
            'chart' => ['title' => 'Sacraments recorded each month', 'kind' => 'columns', 'items' => $rows->map(fn ($r) => ['label' => $r[0], 'value' => $r[count($r) - 1]])->values()],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function turnaround(string $from, string $to, string $groupBy): array
    {
        [$start, $end, $months] = $this->months($from, $to);
        $tz = self::timezone();

        $done = RecordRequest::query()->with('recordType')
            ->whereNotNull('ready_at')
            ->where('ready_at', '>=', $start->utc())->where('ready_at', '<', $end->utc())
            ->get()
            ->map(fn (RecordRequest $r) => [
                'month' => $r->ready_at->copy()->setTimezone($tz)->format('Y-m'),
                'recordType' => $r->recordType?->name ?? 'Unknown',
                'requestType' => $r->request_type->value,
                // Calendar days in the parish, so a request ready the same day took 0 days.
                'days' => (int) $r->requested_at->copy()->setTimezone($tz)->startOfDay()->diffInDays($r->ready_at->copy()->setTimezone($tz)->startOfDay()),
            ]);

        $groups = match ($groupBy) {
            'month' => $months->map(fn (CarbonImmutable $m) => ['label' => $m->format('M Y'), 'items' => $done->where('month', $m->format('Y-m'))]),
            'requestType' => collect(['Certificate Request', 'New Registration', 'Record Correction'])->map(fn ($k) => ['label' => $k, 'items' => $done->where('requestType', $k)]),
            default => collect(SacramentalRegister::TYPES)->map(fn ($t) => ['label' => $t, 'items' => $done->where('recordType', $t)]),
        };
        $shown = $groups->filter(fn ($g) => $groupBy === 'month' || $g['items']->isNotEmpty())->values();

        $avg = fn (Collection $xs) => $xs->isEmpty() ? 0 : round($xs->avg('days'), 1);
        $row = fn (string $label, Collection $xs) => [$label, $xs->count(), $avg($xs), (int) ($xs->min('days') ?? 0), (int) ($xs->max('days') ?? 0)];

        return [
            'title' => 'Request Turnaround',
            'period' => $this->periodLabel($months),
            'months' => $months->count(),
            'note' => 'Days count from submission to ready for collection, for requests that reached it in this period.',
            'columns' => [['recordType' => 'Record type', 'requestType' => 'Request type', 'month' => 'Month'][$groupBy] ?? 'Record type', 'Completed', 'Average days', 'Fastest', 'Slowest'],
            'rows' => $shown->map(fn ($g) => $row($g['label'], $g['items']))->values(),
            'total' => $row('All requests', $done),
            'chart' => ['title' => 'Average days to ready for collection', 'kind' => 'bars', 'items' => $shown->map(fn ($g) => ['label' => $g['label'], 'value' => $avg($g['items'])])->values()],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function appointmentsByChapel(string $from, string $to, ?string $eventType): array
    {
        [$start, $end, $months] = $this->months($from, $to);

        $decided = Appointment::query()
            ->whereIn('status', ['Approved', 'Rejected'])
            ->where('scheduled_start', '>=', $start->utc())->where('scheduled_start', '<', $end->utc())
            ->when($eventType, fn ($q, $t) => $q->where('event_type', $t))
            // Plain column values: status and venue_type are enums on the model.
            ->toBase()
            ->get(['venue_type', 'chapel_id', 'status']);

        $tally = fn (Collection $xs) => ['approved' => $xs->where('status', 'Approved')->count(), 'rejected' => $xs->where('status', 'Rejected')->count()];
        $venues = collect([['name' => 'Parish Church', 'sona' => 'Parish', ...$tally($decided->where('venue_type', 'Parish Church'))]]);
        foreach (Chapel::query()->with('sona')->where('approval_status', ApprovalStatus::Approved->value)->orderBy('sona_id')->orderBy('name')->get() as $c) {
            $xs = $decided->where('venue_type', 'Chapel')->where('chapel_id', $c->chapel_id);
            // A closed chapel is listed only when it still had bookings in the period.
            if ($c->is_active || $xs->isNotEmpty()) {
                $venues->push(['name' => $c->name, 'sona' => preg_replace('/^Sona /', '', (string) $c->sona?->name), ...$tally($xs)]);
            }
        }
        $homes = $tally($decided->where('venue_type', 'Home'));
        if ($homes['approved'] + $homes['rejected'] > 0) {
            $venues->push(['name' => 'Homes', 'sona' => 'All Sonas', ...$homes]);
        }

        $rows = $venues->map(fn ($v) => [$v['name'], $v['sona'], $v['approved'], $v['rejected'], $v['approved'] + $v['rejected']])->values();

        return [
            'title' => $eventType ? "{$eventType} bookings by chapel" : 'Appointments by Chapel',
            'period' => $this->periodLabel($months),
            'months' => $months->count(),
            'note' => 'By the date of the appointment. Pending and cancelled requests are not counted.',
            'columns' => ['Venue', 'Sona', 'Approved', 'Rejected', 'Total requests'],
            'textColumns' => [1],
            'rows' => $rows,
            'total' => ['Total', '', $rows->sum(2), $rows->sum(3), $rows->sum(4)],
            'chart' => ['title' => 'Requests per venue', 'kind' => 'bars', 'items' => $rows->sortByDesc(4)->map(fn ($r) => ['label' => $r[0], 'value' => $r[4]])->values()],
        ];
    }

    /**
     * The month range as parish-time bounds [start, end) and the list of months.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable, 2: Collection<int, CarbonImmutable>}
     */
    public function months(string $from, string $to): array
    {
        $tz = self::timezone();
        $start = CarbonImmutable::createFromFormat('!Y-m', $from, $tz)->startOfMonth();
        $last = CarbonImmutable::createFromFormat('!Y-m', $to, $tz)->startOfMonth();
        $months = collect();
        for ($m = $start; $m <= $last; $m = $m->addMonth()) {
            $months->push($m);
        }

        return [$start, $last->addMonth(), $months];
    }

    /**
     * @param  Collection<int, CarbonImmutable>  $months
     */
    public function periodLabel(Collection $months): string
    {
        $a = $months->first();
        $b = $months->last();

        return $months->count() === 1 ? $a->format('F Y') : "{$a->format('F Y')} to {$b->format('F Y')}";
    }

    /** A readable name for what the entry is about: a request number, a person, a file. */
    public function recordOf(AuditLog $l): string
    {
        $d = is_array($l->details) ? $l->details : [];
        foreach (['request_number', 'reference_number', 'subject', 'name', 'file', 'document'] as $key) {
            if (filled($d[$key] ?? null) && is_scalar($d[$key])) {
                return (string) $d[$key];
            }
        }
        if (isset($d['book'], $d['page'], $d['line'])) {
            return "Book {$d['book']}, page {$d['page']}, line {$d['line']}";
        }

        return str_replace('_', ' ', $l->table_affected);
    }

    /** What changed, in a sentence: status moves, notes, and field changes. */
    public function detailsOf(AuditLog $l): string
    {
        $d = is_array($l->details) ? $l->details : [];
        $parts = [];
        if (isset($d['from'], $d['to']) && is_scalar($d['from']) && is_scalar($d['to'])) {
            $parts[] = "{$d['from']} to {$d['to']}";
        }
        if (isset($d['document']) && isset($d['request_number']) && is_scalar($d['document'])) {
            $parts[] = (string) $d['document'];
        }
        foreach (['note', 'reason', 'remark', 'message'] as $key) {
            if (filled($d[$key] ?? null) && is_scalar($d[$key])) {
                $parts[] = (string) $d[$key];
            }
        }
        if (is_array($d['changes'] ?? null)) {
            $fields = collect($d['changes'])->map(function ($c, $k) {
                $label = is_array($c) && isset($c['field']) ? $c['field'] : str_replace('_', ' ', (string) $k);

                return is_string($label) ? $label : null;
            })->filter()->values();
            if ($fields->isNotEmpty()) {
                $parts[] = 'Changed: '.$fields->implode(', ');
            }
        }

        return implode('. ', array_unique($parts));
    }
}

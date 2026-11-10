<?php

namespace App\Http\Controllers\Api\Priest;

use App\Enums\AppointmentStatus;
use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Parishioner;
use App\Models\SacramentalRecord;
use App\Models\SacramentalRecordCorrection;
use App\Services\SacramentalRegister;
use App\Services\StaffReports;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

/**
 * Dashboard & Analytics in the priest portal (section 4.2): the directory
 * size, sacraments recorded this year and month by month over the last
 * twelve months, Mass intention bookings, and register corrections waiting.
 * The certificate queue comes from /api/priest/record-requests.
 */
class DashboardController extends Controller
{
    private const MONTHS = 12;

    public function __construct(private StaffReports $reports) {}

    #[OA\Get(path: '/api/priest/dashboard', summary: 'Figures and trends on the priest dashboard', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Dashboard')])]
    public function show(): JsonResponse
    {
        $now = CarbonImmutable::now(StaffReports::timezone());
        $thisMonth = $now->format('Y-m');
        [$start, $end, $months] = $this->reports->months($now->subMonths(self::MONTHS - 1)->format('Y-m'), $thisMonth);
        $keys = $months->map(fn (CarbonImmutable $m) => $m->format('Y-m'))->values();

        // Sacraments by the date written in the register, from the start of the earlier of the two windows.
        $since = min($start->toDateString(), $now->startOfYear()->toDateString());
        $counts = SacramentalRecord::query()
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->where('event_date', '>=', $since)->where('event_date', '<', $end->toDateString())
            ->selectRaw("sacrament_types.name as type, to_char(event_date, 'YYYY-MM') as month, count(*) as total")
            ->groupBy('sacrament_types.name', 'month')
            ->get();
        $count = fn (string $type, string $month) => (int) ($counts->first(fn ($r) => $r->type === $type && $r->month === $month)?->total ?? 0);
        $year = $now->format('Y');

        // Mass intentions by the month they are scheduled for; rejected and cancelled bookings don't count.
        $tz = StaffReports::timezone();
        $bookings = Appointment::query()
            ->where('event_type', 'Mass Intention')
            ->whereIn('status', [AppointmentStatus::Pending->value, AppointmentStatus::Approved->value])
            ->where('scheduled_start', '>=', $start->utc())->where('scheduled_start', '<', $end->utc())
            ->pluck('scheduled_start')
            ->countBy(fn ($at) => CarbonImmutable::parse($at)->setTimezone($tz)->format('Y-m'));

        $waiting = SacramentalRecordCorrection::query()
            ->where('sacramental_record_corrections.status', ApprovalStatus::Pending->value)
            ->join('sacramental_records', 'sacramental_records.record_id', '=', 'sacramental_record_corrections.record_id')
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->groupBy('sacrament_types.name')
            ->selectRaw('sacrament_types.name, count(*) as total')
            ->pluck('total', 'name');

        $perType = fn (callable $f) => collect(SacramentalRegister::TYPES)->mapWithKeys(fn ($t) => [$t => $f($t)]);

        return response()->json([
            'months' => $keys,
            'parishioners' => Parishioner::query()->where('is_archived', false)->count(),
            'trend' => $perType(fn ($t) => $keys->map(fn ($m) => $count($t, $m))->values()),
            'this_year' => $perType(fn ($t) => $counts->where('type', $t)->filter(fn ($r) => str_starts_with($r->month, $year))->sum(fn ($r) => (int) $r->total)),
            'mass_bookings' => $keys->map(fn ($m) => (int) ($bookings[$m] ?? 0))->values(),
            'corrections_waiting' => $perType(fn ($t) => (int) ($waiting[$t] ?? 0)),
        ]);
    }
}

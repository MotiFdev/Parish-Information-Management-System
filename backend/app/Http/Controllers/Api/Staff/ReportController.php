<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Services\SacramentalRegister;
use App\Services\StaffReports;
use App\Support\AuditActions;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Reports for the parish office (section 4.3). One endpoint, one report per
 * call; the page asks again whenever an option changes.
 */
class ReportController extends Controller
{
    public function __construct(private StaffReports $reports) {}

    #[OA\Get(
        path: '/api/secretary/reports',
        summary: 'One staff report',
        description: 'type=daily (date, category, person) | sacramental (from, to, sacraments[]) | turnaround (from, to, group_by) | appointments (from, to, event_type). Months are YYYY-MM.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'report, plus the choices the options panel offers'), new OA\Response(response: 422, description: 'Invalid options')],
    )]
    public function show(Request $request): JsonResponse
    {
        $tz = StaffReports::timezone();
        $today = CarbonImmutable::now($tz);
        $type = $request->validate(['type' => ['required', Rule::in(['daily', 'sacramental', 'turnaround', 'appointments'])]])['type'];

        if ($type === 'daily') {
            $data = $request->validate([
                'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.$today->toDateString()],
                'category' => ['nullable', Rule::in(StaffReports::OFFICE_CATEGORIES)],
                'person' => ['nullable', 'string', 'max:200'],
            ], ['date.before_or_equal' => 'Choose today or an earlier day.']);
            $report = $this->reports->dailyLog($data['date'], $data['category'] ?? null, $data['person'] ?? null);
        } else {
            $data = $request->validate([
                'from' => ['required', 'date_format:Y-m'],
                'to' => ['required', 'date_format:Y-m'],
                'sacraments' => [Rule::requiredIf($type === 'sacramental'), 'array', 'min:1'],
                'sacraments.*' => [Rule::in(SacramentalRegister::TYPES)],
                'group_by' => ['nullable', Rule::in(['recordType', 'requestType', 'month'])],
                'event_type' => ['nullable', Rule::in(StaffReports::EVENT_TYPES)],
            ], ['sacraments.required' => 'Choose at least one sacrament.', 'sacraments.min' => 'Choose at least one sacrament.']);
            $this->reports->checkRange($data['from'], $data['to']);

            $report = match ($type) {
                'sacramental' => $this->reports->sacramentalCounts($data['from'], $data['to'], $data['sacraments']),
                'turnaround' => $this->reports->turnaround($data['from'], $data['to'], $data['group_by'] ?? 'recordType'),
                default => $this->reports->appointmentsByChapel($data['from'], $data['to'], $data['event_type'] ?? null),
            };
        }

        return response()->json([
            'report' => $report,
            'options' => [
                'people' => $this->reports->logPeople(),
                'categories' => collect(StaffReports::OFFICE_CATEGORIES)->map(fn ($c) => ['key' => $c, 'label' => AuditActions::CATEGORIES[$c]])->values(),
                'event_types' => StaffReports::EVENT_TYPES,
            ],
        ]);
    }
}

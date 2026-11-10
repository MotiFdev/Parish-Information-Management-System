<?php

namespace App\Http\Controllers\Api\Priest;

use App\Http\Controllers\Controller;
use App\Services\ParishReports;
use App\Services\SacramentalRegister;
use App\Services\StaffReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Reports & Analytics in the priest portal (section 4.2): one report per
 * call; the page asks again whenever an option changes.
 */
class ReportController extends Controller
{
    public function __construct(private ParishReports $parish, private StaffReports $staff) {}

    #[OA\Get(
        path: '/api/priest/reports',
        summary: 'One parish report',
        description: 'type=demographic (group_by=sona|age|sex) | sacramental (from, to, sacraments[]) | financial (from, to). Months are YYYY-MM.',
        tags: ['Priest'],
        responses: [new OA\Response(response: 200, description: 'report'), new OA\Response(response: 422, description: 'Invalid options')],
    )]
    public function show(Request $request): JsonResponse
    {
        $type = $request->validate(['type' => ['required', Rule::in(['demographic', 'sacramental', 'financial'])]])['type'];

        if ($type === 'demographic') {
            $groupBy = $request->validate(['group_by' => ['required', Rule::in(['sona', 'age', 'sex'])]])['group_by'];

            return response()->json(['report' => $this->parish->demographic($groupBy)]);
        }

        $data = $request->validate([
            'from' => ['required', 'date_format:Y-m'],
            'to' => ['required', 'date_format:Y-m'],
            'sacraments' => [Rule::requiredIf($type === 'sacramental'), 'array', 'min:1'],
            'sacraments.*' => [Rule::in(SacramentalRegister::TYPES)],
        ], ['sacraments.required' => 'Choose at least one sacrament.', 'sacraments.min' => 'Choose at least one sacrament.']);
        $this->staff->checkRange($data['from'], $data['to']);

        $report = $type === 'sacramental'
            ? [...$this->staff->sacramentalCounts($data['from'], $data['to'], $data['sacraments']), 'title' => 'Sacraments recorded']
            : $this->parish->financial($data['from'], $data['to']);

        return response()->json(['report' => $report]);
    }
}

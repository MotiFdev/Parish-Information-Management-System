<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Offering;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\StaffReports;
use App\Support\DisplayName;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

/**
 * The offerings ledger: collections, Mass intentions, stole and certificate
 * fees, and donations. Staff and the parish priest both keep it; the priest's
 * Financial report adds it up. Every change is in the audit log.
 */
class OfferingController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/offerings',
        summary: 'Offerings received in a month range (from, to as YYYY-MM), newest first',
        tags: ['Offerings'],
        responses: [new OA\Response(response: 200, description: 'data, total, and the category suggestions')],
    )]
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['from' => ['required', 'date_format:Y-m'], 'to' => ['required', 'date_format:Y-m', 'after_or_equal:from']], [
            'to.after_or_equal' => 'The start month is after the end month.',
        ]);
        $tz = StaffReports::timezone();
        $start = CarbonImmutable::createFromFormat('!Y-m', $data['from'], $tz);
        $end = CarbonImmutable::createFromFormat('!Y-m', $data['to'], $tz)->addMonth();

        $rows = Offering::query()->with('recordedBy')
            ->where('received_on', '>=', $start->toDateString())->where('received_on', '<', $end->toDateString())
            ->orderByDesc('received_on')->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (Offering $o) => $this->present($o))->values(),
            'total' => (float) $rows->sum('amount'),
            'categories' => $this->categories(),
        ]);
    }

    #[OA\Post(path: '/api/offerings', summary: 'Record an offering or fee', tags: ['Offerings'], responses: [new OA\Response(response: 201, description: 'The new entry'), new OA\Response(response: 422, description: 'Invalid')])]
    public function store(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $offering = Offering::query()->create([...$this->validated($request), 'recorded_by_user_id' => $me->user_id]);

        $this->audit->log('OFFERING_RECORDED', 'offerings', $offering->offering_id, $me, $this->auditDetails($offering));

        return response()->json(['offering' => $this->present($offering->load('recordedBy')), 'categories' => $this->categories()], 201);
    }

    #[OA\Patch(path: '/api/offerings/{offering}', summary: 'Edit an offering', tags: ['Offerings'], responses: [new OA\Response(response: 200, description: 'The entry'), new OA\Response(response: 422, description: 'Invalid')])]
    public function update(Request $request, Offering $offering): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $before = $offering->only(['category', 'description', 'amount', 'received_on']);
        $offering->fill($this->validated($request));
        $changes = collect($offering->getDirty())->keys()->mapWithKeys(fn ($k) => [$k => [
            'field' => str_replace('_', ' ', $k),
            'from' => $this->auditValue($before[$k] ?? null),
            'to' => $this->auditValue($offering->{$k}),
        ]])->all();
        $offering->save();

        if ($changes) {
            $this->audit->log('OFFERING_UPDATED', 'offerings', $offering->offering_id, $me, [...$this->auditDetails($offering), 'changes' => $changes]);
        }

        return response()->json(['offering' => $this->present($offering->load('recordedBy')), 'categories' => $this->categories()]);
    }

    #[OA\Delete(path: '/api/offerings/{offering}', summary: 'Delete an offering entered by mistake', tags: ['Offerings'], responses: [new OA\Response(response: 204, description: 'Deleted')])]
    public function destroy(Request $request, Offering $offering): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $details = $this->auditDetails($offering);
        $offering->delete();
        $this->audit->log('OFFERING_DELETED', 'offerings', $offering->offering_id, $me, $details);

        return response()->json(null, 204);
    }

    /**
     * @return array{category: string, description: ?string, amount: string, received_on: string}
     */
    private function validated(Request $request): array
    {
        $today = CarbonImmutable::now(StaffReports::timezone())->toDateString();
        $data = $request->validate([
            'category' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99', 'decimal:0,2'],
            'received_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.$today],
        ], [
            'category.required' => 'Say what the money is for, such as Sunday collection.',
            'amount.required' => 'Enter the amount in pesos.',
            'amount.min' => 'Enter an amount above zero.',
            'amount.decimal' => 'Use at most two decimal places.',
            'received_on.required' => 'Choose the day it was received.',
            'received_on.before_or_equal' => 'Choose today or an earlier day.',
        ]);

        return [
            'category' => trim($data['category']),
            'description' => filled($data['description'] ?? null) ? trim($data['description']) : null,
            'amount' => (string) $data['amount'],
            'received_on' => $data['received_on'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Offering $o): array
    {
        return [
            'id' => $o->offering_id,
            'category' => $o->category,
            'description' => $o->description,
            'amount' => (float) $o->amount,
            'received_on' => $o->received_on->toDateString(),
            'recorded_by' => DisplayName::of($o->recordedBy),
            'recorded_at' => $o->created_at?->toIso8601String(),
        ];
    }

    /**
     * The suggested categories, then any others people have typed, so the list matches what is in use.
     *
     * @return list<string>
     */
    private function categories(): array
    {
        $used = Offering::query()->distinct()->orderBy('category')->pluck('category')->all();

        return array_values(array_unique([...Offering::CATEGORIES, ...$used]));
    }

    /**
     * @return array<string, string>
     */
    private function auditDetails(Offering $o): array
    {
        return [
            'subject' => "{$o->category}, {$o->received_on->format('M j, Y')}",
            'note' => '₱'.number_format((float) $o->amount, 2),
        ];
    }

    private function auditValue(mixed $v): string
    {
        return $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : (string) ($v ?? '');
    }
}

<?php

namespace App\Http\Controllers\Api\Priest;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\SacramentalRecordCorrection;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Services\SacramentalRegister;
use App\Support\DisplayName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

/**
 * Register corrections staff file from Sacramental Records. The entry only
 * changes once the parish priest approves; the old values stay in the audit log.
 */
class RecordCorrectionController extends Controller
{
    public function __construct(private SacramentalRegister $register, private AuditLogger $audit, private OfficeNotifier $notifier) {}

    #[OA\Get(path: '/api/priest/record-corrections', summary: 'Corrections waiting for approval, oldest first', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Queue')])]
    public function index(): JsonResponse
    {
        $rows = SacramentalRecordCorrection::query()
            ->with(['requestedBy', ...array_map(fn ($r) => "record.{$r}", SacramentalRegister::relations())])
            ->where('status', ApprovalStatus::Pending->value)
            ->orderBy('updated_at')
            ->get();

        return response()->json(['data' => $rows->map(fn (SacramentalRecordCorrection $c) => [
            'correction_id' => $c->correction_id,
            'changes' => $c->changes,
            'requested_by' => DisplayName::of($c->requestedBy),
            'requested_at' => $c->updated_at?->toIso8601String(),
            'entry' => $this->register->present($c->record),
        ])->values()]);
    }

    #[OA\Post(path: '/api/priest/record-corrections/{correction}/approve', summary: 'Approve: the register entry changes', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Approved'), new OA\Response(response: 409, description: 'No longer waiting')])]
    public function approve(Request $request, SacramentalRecordCorrection $correction): JsonResponse
    {
        return $this->decide($request, $correction, ApprovalStatus::Approved, null);
    }

    #[OA\Post(path: '/api/priest/record-corrections/{correction}/reject', summary: 'Reject with a reason staff see', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 422, description: 'Reason missing')])]
    public function reject(Request $request, SacramentalRecordCorrection $correction): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:1000']], [
            'reason.required' => 'Say why, so the office knows what to check.',
            'reason.min' => 'Say why, so the office knows what to check.',
        ]);

        return $this->decide($request, $correction, ApprovalStatus::Rejected, trim($data['reason']));
    }

    private function decide(Request $request, SacramentalRecordCorrection $correction, ApprovalStatus $to, ?string $reason): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        $decided = DB::transaction(function () use ($correction, $to, $reason, $me) {
            $c = SacramentalRecordCorrection::query()->lockForUpdate()->find($correction->getKey());
            if (! $c || $c->status !== ApprovalStatus::Pending) {
                return null;
            }
            if ($to === ApprovalStatus::Approved) {
                $this->register->applyCorrection($c);
            }
            $c->forceFill(['status' => $to, 'reviewed_by_user_id' => $me->user_id, 'reviewed_at' => now(), 'review_note' => $reason])->save();

            return $c;
        });

        if (! $decided) {
            return response()->json(['message' => 'This correction was already decided.'], 409);
        }

        $this->audit->log($to === ApprovalStatus::Approved ? 'RECORD_CORRECTED' : 'RECORD_CORRECTION_REJECTED', 'sacramental_records', $decided->record_id, $me, [
            'correction_id' => $decided->correction_id, 'changes' => $decided->changes, 'reason' => $reason,
        ]);
        $this->notifier->correctionDecided($decided, $to === ApprovalStatus::Approved, $reason);

        return response()->json(['entry' => $this->register->present($decided->record()->with(SacramentalRegister::relations())->firstOrFail())]);
    }
}

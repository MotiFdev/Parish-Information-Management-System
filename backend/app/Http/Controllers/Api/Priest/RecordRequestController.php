<?php

namespace App\Http\Controllers\Api\Priest;

use App\Enums\RecordRequestStatus;
use App\Http\Controllers\Controller;
use App\Models\RecordRequest;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Services\RecordRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

/**
 * Certificate approvals: the parish priest signs off (or rejects with a reason)
 * requests that staff have verified. Nothing is released without this step.
 */
class RecordRequestController extends Controller
{
    public function __construct(private AuditLogger $audit, private RecordRequests $requests, private OfficeNotifier $notifier) {}

    #[OA\Get(path: '/api/priest/record-requests', summary: 'Requests staff verified and sent for approval, oldest first', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Queue')])]
    public function index(): JsonResponse
    {
        $rows = RecordRequest::query()->with(RecordRequests::WITH)
            ->where('status', RecordRequestStatus::UnderVerification->value)
            ->whereNotNull('sent_to_priest_at')
            ->orderBy('sent_to_priest_at')
            ->get();

        return response()->json(['data' => $rows->map(fn ($r) => $this->requests->present($r, forOffice: true))->values()]);
    }

    #[OA\Post(path: '/api/priest/record-requests/{request}/approve', summary: 'Approve and sign', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Approved'), new OA\Response(response: 409, description: 'Not waiting for approval')])]
    public function approve(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        return $this->decide($request, $recordRequest, RecordRequestStatus::Approved, null);
    }

    #[OA\Post(path: '/api/priest/record-requests/{request}/reject', summary: 'Reject with a reason the requester sees', tags: ['Priest'], responses: [new OA\Response(response: 200, description: 'Rejected'), new OA\Response(response: 422, description: 'Reason missing')])]
    public function reject(Request $request, RecordRequest $recordRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:8', 'max:1000']], [
            'reason.required' => 'Give a reason the requester will understand.',
            'reason.min' => 'Give a reason the requester will understand.',
        ]);

        return $this->decide($request, $recordRequest, RecordRequestStatus::Rejected, trim($data['reason']));
    }

    private function decide(Request $request, RecordRequest $recordRequest, RecordRequestStatus $to, ?string $reason): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        $done = DB::transaction(function () use ($recordRequest, $to, $reason, $me) {
            $r = RecordRequest::query()->lockForUpdate()->findOrFail($recordRequest->getKey());
            if (! $r->isWithPriest()) {
                return null;
            }
            $r->forceFill(['status' => $to, 'approved_by_priest_id' => $me->user_id, 'decided_at' => now(), 'remarks' => $reason])->save();

            $this->requests->notify($r, $to === RecordRequestStatus::Approved
                ? "Request {$r->request_number} was approved by the parish priest. The office will tell you when it is ready to collect."
                : "Request {$r->request_number} was not approved: {$reason}");
            $this->audit->log($to === RecordRequestStatus::Approved ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED', 'record_requests', $r->request_id, $me, [
                'request_number' => $r->request_number,
                'reason' => $reason,
            ]);
            $this->notifier->priestDecided($r, $to === RecordRequestStatus::Approved, $reason);

            return $r;
        });

        if (! $done) {
            return response()->json(['message' => 'This request is no longer waiting for your approval.'], 409);
        }

        return response()->json(['data' => $this->requests->present($done->fresh(), forOffice: true)]);
    }
}

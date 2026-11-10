<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\AppointmentStatus;
use App\Enums\DocumentVerificationStatus;
use App\Enums\RecordRequestStatus;
use App\Enums\VenueType;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Parishioner;
use App\Models\RecordRequest;
use App\Models\RequestDocument;
use App\Models\SacramentalRecord;
use App\Services\GeminiEmbedder;
use App\Services\RecordRequests;
use App\Services\RecordSearch;
use App\Services\SacramentalRegister;
use App\Services\StaffReports;
use App\Support\AuditActions;
use App\Support\DisplayName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Date;
use OpenApi\Attributes as OA;

/**
 * The staff dashboard (section 4.3): the office's open request queue, the
 * directory and register totals, the next seven days of appointments, and
 * the latest office work from the audit log.
 */
class DashboardController extends Controller
{
    private const ACTIVITY = 7;

    private const ACTIVITY_CATEGORIES = ['requests', 'documents', 'certificates', 'records'];

    public function __construct(private StaffReports $reports, private GeminiEmbedder $embedder) {}

    #[OA\Get(path: '/api/secretary/dashboard', summary: 'Everything on the staff dashboard', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Dashboard')])]
    public function show(): JsonResponse
    {
        return response()->json([
            'requests' => $this->queue(),
            'parishioners' => Parishioner::query()->where('is_archived', false)->count(),
            'registers' => $this->registerTotals(),
            'events' => $this->week(),
            'activity' => $this->activity(),
            // The AI Record Search card: whether Gemini is set up, and where a strong match starts.
            'ai' => ['ready' => $this->embedder->configured(), 'strong' => RecordSearch::thresholds()['strong']],
        ]);
    }

    /**
     * Requests waiting on the office: new ones, and ones being checked that
     * haven't gone to the priest yet.
     *
     * @return list<array<string, mixed>>
     */
    private function queue(): array
    {
        return RecordRequest::query()
            ->with(['recordType', 'handledByStaff', 'requestDocuments'])
            ->where(fn ($q) => $q->where('status', RecordRequestStatus::Pending->value)
                ->orWhere(fn ($q) => $q->where('status', RecordRequestStatus::UnderVerification->value)->whereNull('sent_to_priest_at')))
            ->orderBy('requested_at')
            ->get()
            ->map(function (RecordRequest $r) {
                $docs = $r->requestDocuments;

                return [
                    'number' => $r->request_number,
                    'recordType' => $r->recordType?->name,
                    'requestType' => $r->request_type->value,
                    'subject' => RecordRequests::subject($r),
                    'client' => $r->client_full_name,
                    'submittedAt' => $r->requested_at->toIso8601String(),
                    'status' => $r->status->value,
                    'documents' => [
                        'total' => $docs->count(),
                        'verified' => $docs->filter(fn (RequestDocument $d) => $d->document_id && $d->verification_status === DocumentVerificationStatus::Verified)->count(),
                        'resubmit' => $docs->filter(fn (RequestDocument $d) => ! $d->document_id
                            || in_array($d->verification_status, [DocumentVerificationStatus::NeedsResubmission, DocumentVerificationStatus::Rejected], true))->count(),
                    ],
                    'detailsReturned' => $r->details_returned_at !== null,
                    'assignee' => DisplayName::of($r->handledByStaff),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<string, int>
     */
    private function registerTotals(): array
    {
        $counts = SacramentalRecord::query()
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->selectRaw('sacrament_types.name as type, count(*) as total')
            ->groupBy('sacrament_types.name')
            ->pluck('total', 'type');

        return collect(SacramentalRegister::TYPES)->mapWithKeys(fn (string $t) => [$t => (int) ($counts[$t] ?? 0)])->all();
    }

    /**
     * Appointments from now through the next seven days, rejected and cancelled left out.
     *
     * @return list<array<string, mixed>>
     */
    private function week(): array
    {
        $now = Date::now();

        return Appointment::query()
            ->with(['chapel.sona', 'assignedStaff'])
            ->whereIn('status', [AppointmentStatus::Pending->value, AppointmentStatus::Approved->value])
            ->where('scheduled_start', '>=', $now)
            ->where('scheduled_start', '<', $now->copy()->addDays(7))
            ->orderBy('scheduled_start')
            ->get()
            ->map(fn (Appointment $a) => [
                'id' => $a->appointment_id,
                'type' => $a->event_type,
                'title' => $a->event_title,
                'start' => $a->scheduled_start->toIso8601String(),
                'venue' => match ($a->venue_type) {
                    VenueType::Home => "Client's Home",
                    VenueType::Chapel => 'Chapel',
                    default => 'Parish Church',
                },
                'place' => $a->chapel ? collect([$a->chapel->name, $a->chapel->sona?->name])->filter()->implode(' · ') : null,
                'status' => $a->status->value,
                'assigned' => DisplayName::of($a->assignedStaff),
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, string>>
     */
    private function activity(): array
    {
        $codes = collect(self::ACTIVITY_CATEGORIES)->flatMap(fn ($c) => AuditActions::inCategory($c))->all();

        return AuditLog::query()->with('user')
            ->whereNotNull('user_id')
            ->whereIn('action', $codes)
            ->orderByDesc('timestamp')
            ->limit(self::ACTIVITY)
            ->get()
            ->map(fn (AuditLog $l) => [
                'id' => (string) $l->getKey(),
                'by' => $l->user?->displayName() ?? 'Someone',
                'action' => AuditActions::describe($l->action)['label'],
                'record' => $this->reports->recordOf($l),
                'details' => $this->reports->detailsOf($l),
                'at' => $l->timestamp->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}

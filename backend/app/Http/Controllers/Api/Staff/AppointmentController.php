<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\AppointmentStatus;
use App\Enums\UserRole;
use App\Enums\VenueType;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Notification;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\DisplayName;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Appointments & Events for the parish office: every request with its venue,
 * requester, and details, and the decisions on them. Each decision notifies
 * the requester and is written to the audit log.
 */
class AppointmentController extends Controller
{
    /** Months of decided appointments sent before and after today; pending requests are always sent. */
    private const MONTHS_BACK = 6;

    private const MONTHS_AHEAD = 12;

    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/secretary/appointments',
        summary: 'Pending requests, plus decided appointments from 6 months back to 12 months ahead',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Appointments')],
    )]
    public function index(): JsonResponse
    {
        $now = CarbonImmutable::now();

        $appointments = Appointment::query()
            ->with(['chapel.sona', 'chapel.president', 'assignedStaff.role'])
            ->where(fn ($q) => $q->where('status', AppointmentStatus::Pending->value)
                ->orWhereBetween('scheduled_start', [$now->subMonths(self::MONTHS_BACK), $now->addMonths(self::MONTHS_AHEAD)]))
            ->orderBy('scheduled_start')
            ->get();

        return response()->json(['data' => $appointments->map($this->present(...))->values()]);
    }

    #[OA\Get(
        path: '/api/secretary/appointments/assignees',
        summary: 'Active priests and staff who can lead an appointment',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'user_id, name, and role for each')],
    )]
    public function assignees(): JsonResponse
    {
        $people = self::assignable()->with('role')->orderBy('first_name')->orderBy('last_name')->get()
            ->map(fn (User $u) => ['user_id' => $u->user_id, 'name' => DisplayName::of($u), 'role' => $u->roleType()?->value])
            // Priests first, as they lead most appointments.
            ->sortBy(fn ($p) => $p['role'] === UserRole::ParishPriest->value ? 0 : 1, SORT_REGULAR)
            ->values();

        return response()->json(['data' => $people]);
    }

    #[OA\Post(
        path: '/api/secretary/appointments/{appointment}/approve',
        summary: 'Approve a pending request at its requested time and assign who leads it',
        tags: ['Staff'],
        responses: [
            new OA\Response(response: 200, description: 'Approved; returns the appointment'),
            new OA\Response(response: 409, description: 'The request is no longer pending'),
            new OA\Response(response: 422, description: 'No valid assignee'),
        ],
    )]
    public function approve(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate(['assigned_staff_id' => $this->assigneeRule()]);

        return $this->decide($request, $appointment, [AppointmentStatus::Pending], function (Appointment $a) use ($data) {
            $a->fill(['status' => AppointmentStatus::Approved, 'assigned_staff_id' => $data['assigned_staff_id']]);

            return ['APPOINTMENT_APPROVED', "Your appointment “{$a->event_title}” is confirmed for ".self::when($a).'.'];
        });
    }

    #[OA\Post(
        path: '/api/secretary/appointments/{appointment}/reject',
        summary: 'Reject a pending request with a reason the requester sees',
        tags: ['Staff'],
        responses: [
            new OA\Response(response: 200, description: 'Rejected; returns the appointment'),
            new OA\Response(response: 409, description: 'The request is no longer pending'),
            new OA\Response(response: 422, description: 'Missing or too short reason'),
        ],
    )]
    public function reject(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'min:8', 'max:1000']], [
            'reason.min' => 'Give a reason the requester will understand.',
        ]);

        return $this->decide($request, $appointment, [AppointmentStatus::Pending], function (Appointment $a) use ($data) {
            $a->fill(['status' => AppointmentStatus::Rejected, 'staff_remarks' => trim($data['reason'])]);

            return ['APPOINTMENT_REJECTED', "Your appointment request “{$a->event_title}” was declined: ".trim($data['reason'])];
        });
    }

    #[OA\Post(
        path: '/api/secretary/appointments/{appointment}/reschedule',
        summary: 'Move a pending or approved appointment to a new date and time; it is approved at the new time',
        description: 'date is YYYY-MM-DD and time HH:MM, both in parish time.',
        tags: ['Staff'],
        responses: [
            new OA\Response(response: 200, description: 'Rescheduled; returns the appointment'),
            new OA\Response(response: 409, description: 'The appointment was rejected or cancelled'),
            new OA\Response(response: 422, description: 'Invalid or past date, missing message, or no valid assignee'),
        ],
    )]
    public function reschedule(Request $request, Appointment $appointment): JsonResponse
    {
        $today = CarbonImmutable::now(self::timezone())->toDateString();
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$today],
            'time' => ['required', 'date_format:H:i', function (string $attribute, mixed $value, Closure $fail) use ($request) {
                $start = self::localStart((string) $request->input('date'), (string) $value);
                if ($start && $start->isPast()) {
                    $fail('Choose a time that hasn’t passed yet.');
                }
            }],
            'message' => ['required', 'string', 'min:8', 'max:1000'],
            'assigned_staff_id' => $this->assigneeRule(),
        ], [
            'date.after_or_equal' => 'Choose a date from today on.',
            'message.required' => 'Tell the requester why it moved.',
            'message.min' => 'Tell the requester why it moved.',
        ]);

        return $this->decide($request, $appointment, [AppointmentStatus::Pending, AppointmentStatus::Approved], function (Appointment $a) use ($data) {
            $minutes = (int) $a->scheduled_start->diffInMinutes($a->scheduled_end) ?: (int) config('appointments.duration_minutes');
            $start = self::localStart($data['date'], $data['time'])->utc();
            $a->fill([
                'status' => AppointmentStatus::Approved,
                'scheduled_start' => $start,
                'scheduled_end' => $start->addMinutes($minutes),
                'assigned_staff_id' => $data['assigned_staff_id'],
                'staff_remarks' => trim($data['message']),
            ]);

            return ['APPOINTMENT_RESCHEDULED', "Your appointment “{$a->event_title}” was moved to ".self::when($a).': '.trim($data['message'])];
        });
    }

    #[OA\Post(
        path: '/api/secretary/appointments/{appointment}/assign',
        summary: 'Change the priest or staff member who leads an appointment',
        tags: ['Staff'],
        responses: [
            new OA\Response(response: 200, description: 'Saved; returns the appointment'),
            new OA\Response(response: 409, description: 'The appointment was rejected or cancelled'),
            new OA\Response(response: 422, description: 'No valid assignee'),
        ],
    )]
    public function assign(Request $request, Appointment $appointment): JsonResponse
    {
        $data = $request->validate(['assigned_staff_id' => $this->assigneeRule()]);

        return $this->decide($request, $appointment, [AppointmentStatus::Pending, AppointmentStatus::Approved], function (Appointment $a) use ($data) {
            $a->fill(['assigned_staff_id' => $data['assigned_staff_id']]);

            // Who leads it is internal; the requester isn't notified.
            return ['APPOINTMENT_ASSIGNED', null];
        });
    }

    /**
     * Applies a change under a row lock, so two staff members can't decide the same request at once.
     *
     * @param  list<AppointmentStatus>  $allowed  statuses the change can start from
     * @param  Closure(Appointment): array{string, string|null}  $change  fills the model; returns the audit action and the requester's notice
     */
    private function decide(Request $request, Appointment $appointment, array $allowed, Closure $change): JsonResponse
    {
        $result = DB::transaction(function () use ($request, $appointment, $allowed, $change) {
            /** @var Appointment $a */
            $a = Appointment::query()->lockForUpdate()->findOrFail($appointment->getKey());
            if (! in_array($a->status, $allowed, true)) {
                return null;
            }

            $before = ['status' => $a->status->value, 'scheduled_start' => $a->scheduled_start->toIso8601String(), 'assigned_staff_id' => $a->assigned_staff_id];
            [$action, $notice] = $change($a);
            $changes = [];
            foreach (array_keys($a->getDirty()) as $field) {
                $old = $a->getOriginal($field);
                $new = $a->getAttribute($field);
                $changes[$field] = [$old instanceof \BackedEnum ? $old->value : (string) $old, $new instanceof \BackedEnum ? $new->value : (string) $new];
            }
            $a->save();

            // Bookings from the public site have no inbox; the requester sees the change by reference number.
            if ($notice && $a->requested_by_user_id !== null) {
                Notification::create(['user_id' => $a->requested_by_user_id, 'appointment_id' => $a->appointment_id, 'message' => $notice]);
            }
            $this->audit->log($action, 'appointments_and_events', $a->appointment_id, $request->user(), ['before' => $before, 'changes' => $changes]);

            return $a;
        });

        if (! $result) {
            return response()->json(['message' => 'Someone already updated this appointment. Reload to see where it stands.'], 409);
        }

        return response()->json(['data' => $this->present($result->load(['chapel.sona', 'chapel.president', 'assignedStaff.role']))]);
    }

    /**
     * @return array<int, mixed>
     */
    private function assigneeRule(): array
    {
        return [
            'required', 'uuid',
            Rule::exists('users', 'user_id')->where(fn ($q) => $q->where('is_active', true)
                ->whereIn('role_id', DB::table('roles')->whereIn('role_name', [UserRole::ParishPriest->value, UserRole::ParishStaff->value])->pluck('role_id'))),
        ];
    }

    /**
     * @return Builder<User>
     */
    private static function assignable(): Builder
    {
        return User::query()->where('is_active', true)
            ->whereHas('role', fn ($q) => $q->whereIn('role_name', [UserRole::ParishPriest->value, UserRole::ParishStaff->value]));
    }

    private static function localStart(string $date, string $time): ?CarbonImmutable
    {
        try {
            return CarbonImmutable::createFromFormat('Y-m-d H:i', "{$date} {$time}", self::timezone()) ?: null;
        } catch (\Throwable) {
            return null;
        }
    }

    private static function when(Appointment $a): string
    {
        return $a->scheduled_start->copy()->setTimezone(self::timezone())->format('l, F j, Y \a\t g:i A');
    }

    private static function timezone(): string
    {
        return (string) config('app.parish_timezone', 'Asia/Manila');
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Appointment $a): array
    {
        $details = $a->event_details ?? [];
        $president = $a->chapel?->president;

        return [
            'appointment_id' => $a->appointment_id,
            'reference_number' => $a->reference_number,
            'event_type' => $a->event_type,
            'event_title' => $a->event_title,
            'status' => $a->status->value,
            'venue_type' => $a->venue_type->value,
            'sona_id' => $a->chapel?->sona_id ?? $a->sona_id,
            'sona_name' => $a->chapel?->sona?->name,
            'chapel_id' => $a->chapel_id,
            'chapel_name' => $a->chapel?->name,
            'chapel_president' => $a->venue_type === VenueType::Chapel && $president ? [
                'name' => $president->name,
                'contact_number' => $president->contact_number,
                'fb_account' => $president->fb_account,
            ] : null,
            'house_address' => $a->house_address,
            'scheduled_start' => $a->scheduled_start->toIso8601String(),
            'scheduled_end' => $a->scheduled_end->toIso8601String(),
            'requester' => [
                'name' => $a->requester_name,
                'contact_number' => $a->requester_contact,
                'email' => $a->requester_email,
            ],
            'intention_category' => $a->intention_category?->value,
            'intention_details' => $a->intention_details,
            'attendee_count' => $a->attendee_count,
            'notes' => $details['notes'] ?? null,
            'couple' => isset($details['groom_name']) ? [
                'groom_name' => $details['groom_name'],
                'groom_contact' => $details['groom_contact'] ?? null,
                'bride_name' => $details['bride_name'] ?? null,
                'bride_contact' => $details['bride_contact'] ?? null,
            ] : null,
            'assigned_staff_id' => $a->assigned_staff_id,
            'assigned_name' => DisplayName::of($a->assignedStaff),
            'staff_remarks' => $a->staff_remarks,
            'created_at' => $a->created_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\AppointmentStatus;
use App\Enums\ApprovalStatus;
use App\Enums\IntentionCategory;
use App\Enums\VenueType;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Support\PhoneNumber;
use App\Support\ReferenceNumber;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Book Appointment on the public site: open times for a venue, sending a
 * request, and looking one up by its reference number. No account is needed.
 * Staff confirm, move, or decline requests from the staff portal.
 */
class AppointmentController extends Controller
{
    public function __construct(private AuditLogger $audit, private OfficeNotifier $notifier) {}

    #[OA\Get(
        path: '/api/public/appointments/availability',
        summary: 'Bookable dates and times for a venue, with the times already taken',
        description: 'Times are in the parish’s local time. chapel_id is required for a Chapel venue.',
        tags: ['Public'],
        parameters: [
            new OA\Parameter(name: 'venue_type', in: 'query', required: true, schema: new OA\Schema(type: 'string', enum: ['Parish Church', 'Chapel', 'Home'])),
            new OA\Parameter(name: 'chapel_id', in: 'query', required: false, schema: new OA\Schema(type: 'integer')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'first_date, last_date, times, and taken {date, time} pairs'),
            new OA\Response(response: 422, description: 'Unknown venue or chapel'),
        ],
    )]
    public function availability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'venue_type' => ['required', Rule::enum(VenueType::class)],
            'chapel_id' => [
                Rule::requiredIf($request->input('venue_type') === VenueType::Chapel->value),
                'nullable', 'integer', Rule::exists('chapels', 'chapel_id')->where('is_active', true)->where('approval_status', ApprovalStatus::Approved->value),
            ],
        ]);

        $venue = VenueType::from($data['venue_type']);
        $chapelId = $venue === VenueType::Chapel ? (int) $data['chapel_id'] : null;
        [$first, $last] = $this->window();
        $times = self::times($venue);

        $busy = $this->busy($venue, $chapelId)
            ->where('scheduled_start', '<', $last->endOfDay()->utc())
            ->where('scheduled_end', '>', $first->utc())
            ->get(['scheduled_start', 'scheduled_end']);

        $taken = [];
        for ($day = $first; $day->lte($last); $day = $day->addDay()) {
            foreach ($times as $time) {
                [$start, $end] = $this->slot($day->toDateString(), $time);
                if (self::overlapsAny($busy, $start, $end)) {
                    $taken[] = ['date' => $day->toDateString(), 'time' => $time];
                }
            }
        }

        return response()->json([
            'timezone' => self::timezone(),
            'duration_minutes' => self::duration(),
            'first_date' => $first->toDateString(),
            'last_date' => $last->toDateString(),
            'times' => $times,
            'taken' => $taken,
        ]);
    }

    #[OA\Post(
        path: '/api/public/appointments',
        summary: 'Request an appointment at an open date and time',
        description: 'The request starts as Pending. The response carries the reference_number the requester tracks it with.',
        tags: ['Public'],
        responses: [
            new OA\Response(response: 201, description: 'Requested; returns the appointment with its reference number'),
            new OA\Response(response: 422, description: 'Invalid input, or the time is no longer open'),
        ],
    )]
    public function store(Request $request): JsonResponse
    {
        $request->merge(array_map(fn ($v) => is_string($v) ? trim($v) : $v, $request->all()));
        foreach (['contact_number', 'groom_contact', 'bride_contact'] as $phone) {
            if ($request->filled($phone)) {
                $request->merge([$phone => PhoneNumber::normalize($request->input($phone))]);
            }
        }

        $venue = VenueType::tryFrom((string) $request->input('venue_type'));
        $eventType = (string) $request->input('event_type');
        $mass = $eventType === 'Mass Intention';
        $wedding = $eventType === 'Wedding Pre-interview';
        $needsChapel = $venue === VenueType::Chapel || $venue === VenueType::Home;
        [$first, $last] = $this->window();

        $data = $request->validate([
            'event_type' => ['required', Rule::in(config('appointments.event_types'))],
            'event_title' => ['required', 'string', 'max:150'],
            'venue_type' => ['required', Rule::enum(VenueType::class)],
            'sona_id' => [Rule::requiredIf($needsChapel), 'nullable', 'integer', Rule::exists('sonas', 'sona_id')],
            'chapel_id' => [
                Rule::requiredIf($needsChapel), 'nullable', 'integer',
                Rule::exists('chapels', 'chapel_id')->where('is_active', true)->where('approval_status', ApprovalStatus::Approved->value)->where('sona_id', $request->integer('sona_id')),
            ],
            'house_address' => [Rule::requiredIf($venue === VenueType::Home), 'nullable', 'string', 'max:250'],
            'full_name' => ['required', 'string', 'max:200'],
            'email' => ['nullable', 'email', 'max:150'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.$first->toDateString(), 'before_or_equal:'.$last->toDateString()],
            'time' => ['required', 'string', Rule::in($venue ? self::times($venue) : [])],
            'contact_number' => ['required', 'string', PhoneNumber::RULE],
            'intention_category' => [Rule::requiredIf($mass), 'nullable', Rule::enum(IntentionCategory::class)],
            'intention_details' => [Rule::requiredIf($mass), 'nullable', 'string', 'max:1000'],
            'groom_name' => [Rule::requiredIf($wedding), 'nullable', 'string', 'max:200'],
            'groom_contact' => [Rule::requiredIf($wedding), 'nullable', 'string', PhoneNumber::RULE],
            'bride_name' => [Rule::requiredIf($wedding), 'nullable', 'string', 'max:200'],
            'bride_contact' => [Rule::requiredIf($wedding), 'nullable', 'string', PhoneNumber::RULE],
            'attendee_count' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'privacy_consent' => ['accepted'],
        ], [
            'contact_number.regex' => PhoneNumber::MESSAGE,
            'groom_contact.regex' => PhoneNumber::MESSAGE,
            'bride_contact.regex' => PhoneNumber::MESSAGE,
            'chapel_id.exists' => 'Choose one of the chapels listed for this Sona.',
            'date.after_or_equal' => 'Choose a date from '.$first->format('F j').' on.',
            'date.before_or_equal' => 'Bookings open only up to '.$last->format('F j, Y').'.',
            'time.in' => 'Choose one of the open times for this venue.',
            'privacy_consent.accepted' => 'Please accept the privacy notice to submit.',
        ]);

        [$start, $end] = $this->slot($data['date'], $data['time']);
        $chapelId = $needsChapel ? (int) $data['chapel_id'] : null;

        $details = array_filter([
            'groom_name' => $wedding ? $data['groom_name'] : null,
            'groom_contact' => $wedding ? $data['groom_contact'] : null,
            'bride_name' => $wedding ? $data['bride_name'] : null,
            'bride_contact' => $wedding ? $data['bride_contact'] : null,
            'notes' => $data['notes'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');

        $appointment = DB::transaction(function () use ($data, $venue, $chapelId, $start, $end, $mass, $details) {
            // One booking at a time per venue (and chapel), so two people can't take the same slot.
            DB::select('SELECT pg_advisory_xact_lock(?)', [crc32("appointments|{$venue->value}|{$chapelId}")]);

            $clash = $this->busy($venue, $chapelId)
                ->where('scheduled_start', '<', $end)
                ->where('scheduled_end', '>', $start)
                ->exists();
            if ($clash) {
                throw ValidationException::withMessages(['time' => 'Someone just booked that time. Please pick another.']);
            }

            return Appointment::create([
                'event_type' => $data['event_type'],
                'event_title' => $data['event_title'],
                'scheduled_start' => $start,
                'scheduled_end' => $end,
                'status' => AppointmentStatus::Pending,
                'venue_type' => $venue,
                'sona_id' => $chapelId ? $data['sona_id'] : null,
                'chapel_id' => $chapelId,
                'house_address' => $venue === VenueType::Home ? $data['house_address'] : null,
                'requester_name' => $data['full_name'],
                'requester_contact' => $data['contact_number'],
                'requester_email' => $data['email'] ?? null,
                'intention_category' => $mass ? $data['intention_category'] : null,
                'intention_details' => $mass ? $data['intention_details'] : null,
                'attendee_count' => $data['attendee_count'] ?? null,
                'event_details' => $details ?: null,
                'privacy_consent' => true,
            ]);
        });

        $this->audit->log('APPOINTMENT_REQUESTED', 'appointments_and_events', $appointment->appointment_id, null, [
            'reference_number' => $appointment->reference_number,
            'event_type' => $appointment->event_type,
            'venue_type' => $venue->value,
            'scheduled_start' => $start->toIso8601String(),
        ]);
        $this->notifier->newBooking($appointment);

        return response()->json(['data' => $this->present($appointment->load('chapel.sona'))], 201);
    }

    #[OA\Get(
        path: '/api/public/appointments/{reference}',
        summary: 'Track an appointment request by its reference number',
        tags: ['Public'],
        responses: [
            new OA\Response(response: 200, description: 'The appointment and where it stands'),
            new OA\Response(response: 404, description: 'No appointment has this reference number'),
        ],
    )]
    public function show(string $reference): JsonResponse
    {
        $number = ReferenceNumber::normalize($reference, ReferenceNumber::APPOINTMENT);
        $appointment = $number ? Appointment::query()->with('chapel.sona')->where('reference_number', $number)->first() : null;
        abort_if($appointment === null, 404, 'No appointment has this reference number.');

        return response()->json(['data' => $this->present($appointment)]);
    }

    /**
     * Pending and Approved appointments that hold time at this venue.
     *
     * @return Builder<Appointment>
     */
    private function busy(VenueType $venue, ?int $chapelId): Builder
    {
        return Appointment::query()
            ->where('venue_type', $venue->value)
            ->whereIn('status', [AppointmentStatus::Pending->value, AppointmentStatus::Approved->value])
            ->when($venue === VenueType::Chapel, fn ($q) => $q->where('chapel_id', $chapelId));
    }

    /**
     * First and last bookable days, at local midnight.
     *
     * @return array{CarbonImmutable, CarbonImmutable}
     */
    private function window(): array
    {
        $today = CarbonImmutable::now(self::timezone())->startOfDay();

        return [
            $today->addDays((int) config('appointments.min_notice_days')),
            $today->addDays((int) config('appointments.booking_window_days')),
        ];
    }

    /**
     * @return array{CarbonImmutable, CarbonImmutable} start and end in UTC
     */
    private function slot(string $date, string $time): array
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$date} {$time}", self::timezone())->utc();

        return [$start, $start->addMinutes(self::duration())];
    }

    /**
     * @param  Collection<int, Appointment>  $busy
     */
    private static function overlapsAny(Collection $busy, CarbonImmutable $start, CarbonImmutable $end): bool
    {
        return $busy->contains(fn (Appointment $a) => $a->scheduled_start->lt($end) && $a->scheduled_end->gt($start));
    }

    /**
     * @return list<string>
     */
    private static function times(VenueType $venue): array
    {
        return array_values(config("appointments.slots.{$venue->value}", []));
    }

    private static function timezone(): string
    {
        return (string) config('app.parish_timezone', 'Asia/Manila');
    }

    private static function duration(): int
    {
        return max(1, (int) config('appointments.duration_minutes'));
    }

    /**
     * What the requester sees. Anyone holding the reference number can read
     * this, so the requester's contact details and house address stay out.
     *
     * @return array<string, mixed>
     */
    private function present(Appointment $a): array
    {
        $local = $a->scheduled_start->copy()->setTimezone(self::timezone());

        return [
            'reference_number' => $a->reference_number,
            'event_type' => $a->event_type,
            'event_title' => $a->event_title,
            'status' => $a->status->value,
            'venue_type' => $a->venue_type->value,
            'venue' => match ($a->venue_type) {
                VenueType::ParishChurch => 'Parish Church',
                VenueType::Chapel => $a->chapel?->name ?? 'Chapel',
                VenueType::Home => 'Home',
            },
            'sona_name' => $a->chapel?->sona?->name,
            'chapel_name' => $a->chapel?->name,
            'date' => $local->toDateString(),
            'time' => $local->format('H:i'),
            'scheduled_start' => $a->scheduled_start->toIso8601String(),
            'scheduled_end' => $a->scheduled_end->toIso8601String(),
            'intention_category' => $a->intention_category?->value,
            'intention_details' => $a->intention_details,
            'attendee_count' => $a->attendee_count,
            'notes' => $a->event_details['notes'] ?? null,
            'staff_remarks' => $a->staff_remarks,
            'created_at' => $a->created_at?->toIso8601String(),
        ];
    }
}

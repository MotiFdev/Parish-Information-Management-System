<?php

namespace Tests\Feature\Public;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Chapel;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AppointmentTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/parishioner/appointments']);
        $this->date = CarbonImmutable::now('Asia/Manila')->addDays(3)->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    private function form(array $overrides = []): array
    {
        return [
            'event_type' => 'Mass Intention',
            'event_title' => 'Mass Intention for the Santos Family',
            'venue_type' => 'Parish Church',
            'date' => $this->date,
            'time' => '08:00',
            'full_name' => 'Maria Santos',
            'contact_number' => '0917 555 0142',
            'email' => 'maria@example.com',
            'intention_category' => 'Thanksgiving',
            'intention_details' => 'Santos family',
            'privacy_consent' => true,
            ...$overrides,
        ];
    }

    public function test_booking_without_an_account_returns_a_reference_number(): void
    {
        $response = $this->postJson('/api/public/appointments', $this->form(['notes' => 'Our 10th year here.']))
            ->assertCreated()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.venue', 'Parish Church')
            ->assertJsonPath('data.date', $this->date)
            ->assertJsonPath('data.time', '08:00')
            ->assertJsonPath('data.notes', 'Our 10th year here.');

        $reference = $response->json('data.reference_number');
        $this->assertMatchesRegularExpression('/^AP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/', $reference);

        $appointment = Appointment::where('reference_number', $reference)->sole();
        $this->assertNull($appointment->requested_by_user_id);
        $this->assertSame('Maria Santos', $appointment->requester_name);
        $this->assertSame('09175550142', $appointment->requester_contact);
        $this->assertSame('maria@example.com', $appointment->requester_email);
        $this->assertSame(60, (int) $appointment->scheduled_start->diffInMinutes($appointment->scheduled_end));
        // 8:00 AM in Manila is midnight UTC.
        $this->assertSame("{$this->date}T00:00:00+00:00", $appointment->scheduled_start->utc()->toIso8601String());
        $this->assertTrue(AuditLog::where('action', 'APPOINTMENT_REQUESTED')->where('record_id_affected', $appointment->appointment_id)->whereNull('user_id')->exists());
    }

    public function test_the_requester_needs_a_name_and_number_and_email_is_optional(): void
    {
        $this->postJson('/api/public/appointments', $this->form(['full_name' => '', 'contact_number' => '']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['full_name', 'contact_number']);

        $this->postJson('/api/public/appointments', $this->form(['email' => 'not-an-email']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);

        $this->postJson('/api/public/appointments', $this->form(['email' => null]))->assertCreated();
        $this->assertNull(Appointment::sole()->requester_email);
    }

    public function test_tracking_by_reference_shows_the_status_but_not_contact_details(): void
    {
        $chapel = Chapel::where('is_active', true)->firstOrFail();
        $reference = $this->postJson('/api/public/appointments', $this->form([
            'event_type' => 'House Blessing', 'venue_type' => 'Home', 'time' => '09:00',
            'sona_id' => $chapel->sona_id, 'chapel_id' => $chapel->chapel_id, 'house_address' => 'Purok 3, Brgy. San Isidro',
        ]))->assertCreated()->json('data.reference_number');

        $response = $this->getJson("/api/public/appointments/{$reference}")
            ->assertOk()
            ->assertJsonPath('data.reference_number', $reference)
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.venue', 'Home')
            ->assertJsonPath('data.chapel_name', $chapel->name);

        $body = $response->getContent();
        foreach (['Purok 3', '09175550142', 'maria@example.com', 'Maria Santos', 'appointment_id'] as $private) {
            $this->assertStringNotContainsString($private, $body);
        }
    }

    public function test_tracking_accepts_the_reference_as_people_type_it(): void
    {
        $reference = $this->postJson('/api/public/appointments', $this->form())->json('data.reference_number');
        $typed = strtolower(str_replace('-', ' ', $reference));

        $this->getJson('/api/public/appointments/'.rawurlencode($typed))->assertOk()->assertJsonPath('data.reference_number', $reference);
    }

    public function test_unknown_or_malformed_references_are_not_found(): void
    {
        $this->postJson('/api/public/appointments', $this->form())->assertCreated();

        $this->getJson('/api/public/appointments/AP-2222-2222')->assertNotFound();
        // Record request references don't open appointments.
        $this->getJson('/api/public/appointments/RR-2222-2222')->assertNotFound();
        // 0, 1, I, and O are never used.
        $this->getJson('/api/public/appointments/AP-0000-1111')->assertNotFound();
    }

    public function test_home_and_chapel_venues_need_a_chapel_in_the_chosen_sona(): void
    {
        $chapel = Chapel::where('is_active', true)->firstOrFail();
        $otherSonaChapel = Chapel::where('is_active', true)->where('sona_id', '<>', $chapel->sona_id)->firstOrFail();

        $this->postJson('/api/public/appointments', $this->form(['venue_type' => 'Home', 'time' => '09:00']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sona_id', 'chapel_id', 'house_address']);

        $this->postJson('/api/public/appointments', $this->form([
            'venue_type' => 'Chapel', 'time' => '09:00', 'sona_id' => $chapel->sona_id, 'chapel_id' => $otherSonaChapel->chapel_id,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['chapel_id']);

        $this->postJson('/api/public/appointments', $this->form([
            'event_type' => 'House Blessing', 'venue_type' => 'Home', 'time' => '09:00',
            'sona_id' => $chapel->sona_id, 'chapel_id' => $chapel->chapel_id, 'house_address' => 'Purok 3, Brgy. San Isidro',
        ]))->assertCreated()->assertJsonPath('data.intention_category', null);

        $this->assertSame('Purok 3, Brgy. San Isidro', Appointment::sole()->house_address);
    }

    public function test_wedding_pre_interview_needs_the_couple(): void
    {
        $this->postJson('/api/public/appointments', $this->form(['event_type' => 'Wedding Pre-interview']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['groom_name', 'groom_contact', 'bride_name', 'bride_contact']);

        $reference = $this->postJson('/api/public/appointments', $this->form([
            'event_type' => 'Wedding Pre-interview', 'groom_name' => 'Joshua Reyes', 'groom_contact' => '0917 000 3410',
            'bride_name' => 'Kristine Uy', 'bride_contact' => '0917 000 3411',
        ]))->assertCreated()->json('data.reference_number');

        $details = Appointment::where('reference_number', $reference)->sole()->event_details;
        $this->assertSame('09170003410', $details['groom_contact']);
        $this->assertSame('Kristine Uy', $details['bride_name']);
    }

    public function test_times_outside_the_schedule_or_window_and_missing_consent_are_rejected(): void
    {
        $this->postJson('/api/public/appointments', $this->form([
            'time' => '07:15',
            'date' => CarbonImmutable::now('Asia/Manila')->toDateString(),
            'privacy_consent' => false,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['time', 'date', 'privacy_consent']);

        $this->postJson('/api/public/appointments', $this->form(['date' => CarbonImmutable::now('Asia/Manila')->addDays(61)->toDateString()]))
            ->assertUnprocessable()->assertJsonValidationErrors(['date']);
    }

    public function test_alternate_schedule_is_not_accepted_or_stored(): void
    {
        $this->postJson('/api/public/appointments', $this->form(['alt_start' => now()->addDays(4)->toIso8601String()]))
            ->assertCreated()
            ->assertJsonMissingPath('data.alt_start');

        $this->assertFalse(Schema::hasColumn('appointments_and_events', 'alt_start'));
    }

    public function test_a_taken_time_cannot_be_booked_again_and_shows_as_taken(): void
    {
        $this->postJson('/api/public/appointments', $this->form())->assertCreated();

        $this->postJson('/api/public/appointments', $this->form(['event_type' => 'General Counseling', 'event_title' => 'Counseling']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['time']);

        $this->getJson('/api/public/appointments/availability?venue_type=Parish%20Church')
            ->assertOk()
            ->assertJsonPath('times.0', '08:00')
            ->assertJsonCount(1, 'taken')
            ->assertJsonPath('taken.0', ['date' => $this->date, 'time' => '08:00']);

        // The same hour at a chapel is a different venue.
        $this->getJson('/api/public/appointments/availability?venue_type=Chapel&chapel_id='.Chapel::where('is_active', true)->value('chapel_id'))
            ->assertOk()
            ->assertJsonPath('taken', []);
    }

    public function test_cancelled_or_rejected_appointments_free_the_time(): void
    {
        $this->postJson('/api/public/appointments', $this->form())->assertCreated();
        Appointment::query()->update(['status' => 'Rejected']);

        $this->postJson('/api/public/appointments', $this->form())->assertCreated();
    }
}

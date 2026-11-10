<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\Notification;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppointmentTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    private User $priest;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/staff/appointments']);
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->priest = User::factory()->role(UserRole::ParishPriest)->create(['first_name' => 'Antonio', 'last_name' => 'Reyes']);
    }

    private function book(array $overrides = []): Appointment
    {
        $reference = $this->postJson('/api/public/appointments', [
            'event_type' => 'Mass Intention',
            'full_name' => 'Maria Santos',
            'event_title' => 'Thanksgiving for the Santos Family',
            'venue_type' => 'Parish Church',
            'date' => CarbonImmutable::now('Asia/Manila')->addDays(3)->toDateString(),
            'time' => '08:00',
            'contact_number' => '09175550142',
            'intention_category' => 'Thanksgiving',
            'intention_details' => 'Santos family',
            'privacy_consent' => true,
            ...$overrides,
        ])->assertCreated()->json('data.reference_number');

        return Appointment::where('reference_number', $reference)->sole();
    }

    public function test_staff_see_requests_with_requester_and_details(): void
    {
        $chapel = Chapel::where('is_active', true)->firstOrFail();
        $this->book(['venue_type' => 'Chapel', 'time' => '09:00', 'sona_id' => $chapel->sona_id, 'chapel_id' => $chapel->chapel_id, 'notes' => 'Family of 20.']);

        $this->actingAs($this->staff)->getJson('/api/secretary/appointments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'Pending')
            ->assertJsonPath('data.0.chapel_name', $chapel->name)
            ->assertJsonPath('data.0.requester.name', 'Maria Santos')
            ->assertJsonPath('data.0.requester.contact_number', '09175550142')
            ->assertJsonPath('data.0.notes', 'Family of 20.')
            ->assertJsonPath('data.0.assigned_name', null);
    }

    public function test_chapel_events_show_the_latest_term_president(): void
    {
        $chapel = Chapel::where('is_active', true)->firstOrFail();
        ChapelOfficer::query()->where('chapel_id', $chapel->chapel_id)->delete();
        ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'name' => 'Old President', 'position' => 'President', 'term_year' => 2024, 'contact_number' => '09170000001', 'approval_status' => 'Approved']);
        ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'name' => 'Ramon Aquino', 'position' => 'President', 'term_year' => 2026, 'contact_number' => '09170006101', 'approval_status' => 'Approved']);
        // A newer president the PPC hasn't approved yet doesn't count.
        ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'name' => 'Not Yet Approved', 'position' => 'President', 'term_year' => 2027]);
        ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'name' => 'A Treasurer', 'position' => 'Treasurer', 'term_year' => 2027]);
        $this->book(['venue_type' => 'Chapel', 'time' => '09:00', 'sona_id' => $chapel->sona_id, 'chapel_id' => $chapel->chapel_id]);

        $this->actingAs($this->staff)->getJson('/api/secretary/appointments')
            ->assertOk()
            ->assertJsonPath('data.0.chapel_president.name', 'Ramon Aquino')
            ->assertJsonPath('data.0.chapel_president.contact_number', '09170006101');
    }

    public function test_assignees_are_active_priests_and_staff_with_priests_first(): void
    {
        User::factory()->role(UserRole::ParishPriest)->create(['is_active' => false]);

        $this->actingAs($this->staff)->getJson('/api/secretary/appointments/assignees')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.name', 'Fr. Antonio Reyes')
            ->assertJsonPath('data.1.name', 'Liza Mercado');
    }

    /** A booking made from a parishioner account, before parishioners stopped signing in. */
    private function bookFromRetiredAccount(): Appointment
    {
        $a = $this->book();
        $a->forceFill(['requested_by_user_id' => User::factory()->inactive()->create()->user_id])->save();

        return $a;
    }

    public function test_approving_assigns_and_audits_and_the_requester_sees_it_by_reference(): void
    {
        $a = $this->book();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])
            ->assertOk()
            ->assertJsonPath('data.status', 'Approved')
            ->assertJsonPath('data.reference_number', $a->reference_number)
            ->assertJsonPath('data.assigned_name', 'Fr. Antonio Reyes');

        $this->getJson("/api/public/appointments/{$a->reference_number}")->assertOk()->assertJsonPath('data.status', 'Approved');
        // A public booking has no inbox to notify.
        $this->assertSame(0, Notification::where('appointment_id', $a->appointment_id)->whereNull('kind')->count());
        $this->assertTrue(AuditLog::where('action', 'APPOINTMENT_APPROVED')->where('user_id', $this->staff->user_id)->exists());

        // Already decided: a second approval is refused.
        $this->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])->assertConflict();
    }

    public function test_bookings_from_retired_parishioner_accounts_still_get_their_notice(): void
    {
        $a = $this->bookFromRetiredAccount();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])->assertOk();

        $this->assertSame(1, Notification::where('user_id', $a->requested_by_user_id)->where('appointment_id', $a->appointment_id)->count());
    }

    public function test_only_active_priests_or_staff_can_be_assigned(): void
    {
        $a = $this->book();
        $admin = User::factory()->role(UserRole::SystemAdministrator)->create();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $admin->user_id])
            ->assertUnprocessable()->assertJsonValidationErrors(['assigned_staff_id']);
    }

    public function test_assignees_are_the_real_accounts_and_deactivated_ones_are_refused(): void
    {
        $a = $this->book();
        $ids = collect($this->actingAs($this->staff)->getJson('/api/secretary/appointments/assignees')->json('data'))->pluck('user_id');
        $this->assertEqualsCanonicalizing([$this->priest->user_id, $this->staff->user_id], $ids->all());

        $this->priest->forceFill(['is_active' => false])->save();

        $this->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])
            ->assertUnprocessable()->assertJsonValidationErrors(['assigned_staff_id']);
        $this->getJson('/api/secretary/appointments/assignees')->assertJsonCount(1, 'data')->assertJsonPath('data.0.user_id', $this->staff->user_id);
        $this->postJson('/api/secretary/appointments/'.$a->appointment_id.'/approve', ['assigned_staff_id' => '00000000-0000-0000-0000-000000000000'])
            ->assertUnprocessable()->assertJsonValidationErrors(['assigned_staff_id']);
    }

    public function test_rejecting_needs_a_reason_and_frees_the_time(): void
    {
        $a = $this->book();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/reject", ['reason' => 'no'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);

        $this->postJson("/api/secretary/appointments/{$a->appointment_id}/reject", ['reason' => 'The church is closed for repairs that day.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Rejected')
            ->assertJsonPath('data.staff_remarks', 'The church is closed for repairs that day.');

        $this->getJson("/api/public/appointments/{$a->reference_number}")
            ->assertJsonPath('data.status', 'Rejected')
            ->assertJsonPath('data.staff_remarks', 'The church is closed for repairs that day.');
        $this->book();
    }

    public function test_rescheduling_moves_and_approves_keeping_the_length(): void
    {
        $a = $this->book();
        $date = CarbonImmutable::now('Asia/Manila')->addDays(5)->toDateString();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/reschedule", [
            'date' => $date, 'time' => '10:15', 'message' => 'Fr. Antonio is away that morning.', 'assigned_staff_id' => $this->priest->user_id,
        ])->assertOk()->assertJsonPath('data.status', 'Approved');

        $a->refresh();
        $this->assertSame("{$date} 10:15", $a->scheduled_start->setTimezone('Asia/Manila')->format('Y-m-d H:i'));
        $this->assertSame(60, (int) $a->scheduled_start->diffInMinutes($a->scheduled_end));
        $this->assertSame('Fr. Antonio is away that morning.', $a->staff_remarks);
        $this->assertTrue(AuditLog::where('action', 'APPOINTMENT_RESCHEDULED')->exists());
    }

    public function test_rescheduling_to_the_past_is_refused(): void
    {
        $a = $this->book();

        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/reschedule", [
            'date' => CarbonImmutable::now('Asia/Manila')->subDay()->toDateString(), 'time' => '10:00',
            'message' => 'Moved for the fiesta.', 'assigned_staff_id' => $this->priest->user_id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['date']);
    }

    public function test_changing_the_assignee_does_not_notify_the_requester(): void
    {
        $a = $this->bookFromRetiredAccount();
        $this->actingAs($this->staff)->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])->assertOk();

        $this->postJson("/api/secretary/appointments/{$a->appointment_id}/assign", ['assigned_staff_id' => $this->staff->user_id])
            ->assertOk()->assertJsonPath('data.assigned_name', 'Liza Mercado');

        $this->assertSame(1, Notification::where('appointment_id', $a->appointment_id)->whereNull('kind')->count());
    }

    public function test_only_staff_can_use_the_office_endpoints(): void
    {
        $a = $this->book();

        $this->actingAs(User::factory()->role(UserRole::SystemAdministrator)->create())->getJson('/api/secretary/appointments')->assertForbidden();
        $this->actingAs($this->priest)->postJson("/api/secretary/appointments/{$a->appointment_id}/approve", ['assigned_staff_id' => $this->priest->user_id])->assertForbidden();
    }
}

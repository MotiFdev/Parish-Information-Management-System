<?php

namespace Tests\Feature\Community;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\CommunityEvent;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EventTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $gkk;

    private User $ppc;

    private ChapelOfficer $president;

    private ChapelOfficer $secretary;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/community/events']);
        $this->gkk = User::factory()->role(UserRole::GkkOfficer)->create(['first_name' => 'Rosa', 'last_name' => 'Lim']);
        $this->ppc = User::factory()->role(UserRole::PpcOfficer)->create(['first_name' => 'Noel', 'last_name' => 'Santos']);
        $chapel = Chapel::where('is_active', true)->firstOrFail();
        $this->president = ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'term_year' => 2026, 'name' => 'Ana Reyes', 'position' => 'President', 'approval_status' => 'Approved']);
        $this->secretary = ChapelOfficer::create(['chapel_id' => $chapel->chapel_id, 'term_year' => 2026, 'name' => 'Ben Cruz', 'position' => 'Secretary', 'approval_status' => 'Approved']);
        $this->date = CarbonImmutable::now('Asia/Manila')->addDays(10)->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    private function form(array $overrides = []): array
    {
        return [
            'name' => 'Sona Bible Sharing',
            'venue' => 'San Isidro Labrador Chapel',
            'event_date' => $this->date,
            'start_time' => '14:30',
            'officer_ids' => [$this->president->officer_id, $this->secretary->officer_id],
            ...$overrides,
        ];
    }

    private function create(?User $as = null): CommunityEvent
    {
        $id = $this->actingAs($as ?? $this->gkk)->postJson('/api/community/events', $this->form())->assertCreated()->json('data.event_id');

        return CommunityEvent::findOrFail($id);
    }

    public function test_setting_up_an_event_starts_it_as_pending_with_its_officers(): void
    {
        $this->actingAs($this->gkk)->postJson('/api/community/events', $this->form())
            ->assertCreated()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.event_date', $this->date)
            ->assertJsonPath('data.start_time', '14:30')
            ->assertJsonPath('data.created_by', 'Rosa Lim')
            ->assertJsonCount(2, 'data.officers')
            ->assertJsonPath('data.officers.0.name', 'Ana Reyes')
            ->assertJsonPath('data.officers.0.chapel_name', $this->president->chapel->name);

        $this->assertTrue(AuditLog::where('action', 'EVENT_CREATED')->where('user_id', $this->gkk->user_id)->exists());
    }

    public function test_pya_kkk_officers_use_the_same_portal(): void
    {
        $this->create(User::factory()->role(UserRole::PyaKkkOfficer)->create());

        $this->actingAs($this->gkk)->getJson('/api/community/events')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_an_event_needs_a_name_venue_future_date_start_time_and_an_officer(): void
    {
        $this->actingAs($this->gkk)->postJson('/api/community/events', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'venue', 'event_date', 'officer_ids', 'start_time' => 'Choose the time it starts.']);

        $this->postJson('/api/community/events', $this->form(['start_time' => '2:30 PM']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_time' => 'Enter the time like 14:30.']);

        $this->postJson('/api/community/events', $this->form([
            'event_date' => CarbonImmutable::now('Asia/Manila')->subDay()->toDateString(),
            'officer_ids' => ['00000000-0000-0000-0000-000000000000'],
        ]))->assertUnprocessable()->assertJsonValidationErrors([
            'event_date' => 'Choose today or a later date.',
            'officer_ids.0' => 'One of the chosen officers is not approved by the PPC or is no longer on the list. Reload and choose again.',
        ]);
    }

    public function test_officers_still_waiting_for_the_ppc_cannot_be_assigned(): void
    {
        $pending = ChapelOfficer::create(['chapel_id' => $this->president->chapel_id, 'term_year' => 2026, 'name' => 'New Member', 'position' => 'Member']);

        $this->actingAs($this->gkk)->postJson('/api/community/events', $this->form(['officer_ids' => [$pending->officer_id]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['officer_ids.0']);
    }

    public function test_ppc_approves_a_pending_event_once(): void
    {
        $event = $this->create();

        $this->actingAs($this->ppc)->getJson('/api/ppc/events?status=Pending')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/ppc/events/{$event->event_id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'Approved')
            ->assertJsonPath('data.reviewed_by', 'Noel Santos');
        $this->postJson("/api/ppc/events/{$event->event_id}/approve")->assertConflict();

        $this->assertTrue(AuditLog::where('action', 'EVENT_APPROVED')->where('user_id', $this->ppc->user_id)->exists());
    }

    public function test_ppc_must_give_a_reason_to_reject_and_organizers_see_it(): void
    {
        $event = $this->create();

        $this->actingAs($this->ppc)->postJson("/api/ppc/events/{$event->event_id}/reject", ['reason' => 'no'])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->postJson("/api/ppc/events/{$event->event_id}/reject", ['reason' => 'The chapel is booked for the fiesta that day.'])
            ->assertOk()->assertJsonPath('data.status', 'Rejected');

        $this->actingAs($this->gkk)->getJson('/api/community/events')
            ->assertJsonPath('data.0.status', 'Rejected')
            ->assertJsonPath('data.0.review_note', 'The chapel is booked for the fiesta that day.');
    }

    public function test_editing_a_decided_event_sends_it_back_to_the_ppc(): void
    {
        $event = $this->create();
        $this->actingAs($this->ppc)->postJson("/api/ppc/events/{$event->event_id}/approve")->assertOk();

        $this->actingAs($this->gkk)->patchJson("/api/community/events/{$event->event_id}", $this->form(['venue' => 'Parish Hall', 'start_time' => '09:00', 'officer_ids' => [$this->secretary->officer_id]]))
            ->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.venue', 'Parish Hall')
            ->assertJsonPath('data.start_time', '09:00')
            ->assertJsonPath('data.reviewed_by', null)
            ->assertJsonCount(1, 'data.officers');
    }

    public function test_deleting_an_event_and_removing_an_assigned_officer(): void
    {
        $event = $this->create();

        $this->actingAs($this->gkk)->deleteJson("/api/community/officers/{$this->president->officer_id}")->assertNoContent();
        $this->getJson('/api/community/events')->assertJsonCount(1, 'data.0.officers');

        $this->deleteJson("/api/community/events/{$event->event_id}")->assertNoContent();
        $this->assertDatabaseMissing('community_events', ['event_id' => $event->event_id]);
        $this->assertTrue(AuditLog::where('action', 'EVENT_DELETED')->exists());
    }

    public function test_each_portal_is_closed_to_the_other_roles(): void
    {
        $event = $this->create();

        $this->actingAs($this->ppc)->postJson('/api/community/events', $this->form())->assertForbidden();
        $this->actingAs($this->gkk)->postJson("/api/ppc/events/{$event->event_id}/approve")->assertForbidden();
        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create())->getJson('/api/ppc/events')->assertForbidden();
        $this->assertSame('Pending', $event->fresh()->status->value);
    }
}

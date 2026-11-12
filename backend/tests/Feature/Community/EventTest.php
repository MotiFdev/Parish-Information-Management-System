<?php

namespace Tests\Feature\Community;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\CommunityEvent;
use App\Models\Notification;
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

    private User $priest;

    private ChapelOfficer $president;

    private ChapelOfficer $secretary;

    private string $date;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/community/events']);
        $this->gkk = User::factory()->role(UserRole::GkkOfficer)->create(['first_name' => 'Rosa', 'last_name' => 'Lim']);
        $this->ppc = User::factory()->role(UserRole::PpcOfficer)->create(['first_name' => 'Noel', 'last_name' => 'Santos']);
        $this->priest = User::factory()->role(UserRole::ParishPriest)->create(['first_name' => 'Jose', 'last_name' => 'Dela Cruz']);
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
            'purpose' => 'Monthly Bible sharing for the families of the sona.',
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
            ->assertJsonPath('data.purpose', 'Monthly Bible sharing for the families of the sona.')
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
            ->assertJsonValidationErrors(['name', 'purpose' => 'Say what the event is for.', 'venue', 'event_date', 'officer_ids', 'start_time' => 'Choose the time it starts.']);

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

    private function preApprove(CommunityEvent $event): void
    {
        $this->actingAs($this->ppc)->postJson("/api/ppc/events/{$event->event_id}/pre-approve")->assertOk();
    }

    public function test_ppc_pre_approves_a_pending_event_once_and_the_priest_is_told(): void
    {
        $event = $this->create();

        $this->actingAs($this->ppc)->getJson('/api/ppc/events?status=Pending')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/ppc/events/{$event->event_id}/pre-approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'Pre-Approved')
            ->assertJsonPath('data.preapproved_by', 'Noel Santos')
            ->assertJsonPath('data.reviewed_by', null);
        $this->postJson("/api/ppc/events/{$event->event_id}/pre-approve")->assertConflict();

        $this->assertTrue(AuditLog::where('action', 'EVENT_PREAPPROVED')->where('user_id', $this->ppc->user_id)->exists());
        $this->assertTrue(Notification::where('user_id', $this->priest->user_id)->where('link', '/priest/events')->exists());
        $this->getJson('/api/public/events')->assertJsonCount(0, 'data');
    }

    public function test_the_priest_gives_the_final_approval_only_after_the_ppc(): void
    {
        $event = $this->create();

        $this->actingAs($this->priest)->postJson("/api/priest/events/{$event->event_id}/approve")->assertConflict();

        $this->preApprove($event);
        $this->actingAs($this->priest)->getJson('/api/priest/events?status=Pre-Approved')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/priest/events/{$event->event_id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'Approved')
            ->assertJsonPath('data.preapproved_by', 'Noel Santos')
            ->assertJsonPath('data.reviewed_by', 'Fr. Jose Dela Cruz');
        $this->postJson("/api/priest/events/{$event->event_id}/approve")->assertConflict();

        $this->assertTrue(AuditLog::where('action', 'EVENT_APPROVED')->where('user_id', $this->priest->user_id)->exists());
        $this->getJson('/api/public/events')->assertJsonPath('data.0.event_id', $event->event_id);
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
            ->assertJsonPath('data.0.rejected_by_role', 'ppc')
            ->assertJsonPath('data.0.review_note', 'The chapel is booked for the fiesta that day.');
    }

    public function test_the_priest_can_reject_a_pre_approved_event_with_a_reason(): void
    {
        $event = $this->create();
        $this->preApprove($event);

        $this->actingAs($this->priest)->postJson("/api/priest/events/{$event->event_id}/reject", ['reason' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->postJson("/api/priest/events/{$event->event_id}/reject", ['reason' => 'The parish hall is closed for repairs.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'Rejected')
            ->assertJsonPath('data.rejected_by_role', 'priest')
            ->assertJsonPath('data.reviewed_by', 'Fr. Jose Dela Cruz');

        $this->assertTrue(AuditLog::where('action', 'EVENT_REJECTED_BY_PRIEST')->exists());
    }

    public function test_organizers_see_every_step_in_the_approval_history(): void
    {
        $event = $this->create();
        $this->actingAs($this->ppc)->postJson("/api/ppc/events/{$event->event_id}/reject", ['reason' => 'Pick another venue, please.'])->assertOk();
        $this->actingAs($this->gkk)->patchJson("/api/community/events/{$event->event_id}", $this->form(['venue' => 'Parish Hall', 'purpose' => 'Bible sharing, moved indoors.']))->assertOk();
        $this->preApprove($event);
        $this->actingAs($this->priest)->postJson("/api/priest/events/{$event->event_id}/approve")->assertOk();

        $this->actingAs($this->gkk)->getJson('/api/community/events')
            ->assertJsonPath('data.0.status', 'Approved')
            ->assertJsonCount(5, 'data.0.history')
            ->assertJsonPath('data.0.history.0.action', 'Submitted')
            ->assertJsonPath('data.0.history.0.by', 'Rosa Lim')
            ->assertJsonPath('data.0.history.1.action', 'Rejected')
            ->assertJsonPath('data.0.history.1.by_role', 'PPC Officer')
            ->assertJsonPath('data.0.history.1.note', 'Pick another venue, please.')
            ->assertJsonPath('data.0.history.2.action', 'Resubmitted')
            ->assertJsonPath('data.0.history.2.changes', ['purpose', 'venue'])
            ->assertJsonPath('data.0.history.3.action', 'Pre-Approved')
            ->assertJsonPath('data.0.history.4.action', 'Approved')
            ->assertJsonPath('data.0.history.4.by_role', 'Parish Priest');
    }

    public function test_editing_a_decided_event_sends_it_back_to_the_ppc(): void
    {
        $event = $this->create();
        $this->preApprove($event);
        $this->actingAs($this->priest)->postJson("/api/priest/events/{$event->event_id}/approve")->assertOk();

        $this->actingAs($this->gkk)->patchJson("/api/community/events/{$event->event_id}", $this->form(['venue' => 'Parish Hall', 'start_time' => '09:00', 'officer_ids' => [$this->secretary->officer_id]]))
            ->assertOk()
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.venue', 'Parish Hall')
            ->assertJsonPath('data.start_time', '09:00')
            ->assertJsonPath('data.preapproved_by', null)
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
        $this->actingAs($this->gkk)->postJson("/api/ppc/events/{$event->event_id}/pre-approve")->assertForbidden();
        $this->actingAs($this->ppc)->postJson("/api/priest/events/{$event->event_id}/approve")->assertForbidden();
        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create())->getJson('/api/ppc/events')->assertForbidden();
        $this->assertSame('Pending', $event->fresh()->status->value);
    }
}

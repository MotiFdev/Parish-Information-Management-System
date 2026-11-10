<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;
use App\Notifications\OfficeNoticeNotification;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification as Mailbox;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
    }

    /**
     * @return array<string, string>
     */
    private function defaults(array $overrides = []): array
    {
        return ['register' => 'Marriage', 'calendar_view' => 'week', 'report_period' => 'year', 'page_size' => '25', 'office_hours' => 'Tuesday to Sunday, 8:00 AM to 4:00 PM', ...$overrides];
    }

    private function book(): void
    {
        $this->postJson('/api/public/appointments', [
            'event_type' => 'Mass Intention', 'event_title' => 'Mass Intention for the Santos Family', 'venue_type' => 'Parish Church',
            'date' => CarbonImmutable::now('Asia/Manila')->addDays(3)->toDateString(), 'time' => '08:00',
            'full_name' => 'Maria Santos', 'contact_number' => '0917 555 0142', 'intention_category' => 'Thanksgiving',
            'intention_details' => 'Santos family', 'privacy_consent' => true,
        ])->assertCreated();
    }

    public function test_defaults_are_personal_and_office_hours_are_shared(): void
    {
        $this->actingAs($this->staff)->getJson('/api/secretary/settings')
            ->assertOk()->assertJsonPath('defaults.register', 'Baptism')->assertJsonPath('notify.announcements', false)
            ->assertJsonPath('office_hours', 'Monday to Saturday, 8:00 AM to 5:00 PM');

        $this->putJson('/api/secretary/settings/defaults', $this->defaults(['office_hours' => ' ', 'page_size' => '30']))
            ->assertUnprocessable()->assertJsonValidationErrors(['office_hours', 'page_size']);
        $this->putJson('/api/secretary/settings/defaults', $this->defaults())->assertOk()->assertJsonPath('defaults.calendarView', 'week');

        // The pages read them from the account; another staff member keeps their own.
        $this->getJson('/api/auth/me')->assertJsonPath('user.preferences.defaults.register', 'Marriage');
        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create())->getJson('/api/auth/me')->assertJsonPath('user.preferences.defaults.register', 'Baptism');

        $this->getJson('/api/public/parish')->assertJsonPath('office_hours', 'Tuesday to Sunday, 8:00 AM to 4:00 PM');
        $this->assertDatabaseHas('audit_logs', ['action' => 'OFFICE_HOURS_UPDATED', 'user_id' => $this->staff->user_id]);
    }

    public function test_notices_follow_each_persons_choices_and_email_copies_are_optional(): void
    {
        Mailbox::fake();
        $quiet = User::factory()->role(UserRole::ParishStaff)->create();
        $this->actingAs($quiet)->putJson('/api/secretary/settings/notifications', ['bookings' => false])->assertOk()->assertJsonPath('notify.bookings', false);
        $this->actingAs($this->staff)->putJson('/api/secretary/settings/notifications', ['email' => false])->assertOk()->assertJsonPath('notify.bookings', true);
        $emailed = User::factory()->role(UserRole::ParishStaff)->create();

        $this->book();

        $this->assertSame(1, Notification::where('user_id', $this->staff->user_id)->where('kind', 'bookings')->count());
        $this->assertSame(0, Notification::where('user_id', $quiet->user_id)->count());
        Mailbox::assertNotSentTo($this->staff, OfficeNoticeNotification::class);
        Mailbox::assertSentTo($emailed, OfficeNoticeNotification::class);
    }

    public function test_the_bell_lists_my_notices_and_marks_them_read(): void
    {
        $other = User::factory()->role(UserRole::ParishStaff)->create();
        $this->book();

        $id = $this->actingAs($this->staff)->getJson('/api/notifications')
            ->assertOk()->assertJsonPath('unread', 1)->assertJsonPath('data.0.kind', 'bookings')
            ->assertJsonPath('data.0.link', fn (string $link) => str_starts_with($link, '/secretary/appointments?date='))
            ->json('data.0.id');

        // Someone else's notice can't be marked from this account.
        $this->actingAs($other)->postJson("/api/notifications/{$id}/read")->assertNoContent();
        $this->assertFalse(Notification::findOrFail($id)->is_read);

        $this->actingAs($this->staff)->postJson("/api/notifications/{$id}/read")->assertNoContent();
        $this->getJson('/api/notifications')->assertJsonPath('unread', 0);
        $this->actingAs($other)->postJson('/api/notifications/read-all')->assertNoContent();
        $this->getJson('/api/notifications')->assertJsonPath('unread', 0)->assertJsonPath('data.0.read', true);
        $this->assertSame(1, Notification::where('user_id', $other->user_id)->where('is_read', true)->count());
    }

    public function test_a_scheduled_announcement_tells_its_author_when_it_goes_live(): void
    {
        $this->actingAs($this->staff)->putJson('/api/secretary/settings/notifications', ['announcements' => true])->assertOk();
        $id = $this->postJson('/api/secretary/announcements', [
            'title' => 'Advent recollection', 'category' => 'Parish', 'body' => '<p>Saturday.</p>', 'mode' => 'schedule', 'publish_at' => now()->addHours(2)->toIso8601String(),
        ])->assertCreated()->json('data.id');

        $this->getJson('/api/notifications')->assertJsonCount(0, 'data');
        $this->travel(3)->hours();
        $this->getJson('/api/notifications')->assertJsonCount(1, 'data')->assertJsonPath('data.0.link', "/secretary/announcements?notice={$id}");

        // Unscheduling before the time takes the notice back.
        $this->travelBack();
        $this->postJson("/api/secretary/announcements/{$id}/unschedule")->assertOk();
        $this->assertDatabaseCount('notifications', 0);
    }
}

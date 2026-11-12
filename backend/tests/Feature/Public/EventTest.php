<?php

namespace Tests\Feature\Public;

use App\Enums\UserRole;
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

    protected function setUp(): void
    {
        parent::setUp();

        $this->gkk = User::factory()->role(UserRole::GkkOfficer)->create();
        $this->ppc = User::factory()->role(UserRole::PpcOfficer)->create();
    }

    private function event(string $name, string $status, int $daysFromNow, string $time = '09:00'): CommunityEvent
    {
        return CommunityEvent::create([
            'name' => $name,
            'venue' => 'Parish Hall',
            'event_date' => CarbonImmutable::now('Asia/Manila')->addDays($daysFromNow)->toDateString(),
            'start_time' => $time,
            'status' => $status,
            'created_by_user_id' => $this->gkk->user_id,
            'preapproved_by_user_id' => $status === 'Approved' ? $this->ppc->user_id : null,
            'preapproved_at' => $status === 'Approved' ? now() : null,
            'reviewed_by_user_id' => $status === 'Pending' ? null : $this->ppc->user_id,
            'reviewed_at' => $status === 'Pending' ? null : now(),
            'review_note' => $status === 'Rejected' ? 'Clashes with the fiesta.' : null,
        ]);
    }

    public function test_the_public_sees_only_approved_events_from_today_on_soonest_first(): void
    {
        $this->event('Youth Night', 'Approved', 7, '18:00');
        $this->event('Bible Sharing', 'Approved', 2);
        $this->event('Morning Prayer', 'Approved', 0, '06:00');
        $this->event('Last Week Cleanup', 'Approved', -7);
        $this->event('Still Pending', 'Pending', 3);
        $this->event('Turned Down', 'Rejected', 4);

        $this->getJson('/api/public/events')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.name', 'Morning Prayer')
            ->assertJsonPath('data.0.start_time', '06:00')
            ->assertJsonPath('data.1.name', 'Bible Sharing')
            ->assertJsonPath('data.2.name', 'Youth Night')
            ->assertJsonMissingPath('data.0.officers')
            ->assertJsonMissingPath('data.0.created_by');
    }
}

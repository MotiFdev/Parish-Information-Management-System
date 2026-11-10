<?php

namespace Tests\Feature\Priest;

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\Parishioner;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $priest;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->priest = User::factory()->role(UserRole::ParishPriest)->create();
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create();
        $this->travelTo(CarbonImmutable::parse('2026-11-09 10:00', 'Asia/Manila'));
    }

    private function baptism(string $date, string $line): string
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Baptism', 'book' => '12', 'page' => '48', 'line' => $line,
            'values' => [
                'baptized' => "Child {$line} Dela Cruz", 'sex' => 'Female', 'date_of_birth' => '2019-05-02', 'place_of_birth' => 'Davao City',
                'date_of_baptism' => $date, 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
                'father' => 'Ramon Dela Cruz', 'mother' => 'Maria Santos', 'godparents' => 'Victor Tan, Rosa Uy',
            ],
        ])->assertCreated()->json('entry.id');
    }

    private function mass(string $at, string $status): void
    {
        $start = CarbonImmutable::parse($at, 'Asia/Manila');
        Appointment::query()->forceCreate([
            'event_type' => 'Mass Intention', 'event_title' => 'Mass', 'status' => $status, 'venue_type' => 'Parish Church',
            'scheduled_start' => $start, 'scheduled_end' => $start->addHour(),
            'requester_name' => 'Maria Santos', 'requester_contact' => '09175550142', 'privacy_consent' => true,
            'reference_number' => 'AP-'.strtoupper(substr(md5(uniqid()), 0, 9)),
        ]);
    }

    public function test_the_dashboard_counts_the_last_twelve_months(): void
    {
        $this->baptism('2026-11-01', '1');
        $this->baptism('2026-02-14', '2');
        // Last December: in the 12-month trend, not in this year's total.
        $id = $this->baptism('2025-12-08', '3');
        // Before the window.
        $this->baptism('2025-10-31', '4');
        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => [
            'baptized' => 'Child 3 Dela Cruz', 'sex' => 'Female', 'date_of_birth' => '2019-05-02', 'place_of_birth' => 'Davao City',
            'date_of_baptism' => '2025-12-08', 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
            'father' => 'Ramon Dela Cruz', 'mother' => 'Maria Santos Dela Cruz', 'godparents' => 'Victor Tan, Rosa Uy',
        ]])->assertOk();

        // Rejected bookings don't count, and December is past the window even though it is still November in UTC.
        $this->mass('2026-11-15 09:00', 'Approved');
        $this->mass('2026-11-16 09:00', 'Pending');
        $this->mass('2026-11-17 09:00', 'Rejected');
        $this->mass('2026-12-01 00:30', 'Approved');
        Parishioner::query()->create(['first_name' => 'Old', 'last_name' => 'Entry', 'is_archived' => true]);

        $res = $this->actingAs($this->priest)->getJson('/api/priest/dashboard')->assertOk()
            ->assertJsonCount(12, 'months')
            ->assertJsonPath('months.0', '2025-12')
            ->assertJsonPath('months.11', '2026-11')
            ->assertJsonPath('trend.Baptism.0', 1)
            ->assertJsonPath('trend.Baptism.2', 1)
            ->assertJsonPath('trend.Baptism.11', 1)
            ->assertJsonPath('this_year.Baptism', 2)
            ->assertJsonPath('this_year.Burial', 0)
            ->assertJsonPath('mass_bookings.11', 2)
            ->assertJsonPath('corrections_waiting.Baptism', 1);
        $this->assertSame(array_sum($res->json('trend.Baptism')), 3);
        $this->assertSame(Parishioner::query()->where('is_archived', false)->count(), $res->json('parishioners'));
    }

    public function test_only_the_priest_sees_it(): void
    {
        $this->actingAs($this->staff)->getJson('/api/priest/dashboard')->assertForbidden();
    }
}

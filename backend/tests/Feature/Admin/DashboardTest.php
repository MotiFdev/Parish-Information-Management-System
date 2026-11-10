<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\SecurityAlert;
use App\Models\User;
use App\Services\ApiLatency;
use App\Services\SystemMetrics;
use App\Support\UserAgent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->role(UserRole::SystemAdministrator)->create();
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login']);

        // Real readings shell out to PowerShell or read /proc; tests use fixed values.
        $this->mock(SystemMetrics::class)->shouldReceive('read')->andReturn([
            'cpu_percent' => 37,
            'memory_used_bytes' => 4 * 1024 ** 3,
            'memory_total_bytes' => 8 * 1024 ** 3,
        ]);
    }

    public function test_dashboard_endpoints_are_for_administrators_only(): void
    {
        foreach (['/api/admin/dashboard/health', '/api/admin/dashboard/sessions', '/api/admin/dashboard/alerts'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }

        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create(), 'web')
            ->getJson('/api/admin/dashboard/health')->assertForbidden();
    }

    public function test_health_returns_readings_limits_and_a_latency_series(): void
    {
        foreach ([100, 200, 300, 400, 1000] as $ms) {
            DB::table('api_request_metrics')->insert(['recorded_at' => now()->subMinutes(2), 'duration_ms' => $ms, 'status' => 200]);
        }
        // Outside the hour: ignored.
        DB::table('api_request_metrics')->insert(['recorded_at' => now()->subHours(2), 'duration_ms' => 9999, 'status' => 200]);

        $response = $this->actingAs($this->admin, 'web')->getJson('/api/admin/dashboard/health')
            ->assertOk()
            ->assertJsonPath('cpu_percent', 37)
            ->assertJsonPath('memory_total_bytes', 8 * 1024 ** 3)
            ->assertJsonPath('limits.cpu_percent', 85)
            ->assertJsonCount(ApiLatency::WINDOWS, 'latency.series');

        $last = $response->json('latency.series.'.(ApiLatency::WINDOWS - 1));
        $this->assertSame(5, $last['requests']);
        $this->assertGreaterThanOrEqual(800, $last['p95_ms']);
        $this->assertLessThan(9999, $last['p95_ms']);
        $this->assertNull($response->json('latency.series.0.p95_ms'));
    }

    public function test_api_requests_are_timed(): void
    {
        $this->actingAs($this->admin, 'web')->getJson('/api/auth/me')->assertOk();

        $this->assertDatabaseHas('api_request_metrics', ['status' => 200]);
    }

    public function test_sessions_lists_signed_in_people_and_marks_the_current_one(): void
    {
        $staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        DB::table('sessions')->insert([
            ['id' => 'staff-session', 'user_id' => $staff->user_id, 'ip_address' => '192.0.2.40', 'payload' => '', 'last_activity' => now()->subMinutes(3)->getTimestamp(),
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'],
            ['id' => 'stale-session', 'user_id' => $staff->user_id, 'ip_address' => '192.0.2.40', 'payload' => '', 'last_activity' => now()->subHours(5)->getTimestamp(), 'user_agent' => ''],
            ['id' => 'guest-session', 'user_id' => null, 'ip_address' => '192.0.2.41', 'payload' => '', 'last_activity' => now()->getTimestamp(), 'user_agent' => ''],
        ]);
        AuditLog::create(['user_id' => $staff->user_id, 'action' => 'LOGIN', 'table_affected' => 'users', 'record_id_affected' => $staff->user_id, 'ip_address' => '192.0.2.40']);

        $this->actingAs($this->admin, 'web')->getJson('/api/admin/dashboard/sessions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Liza Mercado')
            ->assertJsonPath('data.0.role', UserRole::ParishStaff->value)
            ->assertJsonPath('data.0.client', 'Chrome on Windows')
            ->assertJsonPath('data.0.device', 'desktop')
            ->assertJsonPath('data.0.is_current', false)
            ->assertJsonMissingPath('data.0.id');

        $this->assertNotNull($this->getJson('/api/admin/dashboard/sessions')->json('data.0.signed_in_at'));
    }

    public function test_repeated_failed_sign_ins_raise_one_high_alert(): void
    {
        $staff = User::factory()->role(UserRole::ParishStaff)->create(['username' => 'l.mercado']);

        for ($i = 0; $i < 7; $i++) {
            $this->postJson('/api/auth/login', ['login' => 'l.mercado', 'password' => 'wrong']);
        }

        $this->assertSame(1, SecurityAlert::count());
        $alert = SecurityAlert::first();
        $this->assertSame(SecurityAlert::HIGH, $alert->severity);
        $this->assertSame($staff->user_id, $alert->user_id);

        $this->actingAs($this->admin, 'web')->getJson('/api/admin/dashboard/alerts')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.severity', 'high');
    }

    public function test_privileged_sign_in_from_a_new_address_raises_a_review_alert(): void
    {
        $priest = User::factory()->role(UserRole::ParishPriest)->create(['username' => 'fr.reyes']);
        AuditLog::create(['user_id' => $priest->user_id, 'action' => 'LOGIN', 'table_affected' => 'users', 'record_id_affected' => $priest->user_id, 'ip_address' => '198.51.100.1']);

        $this->postJson('/api/auth/login', ['login' => 'fr.reyes', 'password' => 'password'], ['REMOTE_ADDR' => '203.0.113.9'])->assertOk();

        $this->assertDatabaseHas('security_alerts', ['type' => 'new_address_sign_in', 'severity' => 'review', 'user_id' => $priest->user_id]);
    }

    public function test_a_first_sign_in_does_not_raise_a_new_address_alert(): void
    {
        User::factory()->role(UserRole::ParishStaff)->create(['username' => 'new.staff']);

        $this->postJson('/api/auth/login', ['login' => 'new.staff', 'password' => 'password'])->assertOk();

        $this->assertSame(0, SecurityAlert::count());
    }

    public function test_reviewing_an_alert_removes_it_and_is_audited(): void
    {
        $alert = SecurityAlert::create([
            'type' => 'failed_sign_ins', 'severity' => 'high', 'title' => 'T', 'detail' => 'D', 'ip_address' => '192.0.2.1',
            'dedupe_key' => 'k', 'first_seen_at' => now(), 'last_seen_at' => now(),
        ]);

        $this->actingAs($this->admin, 'web')->postJson("/api/admin/dashboard/alerts/{$alert->alert_id}/review")->assertNoContent();

        $this->getJson('/api/admin/dashboard/alerts')->assertJsonCount(0, 'data');
        $this->assertSame($this->admin->user_id, $alert->fresh()->reviewed_by_user_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'SECURITY_ALERT_REVIEWED', 'record_id_affected' => $alert->alert_id]);
    }

    public function test_user_agent_descriptions(): void
    {
        $this->assertSame(['client' => 'Safari on iPhone', 'device' => 'phone'], UserAgent::describe(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        ));
        $this->assertSame(['client' => 'Edge on Windows', 'device' => 'desktop'], UserAgent::describe(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0'
        ));
        $this->assertSame('Unknown device', UserAgent::describe(null)['client']);
    }
}

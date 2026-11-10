<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\SecurityAlert;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->role(UserRole::SystemAdministrator)->create(['first_name' => 'Rafael', 'last_name' => 'Santos']);
    }

    private function entry(string $action, ?User $actor, array $attributes = []): AuditLog
    {
        $log = AuditLog::create([
            'user_id' => $actor?->user_id,
            'action' => $action,
            'table_affected' => 'users',
            'record_id_affected' => $actor?->user_id ?? 'unknown',
            'ip_address' => '192.0.2.40',
            ...collect($attributes)->except('timestamp')->all(),
        ]);

        if (isset($attributes['timestamp'])) {
            $log->forceFill(['timestamp' => $attributes['timestamp']])->save();
        }

        return $log;
    }

    public function test_only_administrators_can_read_the_audit_log(): void
    {
        $this->getJson('/api/admin/audit-logs')->assertUnauthorized();
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create(), 'web')->getJson('/api/admin/audit-logs')->assertForbidden();
    }

    public function test_entries_come_newest_first_with_labels_people_and_parish_time(): void
    {
        $staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->entry('LOGIN', $staff, ['timestamp' => Carbon::parse('2026-10-31 00:30:00', 'UTC')]);
        $this->entry('USER_UPDATED', $this->admin, [
            'record_id_affected' => $staff->user_id,
            'details' => ['changes' => ['first_name' => ['Lisa', 'Liza']], 'reason' => 'typo'],
            'timestamp' => Carbon::parse('2026-10-31 01:00:00', 'UTC'),
        ]);

        $this->actingAs($this->admin, 'web')->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.action', 'USER_UPDATED')
            ->assertJsonPath('data.0.label', 'Account edited')
            ->assertJsonPath('data.0.user.name', 'Rafael Santos')
            ->assertJsonPath('data.0.record', 'Liza Mercado')
            ->assertJsonPath('data.0.changes.first_name', ['Lisa', 'Liza'])
            ->assertJsonPath('data.0.extra.reason', 'typo')
            // 01:00 UTC is 09:00 in Manila.
            ->assertJsonPath('data.0.at', '2026-10-31T09:00:00+08:00')
            ->assertJsonPath('data.1.user.role', UserRole::ParishStaff->value)
            ->assertJsonPath('categories.0.key', 'signins');
    }

    public function test_search_matches_people_records_ip_and_activity_labels(): void
    {
        $staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->entry('LOGIN', $staff);
        $this->entry('USER_DEACTIVATED', $this->admin, ['record_id_affected' => $staff->user_id, 'ip_address' => '198.51.100.7']);
        $this->entry('LOGIN_FAILED', null, ['details' => ['login' => 'office.staff@example.com']]);

        $this->actingAs($this->admin, 'web');
        // As the actor (LOGIN) and as the account acted on (USER_DEACTIVATED).
        $this->getJson('/api/admin/audit-logs?search=liza%20mer')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/admin/audit-logs?search=198.51.100')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/admin/audit-logs?search=deactivated')->assertJsonPath('data.0.action', 'USER_DEACTIVATED');
        $this->getJson('/api/admin/audit-logs?search=office.staff')->assertJsonPath('data.0.record', 'office.staff@example.com');
    }

    public function test_category_and_parish_day_filters(): void
    {
        // 23:30 UTC on the 30th is already the 31st in Manila.
        $this->entry('LOGIN', $this->admin, ['timestamp' => Carbon::parse('2026-10-30 23:30:00', 'UTC')]);
        $this->entry('USER_CREATED', $this->admin, ['timestamp' => Carbon::parse('2026-10-30 10:00:00', 'UTC')]);

        $this->actingAs($this->admin, 'web');
        $this->getJson('/api/admin/audit-logs?category=accounts')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.action', 'USER_CREATED');
        $this->getJson('/api/admin/audit-logs?from=2026-10-31&to=2026-10-31')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.action', 'LOGIN');
        $this->getJson('/api/admin/audit-logs?from=2026-10-31&to=2026-10-30')->assertUnprocessable()->assertJsonValidationErrors('to');
    }

    public function test_csv_export_includes_every_match_and_is_itself_audited(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 10:00:00', 'Asia/Manila'));
        $this->entry('LOGIN', $this->admin);
        $this->entry('LOGIN_FAILED', null, ['details' => ['login' => 'x@example.com']]);

        $response = $this->actingAs($this->admin, 'web')->get('/api/admin/audit-logs/export?format=csv&category=signins');

        $response->assertOk()->assertDownload('audit-log-2026-11-05.csv');
        $csv = $response->streamedContent();
        $this->assertStringContainsString('timestamp,user,role,action', $csv);
        $this->assertStringContainsString('Sign-in failed', $csv);
        $this->assertSame(3, substr_count(trim($csv), "\n") + 1, 'header plus two rows');

        $this->assertDatabaseHas('audit_logs', ['action' => 'AUDIT_LOG_EXPORTED', 'user_id' => $this->admin->user_id]);
        // During office hours: no alert.
        $this->assertSame(0, SecurityAlert::count());
    }

    public function test_json_export_after_hours_raises_a_review_alert(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 23:47:00', 'Asia/Manila'));
        $this->entry('LOGIN', $this->admin);

        $response = $this->actingAs($this->admin, 'web')->get('/api/admin/audit-logs/export?format=json');

        $response->assertOk();
        $rows = json_decode($response->streamedContent(), true);
        $this->assertSame('LOGIN', $rows[0]['action']);
        $this->assertDatabaseHas('security_alerts', ['type' => 'after_hours_export', 'severity' => 'review', 'user_id' => $this->admin->user_id]);
    }

    public function test_editing_an_account_records_before_and_after_values(): void
    {
        $staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Joel']);

        $this->actingAs($this->admin, 'web')->patchJson("/api/admin/users/{$staff->user_id}", ['first_name' => 'Joseph', 'role' => 'priest'])->assertOk();

        $log = AuditLog::where('action', 'USER_UPDATED')->firstOrFail();
        $this->assertSame(['Joel', 'Joseph'], $log->details['changes']['first_name']);
        $this->assertSame([UserRole::ParishStaff->value, UserRole::ParishPriest->value], $log->details['changes']['role']);
    }
}

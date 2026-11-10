<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();

        // Sanctum only starts a session for requests coming from a stateful SPA origin.
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login']);
    }

    /**
     * @return array<string, array{UserRole, string, string}>
     */
    public static function roles(): array
    {
        return [
            'admin' => [UserRole::SystemAdministrator, 'admin', '/admin/dashboard'],
            'priest' => [UserRole::ParishPriest, 'priest', '/priest/dashboard'],
            'secretary' => [UserRole::ParishStaff, 'secretary', '/secretary/dashboard'],
            'gkk' => [UserRole::GkkOfficer, 'gkk', '/community/events'],
            'pya-kkk' => [UserRole::PyaKkkOfficer, 'pya-kkk', '/community/events'],
            'ppc' => [UserRole::PpcOfficer, 'ppc', '/ppc/events'],
        ];
    }

    #[DataProvider('roles')]
    public function test_each_role_signs_in_and_gets_its_dashboard(UserRole $role, string $slug, string $dashboard): void
    {
        $user = User::factory()->role($role)->create(['username' => 'jdelacruz']);

        $this->postJson('/api/auth/login', ['login' => 'jdelacruz', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.user_id', $user->user_id)
            ->assertJsonPath('user.role.name', $role->value)
            ->assertJsonPath('user.role.slug', $slug)
            ->assertJsonPath('user.dashboard_path', $dashboard)
            ->assertJsonMissingPath('user.password_hash');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_email_and_username_are_matched_case_insensitively(): void
    {
        $user = User::factory()->create(['email' => 'juan@parish.ph', 'username' => 'JuanC']);

        $this->postJson('/api/auth/login', ['login' => '  JUAN@Parish.PH ', 'password' => 'password'])->assertOk();
        $this->assertAuthenticatedAs($user, 'web');

        $this->postJson('/api/auth/login', ['login' => 'juanc', 'password' => 'password'])->assertOk();
    }

    public function test_successful_login_records_last_login_and_audit_entry_without_touching_updated_at(): void
    {
        $user = User::factory()->create(['updated_at' => now()->subDay()]);
        $updatedAt = $user->fresh()->updated_at;
        $loginAt = $this->freezeSecond();

        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'password'])->assertOk();

        $user->refresh();
        // Read back from Postgres: catches a DB session time zone that differs from the app's.
        $this->assertTrue($user->last_login->equalTo($loginAt), "last_login {$user->last_login} != {$loginAt}");
        $this->assertTrue($user->updated_at->equalTo($updatedAt));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'LOGIN',
            'user_id' => $user->user_id,
            'table_affected' => 'users',
            'record_id_affected' => $user->user_id,
            'ip_address' => '127.0.0.1',
        ]);
    }

    public function test_wrong_password_is_rejected_and_audited(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'wrong'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['login' => 'These credentials do not match our records.']);

        $this->assertGuest('web');
        $this->assertDatabaseHas('audit_logs', ['action' => 'LOGIN_FAILED', 'record_id_affected' => $user->user_id]);
    }

    public function test_unknown_account_gets_the_same_error_as_a_wrong_password(): void
    {
        $this->postJson('/api/auth/login', ['login' => 'nobody', 'password' => 'password'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['login' => 'These credentials do not match our records.']);

        $log = AuditLog::where('action', 'LOGIN_FAILED')->sole();
        $this->assertNull($log->user_id);
        $this->assertSame('unknown', $log->record_id_affected);
        $this->assertSame(['login' => 'nobody'], $log->details);
    }

    public function test_deactivated_account_cannot_sign_in(): void
    {
        $user = User::factory()->inactive()->create();

        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('message', 'This account has been deactivated.');

        $this->assertGuest('web');
        $this->assertNull($user->fresh()->last_login);
        $this->assertDatabaseHas('audit_logs', ['action' => 'LOGIN_BLOCKED_INACTIVE', 'user_id' => $user->user_id]);
    }

    public function test_deactivated_account_with_wrong_password_gets_the_generic_error(): void
    {
        $user = User::factory()->inactive()->create();

        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'wrong'])
            ->assertStatus(422);
    }

    public function test_login_is_rate_limited_after_five_failures(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'wrong'])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'password'])
            ->assertStatus(429)
            ->assertJsonValidationErrors('login');

        $this->assertGuest('web');
    }

    public function test_login_requires_both_fields(): void
    {
        $this->postJson('/api/auth/login', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['login', 'password']);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_me_returns_the_signed_in_user(): void
    {
        $user = User::factory()->role(UserRole::ParishStaff)->create();

        $this->postJson('/api/auth/login', ['login' => $user->email, 'password' => 'password'])->assertOk();

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.user_id', $user->user_id)
            ->assertJsonPath('user.role.slug', 'secretary');
    }

    public function test_logout_ends_the_session(): void
    {
        $user = User::factory()->create();
        $this->postJson('/api/auth/login', ['login' => $user->username, 'password' => 'password'])->assertOk();

        $this->postJson('/api/auth/logout')->assertNoContent();

        $this->assertGuest('web');
        $this->forgetResolvedGuards();
        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->assertDatabaseHas('audit_logs', ['action' => 'LOGOUT', 'user_id' => $user->user_id]);
    }

    public function test_account_deactivated_mid_session_is_signed_out(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'web');

        $user->update(['is_active' => false]);

        $this->getJson('/api/auth/me')
            ->assertForbidden()
            ->assertJsonPath('message', 'This account has been deactivated.');
        $this->assertGuest('web');
    }

    public function test_role_middleware_allows_only_listed_roles(): void
    {
        Route::middleware(['api', 'auth:sanctum', 'active', 'role:admin,priest'])
            ->get('/api/_test/restricted', fn () => ['ok' => true]);

        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create(), 'web')
            ->getJson('/api/_test/restricted')->assertOk();

        $this->forgetResolvedGuards();
        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create(), 'web')
            ->getJson('/api/_test/restricted')->assertForbidden();
    }
}

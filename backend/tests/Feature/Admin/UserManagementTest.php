<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\SetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->role(UserRole::SystemAdministrator)->create(['first_name' => 'Rafael', 'last_name' => 'Santos']);
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'web');
    }

    public function test_only_administrators_can_use_user_management(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();

        foreach ([UserRole::ParishPriest, UserRole::ParishStaff] as $role) {
            $this->forgetResolvedGuards();
            $this->actingAs(User::factory()->role($role)->create(), 'web')->getJson('/api/admin/users')->assertForbidden();
        }
    }

    public function test_list_searches_filters_counts_and_flags_the_current_user(): void
    {
        User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado', 'username' => 'l.mercado']);
        User::factory()->role(UserRole::ParishPriest)->create(['first_name' => 'Liza', 'last_name' => 'Ramos']);
        User::factory()->role(UserRole::ParishStaff)->inactive()->create(['first_name' => 'Paolo', 'last_name' => 'Garcia']);

        $this->asAdmin()->getJson('/api/admin/users?search=liza&role=secretary')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.username', 'l.mercado')
            ->assertJsonPath('data.0.role.slug', 'secretary')
            ->assertJsonPath('counts.all', 2)
            ->assertJsonPath('counts.secretary', 1)
            ->assertJsonPath('counts.priest', 1)
            ->assertJsonMissingPath('counts.parishioner')
            ->assertJsonPath('summary.deactivated', 1);

        $this->getJson('/api/admin/users?search=santos')
            ->assertJsonPath('data.0.is_current_user', true)
            ->assertJsonPath('data.0.first_name', 'Rafael');

        // Full-name search across both columns.
        $this->getJson('/api/admin/users?search=liza%20mer')->assertJsonCount(1, 'data');
    }

    public function test_creating_an_account_emails_a_set_password_link(): void
    {
        Notification::fake();

        $response = $this->asAdmin()->postJson('/api/admin/users', [
            'first_name' => ' Grace ',
            'last_name' => 'Domingo',
            'username' => 'g.domingo',
            'email' => 'grace@parish.ph',
            'role' => 'secretary',
        ])->assertCreated()
            ->assertJsonPath('data.first_name', 'Grace')
            ->assertJsonPath('data.role.name', UserRole::ParishStaff->value)
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('invite_sent', true);

        $user = User::findOrFail($response->json('data.user_id'));
        Notification::assertSentTo($user, SetPasswordNotification::class, function (SetPasswordNotification $n) use ($user) {
            return $n->newAccount
                && str_starts_with($n->url($user), 'http://localhost:5173/reset-password?token=')
                && DB::table('password_reset_tokens')->where('email', $user->email)->exists();
        });
        $this->assertDatabaseHas('audit_logs', ['action' => 'USER_CREATED', 'record_id_affected' => $user->user_id, 'user_id' => $this->admin->user_id]);
    }

    public function test_username_and_email_must_be_unique_ignoring_case(): void
    {
        User::factory()->create(['username' => 'JBautista', 'email' => 'joel@parish.ph']);

        $this->asAdmin()->postJson('/api/admin/users', [
            'first_name' => 'Joel', 'last_name' => 'Bautista', 'username' => 'jbautista', 'email' => 'JOEL@parish.ph', 'role' => 'secretary',
        ])->assertUnprocessable()->assertJsonValidationErrors(['username', 'email']);
    }

    public function test_create_validates_fields_and_role(): void
    {
        $this->asAdmin()->postJson('/api/admin/users', ['username' => 'a b', 'email' => 'nope', 'role' => 'pope'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'username', 'email', 'role']);
    }

    public function test_retired_parishioner_accounts_are_not_listed_and_cannot_be_reactivated(): void
    {
        $roleId = DB::table('roles')->insertGetId(['role_name' => 'Parishioner'], 'role_id');
        $retired = User::factory()->inactive()->create(['role_id' => $roleId, 'first_name' => 'Carmen']);

        $this->asAdmin()->getJson('/api/admin/users?search=carmen')
            ->assertOk()
            ->assertJsonCount(0, 'data')
            ->assertJsonPath('counts.all', 0)
            ->assertJsonPath('summary.deactivated', 0);

        $this->postJson("/api/admin/users/{$retired->user_id}/activate")->assertUnprocessable()->assertJsonValidationErrors(['user']);
        $this->assertFalse($retired->fresh()->is_active);
    }

    #[TestWith(['gkk', 'GKK Officer'])]
    #[TestWith(['pya-kkk', 'PYA-KKK Officer'])]
    #[TestWith(['ppc', 'PPC Officer'])]
    public function test_officer_accounts_can_be_created_and_filtered(string $slug, string $roleName): void
    {
        Notification::fake();

        $this->asAdmin()->postJson('/api/admin/users', [
            'first_name' => 'Ramon', 'last_name' => 'Aquino', 'username' => 'r.aquino', 'email' => 'ramon@example.com', 'role' => $slug,
        ])->assertCreated()->assertJsonPath('data.role.name', $roleName)->assertJsonPath('data.role.slug', $slug);

        $this->getJson("/api/admin/users?role={$slug}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.username', 'r.aquino')
            ->assertJsonPath("counts.{$slug}", 1);
    }

    public function test_parishioner_accounts_can_no_longer_be_created(): void
    {
        $this->asAdmin()->postJson('/api/admin/users', [
            'first_name' => 'Carmen', 'last_name' => 'Lim', 'username' => 'c.lim', 'email' => 'carmen@example.com', 'role' => 'parishioner',
        ])->assertUnprocessable()->assertJsonValidationErrors(['role' => 'Choose one of the listed roles.']);
    }

    public function test_editing_an_account_changes_only_what_was_sent(): void
    {
        $user = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Joel', 'username' => 'j.bautista']);

        $this->asAdmin()->patchJson("/api/admin/users/{$user->user_id}", ['first_name' => 'Joseph', 'role' => 'priest'])
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Joseph')
            ->assertJsonPath('data.username', 'j.bautista')
            ->assertJsonPath('data.role.slug', 'priest');

        // Keeping its own username is not a conflict.
        $this->patchJson("/api/admin/users/{$user->user_id}", ['username' => 'J.Bautista'])->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'USER_UPDATED', 'record_id_affected' => $user->user_id]);
    }

    public function test_administrators_cannot_change_their_own_role_or_deactivate_themselves(): void
    {
        $this->asAdmin()->patchJson("/api/admin/users/{$this->admin->user_id}", ['role' => 'secretary'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');

        $this->postJson("/api/admin/users/{$this->admin->user_id}/deactivate")->assertUnprocessable();

        // Saving their own form with the role unchanged is fine.
        $this->patchJson("/api/admin/users/{$this->admin->user_id}", ['first_name' => 'Raf', 'role' => 'admin'])->assertOk();
    }

    public function test_deactivating_ends_sessions_and_reactivating_restores_sign_in(): void
    {
        $user = User::factory()->role(UserRole::ParishStaff)->create();
        DB::table('sessions')->insert(['id' => 'abc', 'user_id' => $user->user_id, 'payload' => '', 'last_activity' => time()]);

        $this->asAdmin()->postJson("/api/admin/users/{$user->user_id}/deactivate")->assertOk()->assertJsonPath('data.is_active', false);
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->user_id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'USER_DEACTIVATED', 'record_id_affected' => $user->user_id]);

        $this->postJson("/api/admin/users/{$user->user_id}/activate")->assertOk()->assertJsonPath('data.is_active', true);
        $this->assertTrue($user->fresh()->is_active);
    }

    public function test_reset_link_is_emailed_and_sets_a_new_password(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'teresa@parish.ph']);

        $this->asAdmin()->postJson("/api/admin/users/{$user->user_id}/password-reset")->assertOk();

        $token = null;
        Notification::assertSentTo($user, SetPasswordNotification::class, function (SetPasswordNotification $n) use (&$token) {
            $token = $n->token;

            return ! $n->newAccount;
        });

        $this->forgetResolvedGuards();
        $this->postJson('/api/auth/reset-password', [
            'token' => $token, 'email' => 'teresa@parish.ph', 'password' => 'short', 'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/api/auth/reset-password', [
            'token' => $token, 'email' => 'teresa@parish.ph', 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('NewPass123', $user->fresh()->password_hash));
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET', 'record_id_affected' => $user->user_id]);

        // The link works once.
        $this->postJson('/api/auth/reset-password', [
            'token' => $token, 'email' => 'teresa@parish.ph', 'password' => 'Another123', 'password_confirmation' => 'Another123',
        ])->assertUnprocessable()->assertJsonValidationErrors('token');
    }

    public function test_a_failing_mail_server_is_reported_not_hidden(): void
    {
        $user = User::factory()->create();
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 1]);

        $this->asAdmin()->postJson("/api/admin/users/{$user->user_id}/password-reset")->assertStatus(503);
    }
}

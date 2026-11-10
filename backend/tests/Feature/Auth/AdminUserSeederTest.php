<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\AdminUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminUserSeederTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_seeding_creates_an_administrator_who_can_sign_in(): void
    {
        $admin = User::where('username', env('ADMIN_USERNAME', 'admin'))->firstOrFail();
        $this->assertTrue($admin->hasRole(UserRole::SystemAdministrator));
        $this->assertTrue($admin->is_active);

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/login'])
            ->postJson('/api/auth/login', ['login' => $admin->username, 'password' => env('ADMIN_PASSWORD') ?: 'password'])
            ->assertOk()
            ->assertJsonPath('user.role.slug', 'admin')
            ->assertJsonPath('user.dashboard_path', '/admin/dashboard');
    }

    public function test_reseeding_leaves_an_existing_administrator_unchanged(): void
    {
        $admin = User::where('username', env('ADMIN_USERNAME', 'admin'))->firstOrFail();
        $admin->update(['password_hash' => 'changed-by-admin']);

        $this->seed(AdminUserSeeder::class);

        $this->assertSame(1, User::where('username', $admin->username)->count());
        $this->assertTrue(Hash::check('changed-by-admin', $admin->fresh()->password_hash));
    }
}

<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_a_signed_in_user_can_change_their_name_but_not_their_email(): void
    {
        $user = User::factory()->role(UserRole::PpcOfficer)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);

        $this->actingAs($user)
            ->patchJson('/api/auth/profile', ['first_name' => 'Anna', 'last_name' => 'Santos', 'email' => 'other@example.com'])
            ->assertOk()
            ->assertJsonPath('user.first_name', 'Anna')
            ->assertJsonPath('user.last_name', 'Santos')
            ->assertJsonPath('user.email', $user->email);

        $this->assertDatabaseHas('audit_logs', ['action' => 'PROFILE_UPDATED', 'record_id_affected' => $user->user_id]);
    }

    public function test_names_are_required(): void
    {
        $user = User::factory()->role(UserRole::ParishStaff)->create();

        $this->actingAs($user)
            ->patchJson('/api/auth/profile', ['first_name' => ' ', 'last_name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name']);
    }

    public function test_a_user_can_upload_replace_and_remove_their_photo(): void
    {
        Storage::fake('local');
        $user = User::factory()->role(UserRole::GkkOfficer)->create();

        $first = $this->actingAs($user)
            ->postJson('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->image('me.jpg', 200, 200)])
            ->assertOk()
            ->json('user.photo_url');
        $firstPath = $user->fresh()->photo_path;
        Storage::disk('local')->assertExists($firstPath);

        // Served without a session, as an <img> would load it.
        auth()->forgetGuards();
        $this->get($first)->assertOk();

        $this->actingAs($user)
            ->postJson('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->image('new.png', 300, 300)])
            ->assertOk();
        Storage::disk('local')->assertMissing($firstPath);
        $secondPath = $user->fresh()->photo_path;

        $this->actingAs($user)->deleteJson('/api/auth/profile/photo')->assertOk()->assertJsonPath('user.photo_url', null);
        Storage::disk('local')->assertMissing($secondPath);
        $this->assertNull($user->fresh()->photo_path);
    }

    public function test_only_images_are_accepted_as_photos(): void
    {
        Storage::fake('local');
        $user = User::factory()->role(UserRole::ParishPriest)->create();

        $this->actingAs($user)
            ->postJson('/api/auth/profile/photo', ['photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf')])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');

        $this->assertNull($user->fresh()->photo_path);
    }

    public function test_guests_cannot_change_a_profile(): void
    {
        $this->patchJson('/api/auth/profile', ['first_name' => 'A', 'last_name' => 'B'])->assertUnauthorized();
        $this->postJson('/api/auth/profile/photo')->assertUnauthorized();
    }
}

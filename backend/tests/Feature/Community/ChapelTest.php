<?php

namespace Tests\Feature\Community;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ChapelTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $officer;

    private Chapel $chapel;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/community/chapels']);
        $this->officer = User::factory()->role(UserRole::GkkOfficer)->create();
        $this->chapel = Chapel::where('is_active', true)->firstOrFail();
    }

    /**
     * @return array<string, array{UserRole}>
     */
    public static function communityRoles(): array
    {
        return ['gkk' => [UserRole::GkkOfficer], 'pya-kkk' => [UserRole::PyaKkkOfficer]];
    }

    /**
     * @return array<string, array{UserRole}>
     */
    public static function otherRoles(): array
    {
        return ['secretary' => [UserRole::ParishStaff], 'ppc' => [UserRole::PpcOfficer], 'priest' => [UserRole::ParishPriest], 'admin' => [UserRole::SystemAdministrator]];
    }

    #[DataProvider('communityRoles')]
    public function test_gkk_and_pya_kkk_officers_load_the_directory(UserRole $role): void
    {
        $this->actingAs(User::factory()->role($role)->create())->getJson('/api/community/chapels')
            ->assertOk()
            ->assertJsonStructure(['sonas' => [['sona_id', 'name']], 'chapels' => [['chapel_id', 'sona_id', 'name', 'is_active']], 'officers']);
    }

    #[DataProvider('otherRoles')]
    public function test_other_roles_cannot_manage_chapels(UserRole $role): void
    {
        $this->actingAs(User::factory()->role($role)->create())->getJson('/api/community/chapels')->assertForbidden();
    }

    public function test_guests_cannot_reach_the_directory(): void
    {
        $this->getJson('/api/community/chapels')->assertUnauthorized();
    }

    public function test_adding_and_editing_a_chapel(): void
    {
        $id = $this->actingAs($this->officer)->postJson('/api/community/chapels', [
            'sona_id' => $this->chapel->sona_id, 'name' => 'Santo Niño Chapel', 'patron' => 'Santo Niño', 'fiesta_date' => 'Third Sunday of January', 'contact_number' => '',
        ])->assertCreated()->assertJsonPath('data.is_active', true)->assertJsonPath('data.contact_number', null)->json('data.chapel_id');

        $this->patchJson("/api/community/chapels/{$id}", [
            'sona_id' => $this->chapel->sona_id, 'name' => 'Santo Niño Chapel', 'patron' => 'Santo Niño', 'is_active' => false,
        ])->assertOk()->assertJsonPath('data.is_active', false);

        $this->assertTrue(AuditLog::where('action', 'CHAPEL_CREATED')->where('user_id', $this->officer->user_id)->exists());
        $this->assertTrue(AuditLog::where('action', 'CHAPEL_UPDATED')->where('record_id_affected', (string) $id)->exists());
    }

    public function test_a_sona_cannot_have_two_chapels_with_the_same_name(): void
    {
        $this->actingAs($this->officer)->postJson('/api/community/chapels', ['sona_id' => $this->chapel->sona_id, 'name' => $this->chapel->name])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'This Sona already has a chapel with that name.']);
    }

    public function test_adding_editing_and_removing_an_officer(): void
    {
        $id = $this->actingAs($this->officer)->postJson('/api/community/officers', [
            'chapel_id' => $this->chapel->chapel_id, 'term_year' => 2026, 'name' => 'Juan Dela Cruz', 'position' => 'President', 'ministry' => '', 'age' => 52,
        ])->assertCreated()->assertJsonPath('data.ministry', null)->json('data.officer_id');

        $this->patchJson("/api/community/officers/{$id}", [
            'chapel_id' => $this->chapel->chapel_id, 'term_year' => 2026, 'name' => 'Juan Dela Cruz', 'position' => 'Coordinator', 'ministry' => 'Worship',
        ])->assertOk()->assertJsonPath('data.position', 'Coordinator');

        $this->deleteJson("/api/community/officers/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('chapel_officers', ['officer_id' => $id]);
        $this->assertTrue(AuditLog::where('action', 'OFFICER_REMOVED')->where('record_id_affected', $id)->exists());
    }

    public function test_officer_needs_a_name_position_and_four_digit_term(): void
    {
        $this->actingAs($this->officer)->postJson('/api/community/officers', ['chapel_id' => $this->chapel->chapel_id, 'term_year' => 26])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'position', 'term_year']);
    }

    public function test_importing_can_add_to_or_replace_a_terms_list(): void
    {
        ChapelOfficer::create(['chapel_id' => $this->chapel->chapel_id, 'term_year' => 2026, 'name' => 'Old Officer', 'position' => 'Member']);
        ChapelOfficer::create(['chapel_id' => $this->chapel->chapel_id, 'term_year' => 2025, 'name' => 'Last Year', 'position' => 'President']);
        $url = "/api/community/chapels/{$this->chapel->chapel_id}/officers/import";
        $rows = [['name' => 'Ana Reyes', 'position' => 'President', 'age' => 40], ['name' => 'Ben Cruz', 'position' => 'Secretary', 'ministry' => '']];

        $this->actingAs($this->officer)->postJson($url, ['term_year' => 2026, 'officers' => $rows])->assertOk()->assertJsonCount(3, 'data');

        $this->postJson($url, ['term_year' => 2026, 'replace' => true, 'officers' => $rows])->assertOk()->assertJsonCount(2, 'data');
        // Other terms are untouched.
        $this->assertTrue(ChapelOfficer::where('name', 'Last Year')->exists());
        $this->assertFalse(ChapelOfficer::where('name', 'Old Officer')->exists());

        // One bad row stops the whole import.
        $this->postJson($url, ['term_year' => 2026, 'officers' => [['name' => 'No Position']]])
            ->assertUnprocessable()->assertJsonValidationErrors(['officers.0.position']);
        $this->assertSame(2, ChapelOfficer::where('chapel_id', $this->chapel->chapel_id)->where('term_year', 2026)->count());
    }
}

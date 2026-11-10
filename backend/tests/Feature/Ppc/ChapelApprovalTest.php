<?php

namespace Tests\Feature\Ppc;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChapelApprovalTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $gkk;

    private User $ppc;

    private Chapel $approvedChapel;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/ppc/chapels']);
        $this->gkk = User::factory()->role(UserRole::GkkOfficer)->create(['first_name' => 'Rosa', 'last_name' => 'Lim']);
        $this->ppc = User::factory()->role(UserRole::PpcOfficer)->create(['first_name' => 'Noel', 'last_name' => 'Santos']);
        $this->approvedChapel = Chapel::approved()->where('is_active', true)->firstOrFail();
    }

    private function addChapel(string $name = 'Santo Niño Chapel'): int
    {
        return $this->actingAs($this->gkk)->postJson('/api/community/chapels', ['sona_id' => $this->approvedChapel->sona_id, 'name' => $name])
            ->assertCreated()->assertJsonPath('data.approval_status', 'Pending')->json('data.chapel_id');
    }

    private function addOfficer(string $name = 'Juan Dela Cruz'): string
    {
        return $this->actingAs($this->gkk)->postJson('/api/community/officers', [
            'chapel_id' => $this->approvedChapel->chapel_id, 'term_year' => 2026, 'name' => $name, 'position' => 'Member',
        ])->assertCreated()->assertJsonPath('data.approval_status', 'Pending')->json('data.officer_id');
    }

    public function test_a_new_chapel_waits_for_the_ppc_before_the_public_or_officers_can_use_it(): void
    {
        $id = $this->addChapel();

        $this->getJson('/api/sonas')->assertOk()->assertJsonMissing(['chapel_id' => $id]);
        $this->actingAs($this->gkk)->postJson('/api/community/officers', ['chapel_id' => $id, 'term_year' => 2026, 'name' => 'Ana', 'position' => 'President'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['chapel_id' => 'Officers can be added once the PPC approves this chapel.']);
        $this->postJson("/api/community/chapels/{$id}/officers/import", ['term_year' => 2026, 'officers' => [['name' => 'Ana', 'position' => 'President']]])
            ->assertUnprocessable()->assertJsonValidationErrors(['chapel_id']);

        $this->actingAs($this->ppc)->getJson('/api/ppc/chapels')->assertOk()->assertJsonPath('chapels.0.chapel_id', $id)->assertJsonPath('chapels.0.created_by', 'Rosa Lim');
        $this->postJson("/api/ppc/chapels/{$id}/approve")->assertOk()->assertJsonPath('data.approval_status', 'Approved')->assertJsonPath('data.reviewed_by', 'Noel Santos');
        $this->postJson("/api/ppc/chapels/{$id}/approve")->assertConflict();

        $this->getJson('/api/sonas')->assertJsonFragment(['chapel_id' => $id]);
        $this->assertTrue(AuditLog::where('action', 'CHAPEL_APPROVED')->where('user_id', $this->ppc->user_id)->exists());
    }

    public function test_a_rejected_chapel_shows_the_reason_and_editing_resubmits_it(): void
    {
        $id = $this->addChapel();

        $this->actingAs($this->ppc)->postJson("/api/ppc/chapels/{$id}/reject", [])->assertUnprocessable()->assertJsonValidationErrors(['reason']);
        $this->postJson("/api/ppc/chapels/{$id}/reject", ['reason' => 'This chapel is already listed under another name.'])->assertOk();

        $chapel = collect($this->actingAs($this->gkk)->getJson('/api/community/chapels')->json('chapels'))->firstWhere('chapel_id', $id);
        $this->assertSame('Rejected', $chapel['approval_status']);
        $this->assertSame('This chapel is already listed under another name.', $chapel['review_note']);

        $this->patchJson("/api/community/chapels/{$id}", ['sona_id' => $this->approvedChapel->sona_id, 'name' => 'Santo Niño Chapel (Purok 5)'])
            ->assertOk()->assertJsonPath('data.approval_status', 'Pending')->assertJsonPath('data.review_note', null);
    }

    public function test_only_unapproved_chapels_can_be_deleted(): void
    {
        $id = $this->addChapel();

        $this->actingAs($this->gkk)->deleteJson("/api/community/chapels/{$this->approvedChapel->chapel_id}")->assertConflict();
        $this->deleteJson("/api/community/chapels/{$id}")->assertNoContent();
        $this->assertDatabaseMissing('chapels', ['chapel_id' => $id]);
    }

    public function test_new_officers_and_imports_wait_for_the_ppc_who_can_approve_several_at_once(): void
    {
        $one = $this->addOfficer('Ana Reyes');
        $imported = collect($this->postJson("/api/community/chapels/{$this->approvedChapel->chapel_id}/officers/import", [
            'term_year' => 2026, 'officers' => [['name' => 'Ben Cruz', 'position' => 'Secretary'], ['name' => 'Carla Diaz', 'position' => 'Treasurer']],
        ])->assertOk()->json('data'))->whereIn('name', ['Ben Cruz', 'Carla Diaz']);
        $this->assertSame(['Pending', 'Pending'], $imported->pluck('approval_status')->values()->all());

        $this->actingAs($this->ppc)->getJson('/api/ppc/chapels')->assertJsonCount(3, 'officers');
        $this->postJson('/api/ppc/officers/approve', ['officer_ids' => [$one, ...$imported->pluck('officer_id')]])
            ->assertOk()->assertJsonCount(3, 'approved')->assertJsonCount(0, 'skipped');
        $this->postJson('/api/ppc/officers/approve', ['officer_ids' => [$one]])->assertOk()->assertJsonPath('skipped', [$one]);

        $this->assertSame(3, ChapelOfficer::approved()->whereIn('name', ['Ana Reyes', 'Ben Cruz', 'Carla Diaz'])->count());
        $this->assertSame(3, AuditLog::where('action', 'OFFICER_APPROVED')->count());
    }

    public function test_rejecting_an_officer_needs_a_reason_and_editing_resubmits_it(): void
    {
        $id = $this->addOfficer();

        $this->actingAs($this->ppc)->postJson("/api/ppc/officers/{$id}/reject", ['reason' => 'Wrong chapel; he serves at San Roque.'])
            ->assertOk()->assertJsonPath('data.approval_status', 'Rejected');

        $this->actingAs($this->gkk)->patchJson("/api/community/officers/{$id}", [
            'chapel_id' => $this->approvedChapel->chapel_id, 'term_year' => 2026, 'name' => 'Juan Dela Cruz', 'position' => 'Member',
        ])->assertOk()->assertJsonPath('data.approval_status', 'Pending');
    }

    public function test_editing_an_approved_chapel_applies_right_away(): void
    {
        $this->actingAs($this->gkk)->patchJson("/api/community/chapels/{$this->approvedChapel->chapel_id}", [
            'sona_id' => $this->approvedChapel->sona_id, 'name' => $this->approvedChapel->name, 'patron' => 'New Patron',
        ])->assertOk()->assertJsonPath('data.approval_status', 'Approved')->assertJsonPath('data.patron', 'New Patron');
    }

    public function test_only_ppc_officers_can_approve(): void
    {
        $id = $this->addChapel();

        foreach ([UserRole::GkkOfficer, UserRole::PyaKkkOfficer, UserRole::ParishStaff] as $role) {
            $this->actingAs(User::factory()->role($role)->create())->postJson("/api/ppc/chapels/{$id}/approve")->assertForbidden();
        }
        $this->assertSame('Pending', Chapel::findOrFail($id)->approval_status->value);
    }
}

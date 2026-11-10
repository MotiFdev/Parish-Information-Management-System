<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
    }

    private function write(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/announcements', [
            'title' => 'Simbang Gabi schedule', 'category' => 'Liturgy', 'body' => '<p>Nine dawn Masses.</p>', 'pinned' => false, 'mode' => 'draft',
            ...$overrides,
        ]);
    }

    public function test_a_published_post_shows_on_the_home_page_and_a_draft_does_not(): void
    {
        $this->write()->assertCreated()->assertJsonPath('data.status', 'Draft')->assertJsonPath('data.author', 'Liza Mercado');
        $id = $this->write(['title' => 'Fiesta Novena', 'category' => 'Parish', 'mode' => 'now'])->assertJsonPath('data.status', 'Published')->json('data.id');

        $this->getJson('/api/public/announcements')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'ANNOUNCEMENT_CREATED', 'record_id_affected' => $id]);
    }

    public function test_the_body_is_cleaned_on_save(): void
    {
        $this->write(['body' => '<p onclick="x()">Hi <b>all</b><script>alert(1)</script> <a href="javascript:evil()">bad</a> <a href="https://parish.example">site</a></p><p></p><img src=x>'])
            ->assertCreated()
            ->assertJsonPath('data.body', '<p>Hi <strong>all</strong> bad <a href="https://parish.example" rel="noopener noreferrer" target="_blank">site</a></p>');

        $this->write(['body' => '<p> </p><script>x</script>'])->assertUnprocessable()->assertJsonPath('errors.body.0', 'Write the announcement.');
    }

    public function test_scheduling_publishing_and_archiving(): void
    {
        $this->write(['mode' => 'schedule', 'publish_at' => now()->subHour()->toIso8601String()])
            ->assertUnprocessable()->assertJsonPath('errors.publish_at.0', 'Choose a time later than now.');
        $id = $this->write(['mode' => 'schedule', 'publish_at' => now()->addDay()->toIso8601String()])->assertJsonPath('data.status', 'Scheduled')->json('data.id');
        $this->getJson('/api/public/announcements')->assertJsonCount(0, 'data');

        $this->postJson("/api/secretary/announcements/{$id}/publish")->assertOk()->assertJsonPath('data.status', 'Published');
        $this->deleteJson("/api/secretary/announcements/{$id}")->assertConflict();
        $this->postJson("/api/secretary/announcements/{$id}/archive")->assertOk()->assertJsonPath('data.status', 'Archived');
        $this->patchJson("/api/secretary/announcements/{$id}", ['title' => 'x', 'category' => 'Parish', 'body' => '<p>x</p>', 'mode' => 'draft'])->assertConflict();
        $this->postJson("/api/secretary/announcements/{$id}/to-draft")->assertOk()->assertJsonPath('data.status', 'Draft');
        $this->deleteJson("/api/secretary/announcements/{$id}")->assertNoContent();
        $this->assertDatabaseCount('announcements', 0);
    }

    public function test_pinning_a_live_post_moves_the_pin(): void
    {
        $first = $this->write(['title' => 'First', 'mode' => 'now', 'pinned' => true])->json('data.id');
        $second = $this->write(['title' => 'Second', 'mode' => 'now'])->json('data.id');
        // A pinned draft waits; the live pin stays where it is.
        $this->write(['title' => 'Draft', 'pinned' => true]);
        $this->assertTrue(Announcement::query()->findOrFail($first)->is_pinned);

        $this->postJson("/api/secretary/announcements/{$second}/pin", ['pinned' => true])->assertOk()->assertJsonPath('data.pinned', true);
        $this->assertFalse(Announcement::query()->findOrFail($first)->is_pinned);
        $this->getJson('/api/public/announcements')->assertJsonPath('data.0.title', 'Second');
    }

    public function test_only_staff_manage_announcements(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create())->getJson('/api/secretary/announcements')->assertForbidden();
    }
}

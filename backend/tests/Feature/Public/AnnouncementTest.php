<?php

namespace Tests\Feature\Public;

use App\Enums\UserRole;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnnouncementTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    public function test_the_home_page_gets_published_posts_pinned_first(): void
    {
        $by = User::factory()->role(UserRole::ParishStaff)->create()->user_id;
        $post = fn (string $title, array $extra) => Announcement::query()->create([
            'title' => $title, 'content_markdown' => '<p>Bring the child’s <strong>PSA</strong> birth certificate.</p>', 'created_by_user_id' => $by, ...$extra,
        ]);
        $post('Older', ['status' => 'Published', 'published_at' => now()->subDays(5), 'category' => 'Liturgy']);
        $post('Newer', ['status' => 'Published', 'published_at' => now()->subDay(), 'category' => 'Sacraments']);
        $post('Pinned', ['status' => 'Published', 'published_at' => now()->subDays(9), 'is_pinned' => true]);
        $post('Draft', ['status' => 'Draft']);
        $post('Scheduled', ['status' => 'Published', 'published_at' => now()->addDay()]);
        $post('Archived', ['status' => 'Archived', 'published_at' => now()->subDays(30)]);

        $this->getJson('/api/public/announcements')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.*.title', ['Pinned', 'Newer', 'Older'])
            ->assertJsonPath('data.0.pinned', true)
            ->assertJsonPath('data.1.category', 'Sacraments')
            ->assertJsonPath('data.1.excerpt', 'Bring the child’s PSA birth certificate.');
    }
}

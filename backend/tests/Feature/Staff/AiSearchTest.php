<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\AiSearch;
use App\Models\RecordEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiSearchTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.key' => 'test-key']);
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create();
    }

    /** Every text gets the same direction, so the name-and-year match decides the order. */
    private function fakeGemini(int $status = 200): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => function (HttpRequest $request) use ($status) {
            if ($status !== 200) {
                return Http::response(['error' => ['message' => 'quota']], $status);
            }
            $vector = array_fill(0, 1536, 0.0);
            $vector[0] = 1.0;

            return Http::response(['embeddings' => array_map(fn () => ['values' => $vector], $request->data()['requests'])]);
        }]);
    }

    private function baptism(string $name, string $date, string $line): string
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Baptism', 'book' => '12', 'page' => '48', 'line' => $line,
            'values' => [
                'baptized' => $name, 'sex' => 'Female', 'date_of_birth' => '1980-05-02', 'place_of_birth' => 'Davao City',
                'date_of_baptism' => $date, 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
                'father' => 'Ramon Navarro', 'mother' => 'Maria Lopez', 'godparents' => 'Victor Tan, Rosa Uy',
            ],
        ])->assertCreated()->json('entry.id');
    }

    public function test_new_entries_are_indexed_and_searches_rank_names_and_years(): void
    {
        $this->fakeGemini();
        $near = $this->baptism('Juan Dela Cruz', '1987-03-22', '1');
        $this->baptism('Mark Dela Cruz', '2018-06-10', '2');
        $this->baptism('Angela Reyes', '1987-01-11', '3');
        $this->assertSame(3, RecordEmbedding::query()->count());

        $this->getJson('/api/secretary/ai-search')->assertOk()
            ->assertJsonPath('index', ['ready' => true, 'indexed' => 3, 'total' => 3])
            ->assertJsonPath('years.0', '2018')
            ->assertJsonPath('thresholds.strong', 0.75);

        $res = $this->postJson('/api/secretary/ai-search', ['q' => 'Baptism of a Dela Cruz around 1987'])->assertOk()
            ->assertJsonPath('type', 'Baptism')
            ->assertJsonPath('results.0.entry.id', $near)
            ->assertJsonPath('results.0.terms', ['dela', 'cruz', '1987'])
            ->assertJsonPath('results.0.highlights.0.0', 'Baptized')
            ->assertJsonPath('saved.q', 'Baptism of a Dela Cruz around 1987');
        $this->assertSame(['Juan Dela Cruz', 'Mark Dela Cruz', 'Angela Reyes'], array_column(array_column($res->json('results'), 'entry'), 'subject'));
        $this->assertGreaterThan($res->json('results.1.score'), $res->json('results.0.score'));

        // Filters narrow it; strong-only drops the weaker matches.
        $this->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz', 'from' => 2000])->assertOk()->assertJsonCount(1, 'results');
        $this->postJson('/api/secretary/ai-search', ['q' => 'Juan Dela Cruz 1987', 'strong_only' => true])->assertOk()->assertJsonCount(1, 'results');
    }

    public function test_history_is_personal_and_a_repeat_moves_to_the_top(): void
    {
        $this->fakeGemini();
        $this->baptism('Juan Dela Cruz', '1987-03-22', '1');
        $this->actingAs($this->staff)->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz'])->assertOk();
        $this->postJson('/api/secretary/ai-search', ['q' => 'Reyes'])->assertOk();
        $this->postJson('/api/secretary/ai-search', ['q' => 'dela cruz'])->assertOk();
        $this->postJson('/api/secretary/ai-search', ['q' => 'dela cruz', 'from' => 1980, 'save' => false])->assertOk()->assertJsonPath('saved', null);

        $history = $this->getJson('/api/secretary/ai-search')->assertJsonCount(2, 'history')->json('history');
        $this->assertSame(['dela cruz', 'Reyes'], array_column($history, 'q'));
        // The repeated question reused its cached embedding: three entries indexed once each, plus two distinct questions.
        Http::assertSentCount(3);

        $other = User::factory()->role(UserRole::ParishStaff)->create();
        $this->actingAs($other)->getJson('/api/secretary/ai-search')->assertJsonCount(0, 'history');
        $this->deleteJson("/api/secretary/ai-search/history/{$history[0]['id']}")->assertNoContent();
        $this->assertSame(2, AiSearch::query()->count());

        $this->actingAs($this->staff)->deleteJson("/api/secretary/ai-search/history/{$history[0]['id']}")->assertNoContent();
        $this->deleteJson('/api/secretary/ai-search/history')->assertNoContent();
        $this->assertSame(0, AiSearch::query()->count());
    }

    public function test_the_priest_searches_from_the_priest_portal_with_a_separate_history(): void
    {
        $this->fakeGemini();
        $this->baptism('Juan Dela Cruz', '1987-03-22', '1');
        $this->actingAs($this->staff)->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz'])->assertOk();

        $priest = User::factory()->role(UserRole::ParishPriest)->create();
        $this->actingAs($priest)->postJson('/api/priest/ai-search', ['q' => 'Juan Dela Cruz'])
            ->assertOk()->assertJsonPath('results.0.entry.subject', 'Juan Dela Cruz');
        $this->getJson('/api/priest/ai-search')->assertOk()->assertJsonCount(1, 'history')->assertJsonPath('history.0.q', 'Juan Dela Cruz');
        $this->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz'])->assertForbidden();
        $this->actingAs($this->staff)->getJson('/api/priest/ai-search')->assertForbidden();
    }

    public function test_a_busy_ai_service_is_explained_and_only_staff_and_the_priest_search(): void
    {
        $this->fakeGemini(429);

        $this->actingAs($this->staff)->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz'])
            ->assertStatus(503)
            ->assertJsonPath('message', 'The AI search service is busy. Wait a minute and try again.');
        $this->postJson('/api/secretary/ai-search', ['q' => ''])->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->assertSame(0, AiSearch::query()->count());

        $priest = User::factory()->role(UserRole::ParishPriest)->create();
        $this->actingAs($priest)->postJson('/api/secretary/ai-search', ['q' => 'Dela Cruz'])->assertForbidden();
    }
}

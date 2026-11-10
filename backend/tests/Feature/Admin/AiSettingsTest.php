<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\RecordEmbedding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.key' => 'test-key', 'services.gemini.embedding_model' => 'gemini-embedding-001']);
        $this->admin = User::factory()->role(UserRole::SystemAdministrator)->create();
        $this->fakeGemini();
    }

    /** Lists three embedding models; "gemini-embedding-small" only makes 768-dimension vectors. */
    private function fakeGemini(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => function (HttpRequest $request) {
            if ($request->method() === 'GET') {
                return Http::response(['models' => [
                    ['name' => 'models/gemini-embedding-001', 'supportedGenerationMethods' => ['embedContent']],
                    ['name' => 'models/gemini-embedding-2', 'supportedGenerationMethods' => ['embedContent']],
                    ['name' => 'models/gemini-embedding-small', 'supportedGenerationMethods' => ['embedContent']],
                    ['name' => 'models/gemini-3.5-flash', 'supportedGenerationMethods' => ['generateContent']],
                ]]);
            }
            $size = str_contains($request->url(), 'small') ? 768 : 1536;
            $vector = array_fill(0, $size, 0.0);
            $vector[0] = 1.0;

            return Http::response(['embeddings' => array_map(fn () => ['values' => $vector], $request->data()['requests'])]);
        }]);
    }

    private function baptism(string $name, string $line): void
    {
        $secretary = User::factory()->role(UserRole::ParishStaff)->create();
        $this->actingAs($secretary)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Baptism', 'book' => '12', 'page' => '48', 'line' => $line,
            'values' => [
                'baptized' => $name, 'sex' => 'Female', 'date_of_birth' => '1980-05-02', 'place_of_birth' => 'Davao City',
                'date_of_baptism' => '1987-03-22', 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
                'father' => 'Ramon Navarro', 'mother' => 'Maria Lopez', 'godparents' => 'Victor Tan, Rosa Uy',
            ],
        ])->assertCreated();
    }

    public function test_the_page_shows_the_settings_the_models_and_the_index(): void
    {
        $this->baptism('Juan Dela Cruz', '1');

        $this->actingAs($this->admin)->getJson('/api/admin/ai-settings')->assertOk()
            ->assertJsonPath('settings', ['model' => 'gemini-embedding-001', 'min_score' => 0.45, 'strong_score' => 0.75])
            ->assertJsonPath('models', ['gemini-embedding-001', 'gemini-embedding-2', 'gemini-embedding-small'])
            ->assertJsonPath('index.counts.Sacramental Record', 1)
            ->assertJsonPath('index.records', 1)
            ->assertJsonPath('reindex', null);
    }

    public function test_thresholds_are_saved_in_order_and_logged(): void
    {
        $this->actingAs($this->admin)->putJson('/api/admin/ai-settings', ['min_score' => 0.8, 'strong_score' => 0.6, 'model' => 'gemini-embedding-001'])
            ->assertJsonValidationErrors(['strong_score' => 'can’t be lower']);

        $this->putJson('/api/admin/ai-settings', ['min_score' => 0.5, 'strong_score' => 0.82, 'model' => 'gemini-embedding-001'])->assertOk()
            ->assertJsonPath('settings.min_score', 0.5)
            ->assertJsonPath('settings.strong_score', 0.82);
        $this->assertSame(1, AuditLog::query()->where('action', 'AI_SETTINGS_UPDATED')->count());
        Http::assertNotSent(fn (HttpRequest $r) => $r->method() === 'POST');

        $this->actingAs(User::factory()->role(UserRole::ParishStaff)->create())->getJson('/api/admin/ai-settings')->assertForbidden();
    }

    public function test_a_new_model_must_exist_and_fit_the_index(): void
    {
        $this->actingAs($this->admin);
        $this->putJson('/api/admin/ai-settings', ['min_score' => 0.45, 'strong_score' => 0.75, 'model' => 'made-up-model'])
            ->assertJsonValidationErrors(['model' => 'doesn’t offer']);
        $this->putJson('/api/admin/ai-settings', ['min_score' => 0.45, 'strong_score' => 0.75, 'model' => 'gemini-embedding-small'])
            ->assertJsonValidationErrors(['model' => '1536-dimension']);

        $this->putJson('/api/admin/ai-settings', ['min_score' => 0.45, 'strong_score' => 0.75, 'model' => 'gemini-embedding-2'])->assertOk()
            ->assertJsonPath('settings.model', 'gemini-embedding-2');
    }

    public function test_changing_the_model_hides_old_vectors_until_a_reindex_rebuilds_them(): void
    {
        $this->baptism('Juan Dela Cruz', '1');
        $this->baptism('Angela Reyes', '2');
        $this->baptism('Mark Lim', '3');

        $this->actingAs($this->admin)->putJson('/api/admin/ai-settings', ['min_score' => 0.45, 'strong_score' => 0.75, 'model' => 'gemini-embedding-2'])
            ->assertOk()
            ->assertJsonPath('index.indexed', 0)
            ->assertJsonPath('index.other_model', 3);

        $this->postJson('/api/admin/ai-settings/reindex')->assertOk()->assertJsonPath('reindex.done', 0)->assertJsonPath('reindex.total', 3);
        $this->postJson('/api/admin/ai-settings/reindex/step')->assertOk()
            ->assertJsonPath('reindex', null)
            ->assertJsonPath('index.indexed', 3);
        $this->postJson('/api/admin/ai-settings/reindex/step')->assertConflict();

        $this->assertSame(['gemini-embedding-2'], RecordEmbedding::query()->distinct()->pluck('embedding_model')->all());
        $this->assertSame(1, AuditLog::query()->where('action', 'AI_REINDEX_COMPLETED')->count());
    }

    public function test_the_preview_shows_scores_below_the_minimum_too(): void
    {
        $this->baptism('Juan Dela Cruz', '1');
        $this->baptism('Angela Reyes', '2');

        $res = $this->actingAs($this->admin)->postJson('/api/admin/ai-settings/preview', ['q' => 'Juan Dela Cruz'])->assertOk()
            ->assertJsonCount(2, 'results')
            ->assertJsonPath('results.0.label', 'Baptism · Juan Dela Cruz · Mar 22, 1987');
        $this->assertLessThan(0.45, $res->json('results.1.score'));
    }
}

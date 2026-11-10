<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\EmbeddingSourceType;
use App\Http\Controllers\Controller;
use App\Models\ParishSetting;
use App\Models\RecordEmbedding;
use App\Models\SacramentalRecord;
use App\Services\AuditLogger;
use App\Services\GeminiEmbedder;
use App\Services\RecordSearch;
use App\Services\RecordSearchIndex;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;
use RuntimeException;

/**
 * AI Engine Settings (/admin/settings/ai-config): the score thresholds AI
 * Record Search applies, the Gemini embedding model, and re-indexing.
 *
 * A re-index runs in steps the page asks for one after another, so it needs
 * no queue worker, shows real progress, and picks up where it stopped if the
 * page is closed or Gemini is busy.
 */
class AiSettingsController extends Controller
{
    /** Register entries embedded per step: one Gemini call, a few seconds. */
    private const STEP = 50;

    private const PREVIEW_RESULTS = 10;

    public function __construct(private GeminiEmbedder $embedder, private RecordSearchIndex $index, private AuditLogger $audit) {}

    #[OA\Get(path: '/api/admin/ai-settings', summary: 'Thresholds, embedding model, models to choose from, and the index status', tags: ['Admin: AI Engine'], responses: [new OA\Response(response: 200, description: 'Settings')])]
    public function show(): JsonResponse
    {
        return response()->json([
            'settings' => $this->settings(),
            'models' => $this->embedder->availableModels(),
            'dimensions' => (int) config('services.gemini.dimensions'),
            'configured' => $this->embedder->configured(),
            'index' => $this->indexStatus(),
            'reindex' => $this->progress(),
        ]);
    }

    #[OA\Put(
        path: '/api/admin/ai-settings',
        summary: 'Save thresholds and the embedding model (a new model is checked with Gemini first)',
        tags: ['Admin: AI Engine'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 422, description: 'Invalid, or the model cannot be used')],
    )]
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'min_score' => ['required', 'numeric', 'between:0,1'],
            'strong_score' => ['required', 'numeric', 'between:0,1', 'gte:min_score'],
            'model' => ['required', 'string', 'max:100'],
        ], ['strong_score.gte' => 'The strong match score can’t be lower than the minimum score.']);

        $before = $this->settings();
        if ($data['model'] !== $before['model']) {
            $this->checkModel($data['model']);
        }

        ParishSetting::put('ai_min_score', (string) round((float) $data['min_score'], 2), $request->user());
        ParishSetting::put('ai_strong_score', (string) round((float) $data['strong_score'], 2), $request->user());
        ParishSetting::put('ai_embedding_model', $data['model'], $request->user());
        $after = $this->settings();

        $this->audit->log('AI_SETTINGS_UPDATED', 'parish_settings', 'ai', $request->user(), ['before' => $before, 'after' => $after]);

        return response()->json(['settings' => $after, 'index' => $this->indexStatus(), 'reindex' => $this->progress()]);
    }

    #[OA\Post(path: '/api/admin/ai-settings/reindex', summary: 'Start re-indexing every register entry with the saved model', tags: ['Admin: AI Engine'], responses: [new OA\Response(response: 200, description: 'Progress')])]
    public function startReindex(Request $request): JsonResponse
    {
        if (! $this->embedder->configured()) {
            return response()->json(['message' => 'AI search is not set up: GEMINI_API_KEY is missing.'], 503);
        }
        if (ParishSetting::value('ai_reindex_started_at') === '') {
            ParishSetting::put('ai_reindex_started_at', now()->toIso8601String(), $request->user());
            $this->audit->log('AI_REINDEX_STARTED', 'record_embeddings', 'all', $request->user(), ['model' => $this->embedder->model()]);
        }

        return response()->json(['reindex' => $this->progress()]);
    }

    #[OA\Post(
        path: '/api/admin/ai-settings/reindex/step',
        summary: 'Embed the next batch of the running re-index',
        tags: ['Admin: AI Engine'],
        responses: [
            new OA\Response(response: 200, description: 'Progress; reindex is null once finished'),
            new OA\Response(response: 409, description: 'No re-index is running'),
            new OA\Response(response: 503, description: 'Gemini could not embed this batch; try the step again'),
        ],
    )]
    public function stepReindex(Request $request): JsonResponse
    {
        $since = $this->reindexStartedAt();
        if (! $since) {
            return response()->json(['message' => 'No re-index is running.'], 409);
        }

        try {
            $this->index->index($this->index->pending($since)->orderBy('record_id')->limit(self::STEP)->get());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage(), 'reindex' => $this->progress()], 503);
        }

        if (! $this->index->pending($since)->exists()) {
            ParishSetting::put('ai_reindex_started_at', '', $request->user());
            ParishSetting::put('ai_last_reindexed_at', now()->toIso8601String(), $request->user());
            $this->audit->log('AI_REINDEX_COMPLETED', 'record_embeddings', 'all', $request->user(), [
                'model' => $this->embedder->model(), 'records' => SacramentalRecord::query()->count(),
            ]);
        }

        return response()->json(['reindex' => $this->progress(), 'index' => $this->indexStatus()]);
    }

    #[OA\Post(
        path: '/api/admin/ai-settings/preview',
        summary: 'Run a real search without thresholds, to see how they would sort the results',
        tags: ['Admin: AI Engine'],
        responses: [new OA\Response(response: 200, description: 'Top results with scores'), new OA\Response(response: 503, description: 'Gemini unavailable')],
    )]
    public function preview(Request $request, RecordSearch $search): JsonResponse
    {
        $q = $request->validate(['q' => ['required', 'string', 'min:3', 'max:300']])['q'];

        try {
            $found = $search->run($q, ['all' => true]);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        return response()->json(['results' => collect($found['results'])->take(self::PREVIEW_RESULTS)->map(fn (array $r) => [
            'label' => "{$r['entry']['type']} · {$r['entry']['subject']} · ".Carbon::parse($r['entry']['date'])->format('M j, Y'),
            'score' => $r['score'],
        ])->values()]);
    }

    /**
     * @return array{model: string, min_score: float, strong_score: float}
     */
    private function settings(): array
    {
        $t = RecordSearch::thresholds();

        return ['model' => $this->embedder->model(), 'min_score' => $t['min'], 'strong_score' => $t['strong']];
    }

    private function checkModel(string $model): void
    {
        if (! in_array($model, $this->embedder->availableModels(), true)) {
            throw ValidationException::withMessages(['model' => 'Gemini doesn’t offer that embedding model.']);
        }
        try {
            $ok = $this->embedder->supports($model);
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['model' => "Couldn’t check {$model} with Gemini: {$e->getMessage()}"]);
        }
        if (! $ok) {
            throw ValidationException::withMessages(['model' => "{$model} can’t make ".config('services.gemini.dimensions').'-dimension vectors, which the search index needs.']);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function indexStatus(): array
    {
        $model = $this->embedder->model();
        $counts = RecordEmbedding::query()->where('embedding_model', $model)
            ->selectRaw('source_type, count(*) as total')->groupBy('source_type')->toBase()->pluck('total', 'source_type');
        $last = ParishSetting::value('ai_last_reindexed_at');

        return [
            'model' => $model,
            'counts' => collect(EmbeddingSourceType::cases())->mapWithKeys(fn (EmbeddingSourceType $t) => [$t->value => (int) ($counts[$t->value] ?? 0)]),
            'records' => SacramentalRecord::query()->count(),
            'indexed' => $this->index->indexedCount(),
            // Rows from an earlier model: not searched until re-indexed.
            'other_model' => RecordEmbedding::query()->where(fn ($q) => $q->where('embedding_model', '!=', $model)->orWhereNull('embedding_model'))->count(),
            'last_reindexed_at' => $last !== '' ? $last : null,
            'last_indexed_at' => RecordEmbedding::query()->where('embedding_model', $model)->max('indexed_at')
                ? Carbon::parse(RecordEmbedding::query()->where('embedding_model', $model)->max('indexed_at'))->toIso8601String() : null,
        ];
    }

    /**
     * @return array{started_at: string, done: int, total: int}|null
     */
    private function progress(): ?array
    {
        $since = $this->reindexStartedAt();
        if (! $since) {
            return null;
        }
        $total = SacramentalRecord::query()->count();

        return ['started_at' => $since->toIso8601String(), 'done' => $total - $this->index->pending($since)->count(), 'total' => $total];
    }

    private function reindexStartedAt(): ?Carbon
    {
        $value = ParishSetting::value('ai_reindex_started_at');

        return $value !== '' ? Carbon::parse($value) : null;
    }
}

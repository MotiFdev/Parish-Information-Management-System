<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiSearch;
use App\Models\SacramentalRecord;
use App\Models\User;
use App\Services\GeminiEmbedder;
use App\Services\RecordSearch;
use App\Services\RecordSearchIndex;
use App\Services\SacramentalRegister;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;
use RuntimeException;

/**
 * AI Record Search for parish staff and the parish priest (section 9):
 * plain-language questions over the four registers, ranked with Gemini
 * embeddings in pgvector, and each person's own search history. Served at
 * /api/secretary/ai-search and /api/priest/ai-search; only the links differ.
 */
class AiSearchController extends Controller
{
    public function __construct(private RecordSearch $search, private GeminiEmbedder $embedder) {}

    #[OA\Get(path: '/api/{portal}/ai-search', summary: 'Your search history, the year range, score thresholds, and how much of the register is indexed', tags: ['AI Search'], responses: [new OA\Response(response: 200, description: 'Search page data')])]
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'history' => $this->history($request->user()),
            'years' => $this->search->years(),
            'thresholds' => RecordSearch::thresholds(),
            'index' => [
                'ready' => $this->embedder->configured(),
                'indexed' => app(RecordSearchIndex::class)->indexedCount(),
                'total' => SacramentalRecord::query()->count(),
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/{portal}/ai-search',
        summary: 'Search the registers in plain words',
        tags: ['AI Search'],
        responses: [new OA\Response(response: 200, description: 'results (best first) and the saved history item (save=false skips it)'), new OA\Response(response: 422, description: 'No question'), new OA\Response(response: 503, description: 'The AI service is unavailable')],
    )]
    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['required', 'string', 'max:300'],
            'type' => ['nullable', Rule::in(SacramentalRegister::TYPES)],
            'from' => ['nullable', 'integer', 'between:1800,2100'],
            'to' => ['nullable', 'integer', 'between:1800,2100'],
            'strong_only' => ['boolean'],
            'save' => ['boolean'],
        ], ['q.required' => 'Type a question, such as a name, a year, or a parent’s name.']);
        $question = trim($data['q']);
        $filters = [
            'type' => $data['type'] ?? null,
            'from' => isset($data['from'], $data['to']) ? min($data['from'], $data['to']) : $data['from'] ?? null,
            'to' => isset($data['from'], $data['to']) ? max($data['from'], $data['to']) : $data['to'] ?? null,
            'strong_only' => (bool) ($data['strong_only'] ?? false),
        ];

        try {
            $found = $this->search->run($question, $filters);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }

        /** @var User $me */
        $me = $request->user();
        // A new question is saved; changing a filter or reopening a link is not.
        $saved = ($data['save'] ?? true) ? $this->historyItem($this->remember($me, $question, $filters, count($found['results']))) : null;

        return response()->json(['results' => $found['results'], 'type' => $found['type'], 'saved' => $saved]);
    }

    #[OA\Delete(path: '/api/{portal}/ai-search/history/{search}', summary: 'Remove one search from your history', tags: ['AI Search'], responses: [new OA\Response(response: 204, description: 'Removed')])]
    public function forget(Request $request, string $search): JsonResponse
    {
        AiSearch::query()->where('user_id', $request->user()->user_id)->whereKey($search)->delete();

        return response()->json(null, 204);
    }

    #[OA\Delete(path: '/api/{portal}/ai-search/history', summary: 'Clear your search history', tags: ['AI Search'], responses: [new OA\Response(response: 204, description: 'Cleared')])]
    public function clear(Request $request): JsonResponse
    {
        AiSearch::query()->where('user_id', $request->user()->user_id)->delete();

        return response()->json(null, 204);
    }

    /**
     * Saves the search at the top of the person's history; running it again moves it up instead of repeating it.
     *
     * @param  array<string, mixed>  $filters
     */
    private function remember(User $me, string $question, array $filters, int $count): AiSearch
    {
        $mine = AiSearch::query()->where('user_id', $me->user_id);
        (clone $mine)->get()
            ->filter(fn (AiSearch $s) => mb_strtolower($s->query) === mb_strtolower($question) && $s->filters == $filters)
            ->each->delete();
        $saved = AiSearch::query()->create(['user_id' => $me->user_id, 'query' => $question, 'filters' => $filters, 'result_count' => $count]);
        $old = (clone $mine)->orderByDesc('searched_at')->skip(AiSearch::KEEP)->take(PHP_INT_MAX)->pluck('search_id');
        if ($old->isNotEmpty()) {
            AiSearch::query()->whereIn('search_id', $old)->delete();
        }

        return $saved;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function history(User $me): array
    {
        return AiSearch::query()->where('user_id', $me->user_id)->orderByDesc('searched_at')->limit(AiSearch::KEEP)->get()
            ->map(fn (AiSearch $s) => $this->historyItem($s))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function historyItem(AiSearch $s): array
    {
        $f = $s->filters;

        return [
            'id' => $s->search_id,
            'q' => $s->query,
            'type' => $f['type'] ?? null,
            'from' => isset($f['from']) ? (string) $f['from'] : '',
            'to' => isset($f['to']) ? (string) $f['to'] : '',
            'strongOnly' => (bool) ($f['strong_only'] ?? false),
            'count' => $s->result_count,
            'at' => $s->searched_at?->toIso8601String(),
        ];
    }
}

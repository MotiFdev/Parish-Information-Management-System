<?php

namespace App\Services;

use App\Models\ParishSetting;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Turns text into embeddings with the Gemini API. Register entries are
 * embedded as documents and questions as queries, so Gemini can place a
 * short question near the entry it describes.
 */
class GeminiEmbedder
{
    /** Gemini takes at most 100 texts per batch call. */
    private const BATCH = 100;

    public function configured(): bool
    {
        return filled(config('services.gemini.key'));
    }

    /** The model chosen in AI Engine Settings, or the configured default. */
    public function model(): string
    {
        return ParishSetting::value('ai_embedding_model') ?: (string) config('services.gemini.embedding_model');
    }

    /**
     * Gemini models that can embed text, from the API's model list (cached for a day).
     * The configured and the chosen model are always included.
     *
     * @return list<string>
     */
    public function availableModels(): array
    {
        $listed = [];
        if ($this->configured()) {
            $listed = Cache::remember('gemini:embedding-models', now()->addDay(), function () {
                try {
                    $response = Http::baseUrl((string) config('services.gemini.url'))
                        ->withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
                        ->acceptJson()->timeout(15)->get('/models', ['pageSize' => 200]);
                } catch (ConnectionException) {
                    return [];
                }

                return collect($response->json('models') ?? [])
                    ->filter(fn (array $m) => in_array('embedContent', $m['supportedGenerationMethods'] ?? [], true))
                    ->map(fn (array $m) => Str::after((string) $m['name'], 'models/'))
                    ->values()->all();
            }) ?: [];
        }

        return collect([(string) config('services.gemini.embedding_model'), $this->model(), ...$listed])->unique()->values()->all();
    }

    /**
     * Whether a model gives vectors the index can store, by embedding one short text with it.
     *
     * @throws RuntimeException when Gemini can't be reached or refuses the call
     */
    public function supports(string $model): bool
    {
        return count($this->embed(['Baptism register entry'], 'RETRIEVAL_QUERY', $model)[0]) === (int) config('services.gemini.dimensions');
    }

    /**
     * @return list<float>
     */
    public function query(string $text): array
    {
        // The same question asked again (history, sharing a link) reuses its embedding instead of spending quota.
        $key = 'gemini:q:'.sha1($this->model().'|'.mb_strtolower(trim($text)));

        return Cache::remember($key, now()->addWeek(), fn () => $this->embed([$text], 'RETRIEVAL_QUERY')[0]);
    }

    /**
     * @param  list<string>  $texts
     * @return list<list<float>>
     */
    public function documents(array $texts): array
    {
        $out = [];
        foreach (array_chunk($texts, self::BATCH) as $chunk) {
            array_push($out, ...$this->embed($chunk, 'RETRIEVAL_DOCUMENT'));
        }

        return $out;
    }

    /**
     * @param  list<string>  $texts
     * @return list<list<float>>
     *
     * @throws RuntimeException when the key is missing or Gemini refuses the call
     */
    private function embed(array $texts, string $task, ?string $model = null): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('AI search is not set up: GEMINI_API_KEY is missing.');
        }
        $model = 'models/'.($model ?? $this->model());
        $dimensions = (int) config('services.gemini.dimensions');

        try {
            $response = Http::baseUrl((string) config('services.gemini.url'))
                ->withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
                ->acceptJson()->timeout(30)->retry(2, 500, throw: false)
                ->post("/{$model}:batchEmbedContents", [
                    'requests' => array_map(fn (string $t) => [
                        'model' => $model,
                        'content' => ['parts' => [['text' => $t]]],
                        'taskType' => $task,
                        'outputDimensionality' => $dimensions,
                    ], $texts),
                ]);
        } catch (ConnectionException) {
            throw new RuntimeException('The AI search service could not be reached. Check the internet connection and try again.');
        }

        $vectors = $response->successful() ? $response->json('embeddings.*.values') : null;
        if (! is_array($vectors) || count($vectors) !== count($texts)) {
            throw new RuntimeException($this->failure($response));
        }

        return array_map(fn (array $v) => array_map('floatval', $v), $vectors);
    }

    private function failure(Response $response): string
    {
        return match (true) {
            $response->status() === 429 => 'The AI search service is busy. Wait a minute and try again.',
            in_array($response->status(), [401, 403], true) => 'The AI search service refused the API key. Ask the administrator to check GEMINI_API_KEY.',
            default => 'The AI search service did not answer properly ('.$response->status().'). Try again.',
        };
    }
}

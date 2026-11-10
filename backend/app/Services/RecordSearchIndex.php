<?php

namespace App\Services;

use App\Enums\EmbeddingSourceType;
use App\Models\RecordEmbedding;
use App\Models\SacramentalRecord;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The register side of AI Record Search: one embedding per sacramental
 * record, built from the entry as staff read it (every field, the date, and
 * its place in the book), kept in record_embeddings and compared with pgvector.
 */
class RecordSearchIndex
{
    public function __construct(private SacramentalRegister $register, private GeminiEmbedder $embedder) {}

    /** The words Gemini embeds for one entry. */
    public function textFor(SacramentalRecord $record): string
    {
        $e = $this->register->present($record);
        $date = $record->event_date;
        $lines = [
            "{$e['type']} register entry: {$e['subject']}.",
            "{$e['type']} on {$date->format('F j, Y')} (year {$date->format('Y')}).",
            ...array_map(fn (array $d) => "{$d[0]}: {$d[1]}.", $e['details']),
            "Recorded in book {$e['register']['book']}, page {$e['register']['page']}, line {$e['register']['line']}.",
        ];

        return implode("\n", $lines);
    }

    /**
     * Embeds the given records and replaces their rows in record_embeddings.
     *
     * @param  EloquentCollection<int, SacramentalRecord>  $records
     */
    public function index(EloquentCollection $records): int
    {
        if ($records->isEmpty()) {
            return 0;
        }
        $records->loadMissing(SacramentalRegister::relations());
        $texts = $records->map(fn (SacramentalRecord $r) => $this->textFor($r))->values()->all();
        $vectors = $this->embedder->documents($texts);
        $model = $this->embedder->model();

        DB::transaction(function () use ($records, $texts, $vectors, $model) {
            RecordEmbedding::query()->whereIn('record_id', $records->pluck('record_id'))->delete();
            foreach ($records->values() as $i => $record) {
                RecordEmbedding::query()->create([
                    'record_id' => $record->record_id,
                    'source_type' => EmbeddingSourceType::SacramentalRecord,
                    'searchable_text_chunk' => $texts[$i],
                    'vector_embedding' => $vectors[$i],
                    'embedding_model' => $model,
                ]);
            }
        });

        return $records->count();
    }

    /**
     * Register entries closest in meaning to the question, best first, with cosine similarity (0 to 1).
     *
     * @param  array{type?: ?string, from?: ?int, to?: ?int}  $filters
     * @return Collection<int, array{record_id: string, similarity: float, text: string}>
     */
    public function nearest(string $question, array $filters, int $limit): Collection
    {
        $vector = '['.implode(',', $this->embedder->query($question)).']';

        return RecordEmbedding::query()
            ->join('sacramental_records', 'sacramental_records.record_id', '=', 'record_embeddings.record_id')
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->where('record_embeddings.source_type', EmbeddingSourceType::SacramentalRecord->value)
            // Vectors from another model aren't comparable; a model change leaves them out until re-indexed.
            ->where('record_embeddings.embedding_model', $this->embedder->model())
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('sacrament_types.name', $t))
            ->when($filters['from'] ?? null, fn ($q, $y) => $q->where('sacramental_records.event_date', '>=', "{$y}-01-01"))
            ->when($filters['to'] ?? null, fn ($q, $y) => $q->where('sacramental_records.event_date', '<=', "{$y}-12-31"))
            ->selectRaw('record_embeddings.record_id, record_embeddings.searchable_text_chunk as text, 1 - (record_embeddings.vector_embedding <=> ?::vector) as similarity', [$vector])
            ->orderByRaw('record_embeddings.vector_embedding <=> ?::vector', [$vector])
            ->limit($limit)
            ->toBase()
            ->get()
            ->map(fn ($r) => ['record_id' => $r->record_id, 'similarity' => (float) $r->similarity, 'text' => (string) $r->text]);
    }

    /** Entries that have no embedding from the current model yet. */
    public function missing(): Collection
    {
        return $this->pending()->get();
    }

    /**
     * Entries without an embedding from the current model, or (during a
     * re-index) whose embedding is older than $since.
     *
     * @return Builder<SacramentalRecord>
     */
    public function pending(?CarbonInterface $since = null): Builder
    {
        $model = $this->embedder->model();

        return SacramentalRecord::query()->whereDoesntHave('embeddings', fn ($q) => $q
            ->where('source_type', EmbeddingSourceType::SacramentalRecord->value)
            ->where('embedding_model', $model)
            ->when($since, fn ($q, $s) => $q->where('indexed_at', '>=', $s)));
    }

    /** How many register entries are searchable with the current model. */
    public function indexedCount(): int
    {
        return RecordEmbedding::query()
            ->where('source_type', EmbeddingSourceType::SacramentalRecord->value)
            ->where('embedding_model', $this->embedder->model())
            ->distinct()->count('record_id');
    }
}

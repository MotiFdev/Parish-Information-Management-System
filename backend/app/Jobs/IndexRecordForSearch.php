<?php

namespace App\Jobs;

use App\Models\SacramentalRecord;
use App\Services\GeminiEmbedder;
use App\Services\RecordSearchIndex;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Re-embeds one register entry after it is added or corrected, so AI Record
 * Search finds it with its current details. Runs on the queue: the save never
 * waits on Gemini, and a busy API is retried. `records:index` catches anything missed.
 */
class IndexRecordForSearch implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public string $recordId)
    {
        $this->afterCommit();
    }

    public function handle(RecordSearchIndex $index, GeminiEmbedder $embedder): void
    {
        if ($embedder->configured()) {
            $index->index(SacramentalRecord::query()->whereKey($this->recordId)->get());
        }
    }
}

<?php

namespace App\Console\Commands;

use App\Models\SacramentalRecord;
use App\Services\RecordSearchIndex;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use RuntimeException;

#[Signature('records:index {--all : Re-embed every register entry, not only the ones missing from the index}')]
#[Description('Builds the AI Record Search index: one Gemini embedding per register entry')]
class IndexRecordsCommand extends Command
{
    public function handle(RecordSearchIndex $index): int
    {
        $records = $this->option('all') ? SacramentalRecord::query()->get() : $index->missing();
        if ($records->isEmpty()) {
            $this->info('Every register entry is already indexed.');

            return self::SUCCESS;
        }

        $done = 0;
        try {
            foreach ($records->chunk(100) as $chunk) {
                $done += $index->index($chunk);
                $this->line("Indexed {$done} of {$records->count()}");
            }
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info("Done: {$done} register entries are searchable.");

        return self::SUCCESS;
    }
}

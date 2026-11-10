<?php

namespace App\Console\Commands;

use App\Models\BackupRun;
use App\Services\DatabaseBackups;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Contracts\Cache\LockTimeoutException;

#[Signature('backups:run')]
#[Description('Backs up the relational and vector databases, then deletes backup files older than BACKUP_KEEP_DAYS')]
class RunBackupsCommand extends Command
{
    public function handle(DatabaseBackups $backups): int
    {
        try {
            $runs = $backups->backupAll(BackupRun::SCHEDULED, null);
        } catch (LockTimeoutException) {
            $this->warn('Another backup or restore is running; skipped.');

            return self::FAILURE;
        }

        foreach ($runs as $database => $run) {
            $run->status === BackupRun::SUCCEEDED
                ? $this->info(ucfirst($database).' database backed up ('.number_format($run->size_bytes / 1048576, 1).' MB).')
                : $this->error(ucfirst($database)." database backup failed: {$run->error}");
        }

        $pruned = $backups->prune();
        if ($pruned) {
            $this->line("Deleted {$pruned} old backup ".($pruned === 1 ? 'file' : 'files').'.');
        }

        return collect($runs)->every(fn (BackupRun $r) => $r->status === BackupRun::SUCCEEDED) ? self::SUCCESS : self::FAILURE;
    }
}

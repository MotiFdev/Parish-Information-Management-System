<?php

namespace App\Services;

use App\Models\BackupRun;
use App\Models\User;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\ConfigurationUrlParser;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Backup & Recovery for the two databases the admin portal shows:
 *
 * - Relational: the whole PostgreSQL database except the tables in
 *   config('backups.skip_tables'), saved with pg_dump and put back with
 *   pg_restore in one transaction (all or nothing). It includes the AI search
 *   embeddings, so a restore brings back a matching search index too.
 * - Vector: only the AI search embeddings, as gzipped JSON lines, so the index
 *   can be put back without touching any record.
 *
 * Only one backup or restore runs at a time.
 */
class DatabaseBackups
{
    /** Long enough for pg_dump or pg_restore of a parish-sized database. */
    private const TIMEOUT_SECONDS = 1800;

    public function __construct(private AuditLogger $audit) {}

    /**
     * Backs up both databases, relational first.
     *
     * @return array{relational: BackupRun, vector: BackupRun}
     *
     * @throws LockTimeoutException when another backup or restore is running
     */
    public function backupAll(string $trigger, ?User $by): array
    {
        return $this->exclusively(function () use ($trigger, $by) {
            $runs = [
                BackupRun::RELATIONAL => $this->backup(BackupRun::RELATIONAL, $trigger, $by),
                BackupRun::VECTOR => $this->backup(BackupRun::VECTOR, $trigger, $by),
            ];
            $failed = array_filter($runs, fn (BackupRun $r) => $r->status === BackupRun::FAILED);
            $this->audit->log($failed ? 'BACKUP_FAILED' : 'BACKUP_COMPLETED', 'backup_runs', $runs[BackupRun::RELATIONAL]->backup_id, $by, [
                'trigger' => $trigger,
                'databases' => array_map(fn (BackupRun $r) => ['status' => $r->status, 'size_bytes' => $r->size_bytes, 'error' => $r->error], $runs),
            ]);

            return $runs;
        });
    }

    /**
     * Puts one database back to a backup. A relational restore first backs up
     * the current data (trigger "Before restore"), so it can be undone.
     *
     * @return array{database: string, safety_backup_id: string|null, embeddings_restored: int|null, embeddings_skipped: int|null}
     *
     * @throws LockTimeoutException when another backup or restore is running
     * @throws RuntimeException when the restore fails; the database is left as it was
     */
    public function restore(BackupRun $run, User $by): array
    {
        if (! $run->restorable() || ! Storage::disk('local')->exists($run->file_path)) {
            throw new RuntimeException('This backup can no longer be restored: its file is missing.');
        }

        return $this->exclusively(function () use ($run, $by) {
            $result = $run->database === BackupRun::RELATIONAL
                ? $this->restoreRelational($run, $by)
                : ['safety_backup_id' => null, ...$this->restoreVectors($run)];

            // After a relational restore the admin's own account may not exist any more.
            $this->audit->log('BACKUP_RESTORED', 'backup_runs', $run->backup_id, User::query()->find($by->user_id), [
                'database' => $run->database,
                'backup_taken_at' => $run->started_at->toIso8601String(),
                ...$result,
            ]);

            return ['database' => $run->database, 'embeddings_restored' => null, 'embeddings_skipped' => null, ...$result];
        });
    }

    /**
     * Deletes backup files older than keep_days. The newest good backup of each
     * database is always kept; the history rows stay, marked as not restorable.
     */
    public function prune(): int
    {
        $cutoff = now()->subDays(max(1, (int) config('backups.keep_days')));
        $keep = collect(BackupRun::DATABASES)
            ->map(fn (string $db) => BackupRun::query()->where('database', $db)->where('status', BackupRun::SUCCEEDED)->whereNotNull('file_path')->latest('started_at')->value('backup_id'))
            ->filter()->all();

        $old = BackupRun::query()->whereNotNull('file_path')->where('started_at', '<', $cutoff)->whereNotIn('backup_id', $keep)->get();
        foreach ($old as $run) {
            Storage::disk('local')->delete($run->file_path);
            $run->update(['file_path' => null]);
        }

        return $old->count();
    }

    private function backup(string $database, string $trigger, ?User $by): BackupRun
    {
        $started = now();
        $path = config('backups.directory')."/{$database}/".$started->format('Y-m-d_His').'_'.Str::lower(Str::random(6))
            .($database === BackupRun::RELATIONAL ? '.dump' : '.jsonl.gz');
        $absolute = Storage::disk('local')->path($path);
        File::ensureDirectoryExists(dirname($absolute));

        try {
            $database === BackupRun::RELATIONAL ? $this->dumpRelational($absolute) : $this->exportVectors($absolute);
            $status = BackupRun::SUCCEEDED;
            $error = null;
        } catch (Throwable $e) {
            File::delete($absolute);
            $status = BackupRun::FAILED;
            $error = Str::limit($e->getMessage(), 500);
        }

        return BackupRun::create([
            'database' => $database,
            'trigger' => $trigger,
            'user_id' => $by?->user_id,
            'by_name' => $by ? trim("{$by->first_name} {$by->last_name}") ?: $by->username : null,
            'status' => $status,
            'file_path' => $status === BackupRun::SUCCEEDED ? $path : null,
            'size_bytes' => $status === BackupRun::SUCCEEDED ? filesize($absolute) : null,
            'duration_ms' => (int) $started->diffInMilliseconds(now()),
            'error' => $error,
            'started_at' => $started,
            'finished_at' => now(),
        ]);
    }

    private function dumpRelational(string $file): void
    {
        $skip = array_map(fn (string $t) => "--exclude-table={$t}", config('backups.skip_tables'));
        // Only the app's tables: hosted databases (Supabase) keep their auth, storage, and other system schemas beside them.
        // A table pattern rather than --schema=public, so a restore never tries to drop the public schema itself.
        $this->postgres('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--table=public.*', ...$skip, "--file={$file}", '--dbname='.$this->connection()['database']]);
    }

    private function exportVectors(string $file): void
    {
        $gz = gzopen($file, 'wb6') ?: throw new RuntimeException('Could not create the backup file.');
        try {
            DB::table('record_embeddings')->orderBy('embedding_id')->lazy(500)
                ->each(fn (object $row) => gzwrite($gz, json_encode((array) $row, JSON_THROW_ON_ERROR)."\n"));
        } finally {
            gzclose($gz);
        }
    }

    /**
     * @return array{safety_backup_id: string}
     */
    private function restoreRelational(BackupRun $run, User $by): array
    {
        $safety = $this->backup(BackupRun::RELATIONAL, BackupRun::BEFORE_RESTORE, $by);
        if ($safety->status !== BackupRun::SUCCEEDED) {
            throw new RuntimeException("Nothing was restored: the current data could not be backed up first. {$safety->error}");
        }

        // The audit log must survive a restore: entries written since the backup are put back afterwards.
        $auditSince = DB::table('audit_logs')->where('timestamp', '>=', $run->started_at->copy()->subMinute())->get();

        $this->postgres('pg_restore', [
            '--clean', '--if-exists', '--single-transaction', '--exit-on-error', '--no-owner', '--no-privileges',
            '--dbname='.$this->connection()['database'], Storage::disk('local')->path($run->file_path),
        ]);

        $this->keepAuditEntries($auditSince->all());
        // A backup from before a later migration gets the newer schema back.
        Artisan::call('migrate', ['--force' => true]);

        return ['safety_backup_id' => $safety->backup_id];
    }

    /**
     * @param  list<object>  $entries
     */
    private function keepAuditEntries(array $entries): void
    {
        if (! $entries) {
            return;
        }
        $present = DB::table('audit_logs')->whereIn('log_id', array_column($entries, 'log_id'))->pluck('log_id')->flip();
        $users = DB::table('users')->whereIn('user_id', array_filter(array_column($entries, 'user_id')))->pluck('user_id')->flip();

        $missing = collect($entries)->reject(fn (object $e) => $present->has($e->log_id))
            ->map(fn (object $e) => [...(array) $e, 'user_id' => $e->user_id && $users->has($e->user_id) ? $e->user_id : null]);
        foreach ($missing->chunk(200) as $chunk) {
            DB::table('audit_logs')->insert($chunk->values()->all());
        }
    }

    /**
     * Replaces the AI search embeddings with the backup's. Entries for records
     * that no longer exist are skipped; `records:index` embeds whatever is missing.
     *
     * @return array{embeddings_restored: int, embeddings_skipped: int}
     */
    private function restoreVectors(BackupRun $run): array
    {
        $gz = gzopen(Storage::disk('local')->path($run->file_path), 'rb') ?: throw new RuntimeException('Could not open the backup file.');
        $rows = [];
        try {
            while (($line = gzgets($gz)) !== false) {
                if (trim($line) !== '') {
                    $rows[] = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                }
            }
        } finally {
            gzclose($gz);
        }

        return DB::transaction(function () use ($rows) {
            $exists = [
                'record_id' => DB::table('sacramental_records')->pluck('record_id')->flip(),
                'parishioner_id' => DB::table('parishioners')->pluck('parishioner_id')->flip(),
                'document_id' => DB::table('documents')->pluck('document_id')->flip(),
            ];
            $valid = array_values(array_filter($rows, function (array $row) use ($exists) {
                foreach ($exists as $column => $ids) {
                    if (($row[$column] ?? null) !== null && ! $ids->has($row[$column])) {
                        return false;
                    }
                }

                return true;
            }));
            // Backups from before models were recorded were all made with the configured model.
            $valid = array_map(fn (array $row) => ['embedding_model' => config('services.gemini.embedding_model'), ...$row], $valid);

            DB::table('record_embeddings')->delete();
            foreach (array_chunk($valid, 200) as $chunk) {
                DB::table('record_embeddings')->insert($chunk);
            }

            return ['embeddings_restored' => count($valid), 'embeddings_skipped' => count($rows) - count($valid)];
        });
    }

    /**
     * @param  list<string>  $arguments
     */
    private function postgres(string $tool, array $arguments): void
    {
        $db = $this->connection();
        $folder = rtrim((string) config('backups.pg_bin_path'), '/\\');
        $binary = $folder === '' ? $tool : $folder.DIRECTORY_SEPARATOR.$tool;

        $result = Process::env([
            ...$this->windowsEnvironment(),
            'PGHOST' => (string) $db['host'],
            'PGPORT' => (string) $db['port'],
            'PGUSER' => (string) $db['username'],
            'PGPASSWORD' => (string) $db['password'],
            // Hosted databases (Render) only accept encrypted connections.
            'PGSSLMODE' => (string) ($db['sslmode'] ?? 'prefer'),
        ])->timeout(self::TIMEOUT_SECONDS)->run([$binary, ...$arguments]);

        if (! $result->successful()) {
            $output = trim($result->errorOutput()) ?: trim($result->output());
            if (str_contains($output, 'not recognized') || str_contains($output, 'not found') || $result->exitCode() === 127) {
                throw new RuntimeException("{$tool} was not found. Set PG_BIN_PATH in the backend .env to the PostgreSQL bin folder.");
            }
            throw new RuntimeException("{$tool} failed: ".Str::limit($output ?: 'no output', 400));
        }
    }

    /**
     * Under PHP's built-in web server (`php artisan serve`) child processes
     * don't inherit SystemRoot, and without it Windows can't open sockets or
     * make random numbers: pg_dump then fails with an empty "error:".
     *
     * @return array<string, string>
     */
    private function windowsEnvironment(): array
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            return [];
        }

        return array_filter([
            'SystemRoot' => getenv('SystemRoot') ?: 'C:\\Windows',
            'windir' => getenv('windir') ?: getenv('SystemRoot') ?: 'C:\\Windows',
            'TEMP' => getenv('TEMP') ?: sys_get_temp_dir(),
            'TMP' => getenv('TMP') ?: sys_get_temp_dir(),
        ]);
    }

    /**
     * @return array{host: string, port: int|string, database: string, username: string, password: string}
     */
    private function connection(): array
    {
        $db = config('database.connections.'.config('database.default'));
        if (($db['driver'] ?? null) !== 'pgsql') {
            throw new RuntimeException('Backups need the PostgreSQL database connection.');
        }

        // DB_URL (e.g. Render's External Database URL) wins over DB_HOST and the rest, as it does for Laravel itself.
        return (new ConfigurationUrlParser)->parseConfiguration($db);
    }

    /**
     * @template T
     *
     * @param  callable(): T  $work
     * @return T
     */
    private function exclusively(callable $work): mixed
    {
        @set_time_limit(self::TIMEOUT_SECONDS * 2);

        return Cache::lock('backups:running', self::TIMEOUT_SECONDS * 2)->block(0, $work);
    }
}

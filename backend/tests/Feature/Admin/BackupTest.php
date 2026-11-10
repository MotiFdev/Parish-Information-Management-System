<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\BackupRun;
use App\Models\Parishioner;
use App\Models\RecordEmbedding;
use App\Models\User;
use App\Services\DatabaseBackups;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * pg_dump and pg_restore are faked: they run as separate database sessions and
 * can't see this test's uncommitted data. The vector backup runs for real.
 */
class BackupTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->admin = User::factory()->role(UserRole::SystemAdministrator)->create(['first_name' => 'Rafael', 'last_name' => 'Santos']);
    }

    private function fakePostgres(bool $dumpWorks = true): void
    {
        Process::fake(function (PendingProcess $process) use ($dumpWorks) {
            $command = (array) $process->command;
            if (str_ends_with((string) $command[0], 'pg_dump')) {
                if (! $dumpWorks) {
                    return Process::result(errorOutput: 'pg_dump: error: connection refused', exitCode: 1);
                }
                $file = substr((string) collect($command)->first(fn ($a) => str_starts_with((string) $a, '--file=')), 7);
                file_put_contents($file, 'PGDMP fake dump');
            }

            return Process::result();
        });
    }

    private function embedding(string $text): RecordEmbedding
    {
        $parishioner = Parishioner::query()->create(['first_name' => 'Juan', 'last_name' => 'Dela Cruz']);

        return RecordEmbedding::query()->create([
            'parishioner_id' => $parishioner->parishioner_id, 'source_type' => 'Parishioner Profile',
            'searchable_text_chunk' => $text, 'vector_embedding' => array_fill(0, 1536, 0.5),
        ]);
    }

    public function test_run_backup_now_saves_both_databases_and_lists_them(): void
    {
        $this->fakePostgres();
        $this->embedding('Baptism of Juan Dela Cruz');

        $res = $this->actingAs($this->admin)->postJson('/api/admin/backups')->assertCreated()
            ->assertJsonPath('data.0.database', 'relational')
            ->assertJsonPath('data.0.status', 'Succeeded')
            ->assertJsonPath('data.0.by', 'Rafael Santos')
            ->assertJsonPath('data.1.database', 'vector')
            ->assertJsonPath('data.1.restorable', true);

        Process::assertRan(fn (PendingProcess $p) => in_array('--format=custom', (array) $p->command, true)
            && in_array('--exclude-table=backup_runs*', (array) $p->command, true));
        $vector = BackupRun::query()->find($res->json('data.1.id'));
        $this->assertStringContainsString('Baptism of Juan Dela Cruz', gzdecode(Storage::disk('local')->get($vector->file_path)));
        $this->assertSame(1, AuditLog::query()->where('action', 'BACKUP_COMPLETED')->count());

        $this->getJson('/api/admin/backups')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('schedule.keep_days', 30);
    }

    public function test_a_failed_dump_is_recorded_with_its_reason(): void
    {
        $this->fakePostgres(dumpWorks: false);

        $this->actingAs($this->admin)->postJson('/api/admin/backups')->assertCreated()
            ->assertJsonPath('data.0.status', 'Failed')
            ->assertJsonPath('data.0.restorable', false)
            ->assertJsonPath('data.0.error', 'pg_dump failed: pg_dump: error: connection refused')
            ->assertJsonPath('data.1.status', 'Succeeded');
        $this->assertSame(1, AuditLog::query()->where('action', 'BACKUP_FAILED')->count());
    }

    public function test_the_vector_database_is_restored_from_its_backup(): void
    {
        $this->fakePostgres();
        $kept = $this->embedding('Kept entry');
        $vector = BackupRun::query()->find($this->actingAs($this->admin)->postJson('/api/admin/backups')->json('data.1.id'));

        $kept->delete();
        $this->embedding('Added after the backup');

        $this->postJson("/api/admin/backups/{$vector->backup_id}/restore", ['confirm' => 'restore'])->assertUnprocessable();
        $this->postJson("/api/admin/backups/{$vector->backup_id}/restore", ['confirm' => 'RESTORE'])->assertOk()
            ->assertJsonPath('embeddings_restored', 1)
            ->assertJsonPath('embeddings_skipped', 0);

        $this->assertSame(['Kept entry'], RecordEmbedding::query()->pluck('searchable_text_chunk')->all());
        $this->assertSame(1, AuditLog::query()->where('action', 'BACKUP_RESTORED')->count());
    }

    public function test_a_relational_restore_backs_up_the_current_data_first(): void
    {
        $this->fakePostgres();
        $relational = BackupRun::query()->find($this->actingAs($this->admin)->postJson('/api/admin/backups')->json('data.0.id'));

        $res = $this->postJson("/api/admin/backups/{$relational->backup_id}/restore", ['confirm' => 'RESTORE'])->assertOk()
            ->assertJsonPath('database', 'relational');

        $this->assertSame('Before restore', BackupRun::query()->find($res->json('safety_backup_id'))->trigger);
        Process::assertRan(fn (PendingProcess $p) => str_ends_with((string) $p->command[0], 'pg_restore')
            && in_array('--single-transaction', $p->command, true)
            && end($p->command) === Storage::disk('local')->path($relational->file_path));
    }

    public function test_other_throttled_requests_do_not_use_up_the_restore_limit(): void
    {
        $this->fakePostgres();
        $vector = $this->actingAs($this->admin)->postJson('/api/admin/backups')->json('data.1.id');
        // The notification bell polls in the background while the page is open.
        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/api/notifications')->assertOk();
        }

        $this->postJson("/api/admin/backups/{$vector}/restore", ['confirm' => 'RESTORE'])->assertOk();
    }

    public function test_one_backup_or_restore_at_a_time_and_admins_only(): void
    {
        $this->fakePostgres();
        $lock = Cache::lock('backups:running', 60);
        $lock->get();
        $this->actingAs($this->admin)->postJson('/api/admin/backups')->assertConflict();
        $lock->release();

        $secretary = User::factory()->role(UserRole::ParishStaff)->create();
        $this->actingAs($secretary)->getJson('/api/admin/backups')->assertForbidden();
        $this->actingAs($secretary)->postJson('/api/admin/backups')->assertForbidden();
    }

    public function test_old_backup_files_are_pruned_but_the_newest_good_one_is_kept(): void
    {
        $this->fakePostgres();
        $this->actingAs($this->admin)->postJson('/api/admin/backups')->assertCreated();
        BackupRun::query()->update(['started_at' => now()->subDays(40)]);
        $this->postJson('/api/admin/backups')->assertCreated();
        BackupRun::query()->where('started_at', '>', now()->subDay())->update(['status' => 'Failed']);

        $this->assertSame(0, app(DatabaseBackups::class)->prune());

        BackupRun::query()->where('started_at', '>', now()->subDay())->update(['status' => 'Succeeded']);
        $this->assertSame(2, app(DatabaseBackups::class)->prune());
        $this->assertSame(2, BackupRun::query()->whereNull('file_path')->count());
    }
}

<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BackupRun;
use App\Services\DatabaseBackups;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;
use RuntimeException;

/**
 * Backup & Recovery (/admin/settings/backup) and the dashboard's last-backup line.
 */
class BackupController extends Controller
{
    /** About a month of nightly runs for both databases, plus manual ones. */
    private const HISTORY = 80;

    private const BUSY = 'Another backup or restore is running. Try again when it finishes.';

    public function __construct(private DatabaseBackups $backups) {}

    #[OA\Get(path: '/api/admin/backups', summary: 'Backup history, newest first, and the backup schedule', tags: ['Admin: Backups'], responses: [new OA\Response(response: 200, description: 'History')])]
    public function index(): JsonResponse
    {
        $runs = BackupRun::query()->latest('started_at')->limit(self::HISTORY)->get();

        return response()->json([
            'data' => $runs->map(fn (BackupRun $r) => self::present($r))->values(),
            'schedule' => [
                'time' => config('backups.schedule_time'),
                'timezone' => config('app.parish_timezone', 'Asia/Manila'),
                'keep_days' => (int) config('backups.keep_days'),
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/admin/backups',
        summary: 'Back up both databases now',
        tags: ['Admin: Backups'],
        responses: [new OA\Response(response: 201, description: 'The two new runs; either may have failed'), new OA\Response(response: 409, description: 'A backup or restore is already running')],
    )]
    public function store(Request $request): JsonResponse
    {
        try {
            $runs = $this->backups->backupAll(BackupRun::MANUAL, $request->user());
        } catch (LockTimeoutException) {
            return response()->json(['message' => self::BUSY], 409);
        }

        return response()->json(['data' => array_values(array_map(fn (BackupRun $r) => self::present($r), $runs))], 201);
    }

    #[OA\Post(
        path: '/api/admin/backups/{backup}/restore',
        summary: 'Restore one database to this backup (body: confirm = "RESTORE")',
        tags: ['Admin: Backups'],
        responses: [
            new OA\Response(response: 200, description: 'Restored'),
            new OA\Response(response: 409, description: 'A backup or restore is already running'),
            new OA\Response(response: 422, description: 'Not confirmed, or the backup cannot be restored'),
            new OA\Response(response: 500, description: 'The restore failed; nothing was changed'),
        ],
    )]
    public function restore(Request $request, BackupRun $backup): JsonResponse
    {
        $request->validate(['confirm' => ['required', 'in:RESTORE']], ['confirm.in' => 'Type RESTORE in capital letters to confirm.']);
        if (! $backup->restorable()) {
            return response()->json(['message' => 'This backup can’t be restored: it failed or its file was deleted.'], 422);
        }

        try {
            $result = $this->backups->restore($backup, $request->user());
        } catch (LockTimeoutException) {
            return response()->json(['message' => self::BUSY], 409);
        } catch (RuntimeException $e) {
            report($e);

            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json($result);
    }

    /**
     * @return array<string, mixed>
     */
    public static function present(BackupRun $r): array
    {
        return [
            'id' => $r->backup_id,
            'database' => $r->database,
            'trigger' => $r->trigger,
            'by' => $r->by_name,
            'status' => $r->status,
            'size_bytes' => $r->size_bytes,
            'duration_ms' => $r->duration_ms,
            'error' => $r->error,
            'started_at' => $r->started_at->toIso8601String(),
            'finished_at' => $r->finished_at?->toIso8601String(),
            'restorable' => $r->restorable(),
        ];
    }
}

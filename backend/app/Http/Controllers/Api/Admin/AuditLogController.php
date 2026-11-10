<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\SecurityAlerts;
use App\Support\AuditActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only view of audit_logs for /admin/settings/logs. There are no update
 * or delete endpoints: entries can't be changed from the application.
 */
class AuditLogController extends Controller
{
    /** Exports stop here so one click can't produce an unbounded file. */
    private const EXPORT_LIMIT = 100_000;

    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/admin/audit-logs',
        summary: 'Audit log entries, newest first, with search, activity, and date filters',
        tags: ['Admin: Audit logs'],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Person, record, IP address, or activity', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'category', in: 'query', schema: new OA\Schema(type: 'string', enum: ['signins', 'accounts', 'requests', 'documents', 'certificates', 'records', 'system'])),
            new OA\Parameter(name: 'from', in: 'query', description: 'First day, in parish time', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'to', in: 'query', description: 'Last day, in parish time', schema: new OA\Schema(type: 'string', format: 'date')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', maximum: 100)),
        ],
        responses: [new OA\Response(response: 200, description: 'A page of entries plus the activity categories')],
    )]
    public function index(Request $request): JsonResponse
    {
        $filters = $this->validateFilters($request, ['per_page' => ['nullable', 'integer', 'min:1', 'max:100']]);

        $page = $this->filtered($filters)->paginate($filters['per_page'] ?? 15);

        return response()->json([
            'data' => $this->present(collect($page->items())),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'categories' => collect(AuditActions::CATEGORIES)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values(),
            'timezone' => self::timezone(),
        ]);
    }

    #[OA\Get(
        path: '/api/admin/audit-logs/export',
        summary: 'Download every entry matching the filters as CSV or JSON',
        tags: ['Admin: Audit logs'],
        parameters: [new OA\Parameter(name: 'format', in: 'query', required: true, schema: new OA\Schema(type: 'string', enum: ['csv', 'json']))],
        responses: [
            new OA\Response(response: 200, description: 'The file'),
            new OA\Response(response: 422, description: 'Too many entries; narrow the filters'),
        ],
    )]
    public function export(Request $request, SecurityAlerts $alerts): StreamedResponse|JsonResponse
    {
        $filters = $this->validateFilters($request, ['format' => ['required', Rule::in(['csv', 'json'])]]);
        $format = $filters['format'];

        $query = $this->filtered($filters);
        $count = (clone $query)->count();
        if ($count > self::EXPORT_LIMIT) {
            return response()->json([
                'message' => 'That is '.number_format($count).' entries, more than the '.number_format(self::EXPORT_LIMIT).' one export can hold. Narrow the dates or activity and try again.',
            ], 422);
        }

        // Logged before the file is built, so the export shows up even if the download is cancelled.
        $user = $request->user();
        $ip = $request->ip() ?? 'unknown';
        $exportEntry = $this->audit->log('AUDIT_LOG_EXPORTED', 'audit_logs', 'export', $user, [
            'format' => strtoupper($format),
            'entries' => $count,
            'filters' => array_filter(collect($filters)->except('format')->all(), fn ($v) => filled($v)) ?: 'none',
        ]);
        $alerts->auditLogExported($user, $ip, strtoupper($format), $count);

        // The file holds what matched when the export was asked for, not its own log entry.
        $query->whereKeyNot($exportEntry->log_id);

        $stamp = now(self::timezone())->format('Y-m-d');
        $filename = "audit-log-{$stamp}.{$format}";

        return response()->streamDownload(function () use ($query, $format) {
            $out = fopen('php://output', 'w');
            $first = true;

            if ($format === 'csv') {
                fwrite($out, "\u{FEFF}"); // Lets Excel read accented names correctly.
                fputcsv($out, ['timestamp', 'user', 'role', 'action', 'action_label', 'table', 'record_id', 'record', 'ip_address', 'changed_fields', 'note', 'other_details'], escape: '');
            } else {
                fwrite($out, "[\n");
            }

            $query->chunk(500, function (Collection $logs) use ($out, $format, &$first) {
                foreach ($this->present($logs) as $e) {
                    if ($format === 'csv') {
                        fputcsv($out, [
                            $e['at'], $e['user']['name'] ?? 'System', $e['user']['role'] ?? '', $e['action'], $e['label'], $e['table'], $e['record_id'],
                            $e['record'], $e['ip_address'],
                            collect($e['changes'])->map(fn ($c, $field) => "{$field}: ".($c[0] ?? '(empty)').' -> '.($c[1] ?? '(empty)'))->implode('; '),
                            $e['note'] ?? '',
                            $e['extra'] ? json_encode($e['extra'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
                        ], escape: '');
                    } else {
                        fwrite($out, ($first ? '' : ",\n").json_encode($e, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
                        $first = false;
                    }
                }
            });

            if ($format === 'json') {
                fwrite($out, "\n]\n");
            }
            fclose($out);
        }, $filename, ['Content-Type' => $format === 'csv' ? 'text/csv; charset=UTF-8' : 'application/json']);
    }

    public static function timezone(): string
    {
        return (string) config('app.parish_timezone', 'Asia/Manila');
    }

    /**
     * @param  array<string, array<int, mixed>>  $extra
     * @return array<string, mixed>
     */
    private function validateFilters(Request $request, array $extra = []): array
    {
        return $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', Rule::in(array_keys(AuditActions::CATEGORIES))],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            ...$extra,
        ], [
            'to.after_or_equal' => 'The start date is after the end date.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Builder<AuditLog>
     */
    private function filtered(array $filters): Builder
    {
        $tz = self::timezone();

        return AuditLog::query()
            ->with('user.role')
            ->when($filters['category'] ?? null, fn (Builder $q, string $c) => $q->whereIn('action', AuditActions::inCategory($c)))
            // Days are the parish's calendar days, not UTC's.
            ->when($filters['from'] ?? null, fn (Builder $q, string $d) => $q->where('timestamp', '>=', Carbon::parse($d, $tz)->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn (Builder $q, string $d) => $q->where('timestamp', '<', Carbon::parse($d, $tz)->addDay()->startOfDay()->utc()))
            ->when(filled($filters['search'] ?? null), fn (Builder $q) => $this->applySearch($q, trim($filters['search'])))
            ->orderByDesc('timestamp')
            ->orderByDesc('log_id');
    }

    /**
     * @param  Builder<AuditLog>  $query
     */
    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';
        $peopleMatching = fn () => DB::table('users')->where(fn ($w) => $w
            ->whereRaw("CONCAT_WS(' ', first_name, last_name) ILIKE ?", [$like])
            ->orWhere('username', 'ILIKE', $like)
            ->orWhere('email', 'ILIKE', $like));
        $labelCodes = AuditActions::matchingLabel($search);

        $query->where(fn (Builder $w) => $w
            // Who did it.
            ->whereIn('user_id', $peopleMatching()->select('user_id'))
            // The account it was done to.
            ->orWhere(fn (Builder $r) => $r->where('table_affected', 'users')
                ->whereIn('record_id_affected', $peopleMatching()->selectRaw('user_id::text')))
            ->orWhere('record_id_affected', 'ILIKE', $like)
            ->orWhere('ip_address', 'ILIKE', $like)
            ->orWhere('action', 'ILIKE', $like)
            ->orWhereRaw('details::text ILIKE ?', [$like])
            ->when($labelCodes, fn (Builder $l) => $l->orWhereIn('action', $labelCodes)));
    }

    /**
     * @param  Collection<int, AuditLog>  $logs
     * @return list<array<string, mixed>>
     */
    private function present(Collection $logs): array
    {
        $tz = self::timezone();

        // Accounts the entries are about, fetched once for the page.
        $subjectIds = $logs->where('table_affected', 'users')->pluck('record_id_affected')->filter(fn ($id) => Str::isUuid($id))->unique();
        $subjects = $subjectIds->isEmpty() ? collect() : User::whereIn('user_id', $subjectIds)->get()->keyBy('user_id');

        return $logs->map(function (AuditLog $log) use ($tz, $subjects) {
            $details = is_array($log->details) ? $log->details : [];
            $meta = AuditActions::describe($log->action);

            $changes = [];
            foreach ((array) ($details['changes'] ?? []) as $field => $pair) {
                $changes[$field] = [self::text($pair[0] ?? null), self::text($pair[1] ?? null)];
            }

            $record = match ($log->table_affected) {
                'users' => $subjects->get($log->record_id_affected)?->displayName() ?? ($details['login'] ?? $log->record_id_affected),
                'security_alerts' => $details['title'] ?? $log->record_id_affected,
                'audit_logs' => 'Audit log export',
                default => $log->record_id_affected,
            };

            return [
                'id' => $log->log_id,
                'at' => $log->timestamp->copy()->setTimezone($tz)->toIso8601String(),
                'user' => $log->user ? ['name' => $log->user->displayName(), 'role' => $log->user->roleType()?->value] : null,
                'action' => $log->action,
                'label' => $meta['label'],
                'category' => $meta['category'],
                'alert' => $meta['alert'],
                'table' => $log->table_affected,
                'record_id' => $log->record_id_affected,
                'record' => (string) $record,
                'ip_address' => $log->ip_address,
                'changes' => (object) $changes,
                'note' => isset($details['note']) ? (string) $details['note'] : null,
                // Anything else the action recorded, shown as-is under Details.
                'extra' => collect($details)->except(['changes', 'note'])->map(fn ($v) => self::text($v))->all() ?: null,
            ];
        })->values()->all();
    }

    private static function text(mixed $value): ?string
    {
        return match (true) {
            $value === null => null,
            is_bool($value) => $value ? 'true' : 'false',
            is_scalar($value) => (string) $value,
            default => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        };
    }
}

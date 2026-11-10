<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SecurityAlert;
use App\Services\ApiLatency;
use App\Services\AuditLogger;
use App\Services\SystemMetrics;
use App\Support\UserAgent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

/**
 * Live data for /admin/dashboard. The backup line is not served from here yet.
 */
class DashboardController extends Controller
{
    /** Readings are cached briefly so several admins (or quick refreshes) don't each start a measurement. */
    private const METRICS_CACHE_SECONDS = 10;

    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/admin/dashboard/health',
        summary: 'CPU, memory, and API response time (p95 per 5 minutes over the last hour)',
        tags: ['Admin: Dashboard'],
        responses: [new OA\Response(response: 200, description: 'Readings; null values mean the reading is unavailable on this server')],
    )]
    public function health(Request $request, SystemMetrics $metrics, ApiLatency $latency): JsonResponse
    {
        $fresh = $request->boolean('fresh');
        $key = 'admin-dashboard:system-metrics';
        if ($fresh) {
            Cache::forget($key);
        }

        $system = Cache::remember($key, self::METRICS_CACHE_SECONDS, fn () => [...$metrics->read(), 'measured_at' => now()->toIso8601String()]);

        return response()->json([
            'cpu_percent' => $system['cpu_percent'],
            'memory_used_bytes' => $system['memory_used_bytes'],
            'memory_total_bytes' => $system['memory_total_bytes'],
            'measured_at' => $system['measured_at'],
            'latency' => [
                'window_minutes' => ApiLatency::WINDOW_MINUTES,
                'series' => $latency->series(),
            ],
            'limits' => config('admin_dashboard.limits'),
        ]);
    }

    #[OA\Get(
        path: '/api/admin/dashboard/sessions',
        summary: 'Signed-in sessions active within the session lifetime',
        tags: ['Admin: Dashboard'],
        responses: [new OA\Response(response: 200, description: 'Active sessions, most recently active first')],
    )]
    public function sessions(Request $request): JsonResponse
    {
        $since = now()->subMinutes((int) config('session.lifetime'))->getTimestamp();
        $currentId = $request->hasSession() ? $request->session()->getId() : null;

        $rows = DB::table('sessions')
            ->join('users', 'users.user_id', '=', 'sessions.user_id')
            ->join('roles', 'roles.role_id', '=', 'users.role_id')
            ->whereNotNull('sessions.user_id')
            ->where('sessions.last_activity', '>=', $since)
            ->orderByDesc('sessions.last_activity')
            ->select([
                'sessions.id', 'sessions.ip_address', 'sessions.user_agent', 'sessions.last_activity',
                'users.user_id', 'users.first_name', 'users.last_name', 'users.username', 'roles.role_name',
            ])
            // When this person last signed in, from the audit log (sessions don't store it).
            ->selectSub(
                DB::table('audit_logs')
                    ->selectRaw('MAX(timestamp)')
                    ->whereColumn('audit_logs.user_id', 'users.user_id')
                    ->where('audit_logs.action', 'LOGIN'),
                'signed_in_at',
            )
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows->map(function (object $s) use ($currentId) {
                $agent = UserAgent::describe($s->user_agent);

                return [
                    'session_id_hint' => substr(hash('sha256', $s->id), 0, 12),
                    'user_id' => $s->user_id,
                    'name' => trim("{$s->first_name} {$s->last_name}") ?: $s->username,
                    'role' => $s->role_name,
                    'device' => $agent['device'],
                    'client' => $agent['client'],
                    'ip_address' => $s->ip_address,
                    'signed_in_at' => $s->signed_in_at ? Carbon::parse($s->signed_in_at)->toIso8601String() : null,
                    'last_active_at' => Carbon::createFromTimestamp($s->last_activity)->toIso8601String(),
                    'is_current' => $s->id === $currentId,
                ];
            })->values(),
        ]);
    }

    #[OA\Get(
        path: '/api/admin/dashboard/alerts',
        summary: 'Open security alerts, those needing action first',
        tags: ['Admin: Dashboard'],
        responses: [new OA\Response(response: 200, description: 'Open alerts')],
    )]
    public function alerts(): JsonResponse
    {
        $alerts = SecurityAlert::open()
            ->orderByRaw("CASE severity WHEN 'high' THEN 0 ELSE 1 END")
            ->orderByDesc('last_seen_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $alerts->map(fn (SecurityAlert $a) => [
            'alert_id' => $a->alert_id,
            'type' => $a->type,
            'severity' => $a->severity,
            'title' => $a->title,
            'detail' => $a->detail,
            'ip_address' => $a->ip_address,
            'occurrences' => $a->occurrences,
            'first_seen_at' => $a->first_seen_at->toIso8601String(),
            'last_seen_at' => $a->last_seen_at->toIso8601String(),
        ])]);
    }

    #[OA\Post(
        path: '/api/admin/dashboard/alerts/{alert}/review',
        summary: 'Mark an alert reviewed so it leaves the dashboard',
        tags: ['Admin: Dashboard'],
        parameters: [new OA\Parameter(name: 'alert', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))],
        responses: [new OA\Response(response: 204, description: 'Reviewed')],
    )]
    public function reviewAlert(Request $request, SecurityAlert $alert): JsonResponse
    {
        if ($alert->reviewed_at === null) {
            $alert->forceFill(['reviewed_at' => now(), 'reviewed_by_user_id' => $request->user()->user_id])->save();
            $this->audit->log('SECURITY_ALERT_REVIEWED', 'security_alerts', $alert->alert_id, $request->user(), [
                'type' => $alert->type,
                'title' => $alert->title,
            ]);
        }

        return response()->json(null, 204);
    }
}

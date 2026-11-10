<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Stores how long each API request took and summarises it for the dashboard
 * as the 95th percentile per 5-minute window over the last hour.
 */
class ApiLatency
{
    public const WINDOW_MINUTES = 5;

    public const WINDOWS = 12;

    private const KEEP_HOURS = 24;

    public function record(int $durationMs, int $status): void
    {
        DB::table('api_request_metrics')->insert([
            'recorded_at' => now(),
            'duration_ms' => max(0, $durationMs),
            'status' => $status,
        ]);

        // Prune now and then rather than on every request.
        if (random_int(1, 200) === 1) {
            DB::table('api_request_metrics')->where('recorded_at', '<', now()->subHours(self::KEEP_HOURS))->delete();
        }
    }

    /**
     * Oldest window first. A window with no requests has a null p95.
     *
     * @return list<array{window_start: string, p95_ms: int|null, requests: int}>
     */
    public function series(?Carbon $now = null): array
    {
        $seconds = self::WINDOW_MINUTES * 60;
        $now ??= now();
        // Windows end at the current moment, so the last one is always "the last 5 minutes".
        $start = $now->copy()->subSeconds($seconds * self::WINDOWS);

        $rows = DB::table('api_request_metrics')
            ->where('recorded_at', '>', $start)
            ->where('recorded_at', '<=', $now)
            ->selectRaw('LEAST(FLOOR(EXTRACT(EPOCH FROM (recorded_at - ?::timestamptz)) / ?)::int, ?) AS bucket', [$start->toIso8601String(), $seconds, self::WINDOWS - 1])
            ->selectRaw('percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95')
            ->selectRaw('COUNT(*) AS requests')
            ->groupBy('bucket')
            ->get()
            ->keyBy('bucket');

        $series = [];
        for ($i = 0; $i < self::WINDOWS; $i++) {
            $row = $rows[$i] ?? null;
            $series[] = [
                'window_start' => $start->copy()->addSeconds($seconds * $i)->toIso8601String(),
                'p95_ms' => $row ? (int) round((float) $row->p95) : null,
                'requests' => $row ? (int) $row->requests : 0,
            ];
        }

        return $series;
    }
}

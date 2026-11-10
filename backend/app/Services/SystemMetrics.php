<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;
use Throwable;

/**
 * CPU and memory readings for the server this API runs on. Linux reads /proc;
 * Windows (local development under Laragon) asks PowerShell. Anything else,
 * or a failed reading, returns nulls so the dashboard can say it is unavailable.
 */
class SystemMetrics
{
    /**
     * @return array{cpu_percent: int|null, memory_used_bytes: int|null, memory_total_bytes: int|null}
     */
    public function read(): array
    {
        try {
            return match (PHP_OS_FAMILY) {
                'Linux' => $this->linux(),
                'Windows' => $this->windows(),
                default => $this->unavailable(),
            };
        } catch (Throwable $e) {
            report($e);

            return $this->unavailable();
        }
    }

    /**
     * @return array{cpu_percent: int|null, memory_used_bytes: int|null, memory_total_bytes: int|null}
     */
    private function linux(): array
    {
        // CPU busy share between two samples of /proc/stat taken 250 ms apart.
        $sample = function (): array {
            $fields = array_map('intval', preg_split('/\s+/', trim(substr((string) file('/proc/stat')[0], 3))));
            $idle = $fields[3] + ($fields[4] ?? 0);

            return [array_sum($fields), $idle];
        };
        [$total1, $idle1] = $sample();
        usleep(250_000);
        [$total2, $idle2] = $sample();
        $totalDelta = $total2 - $total1;
        $cpu = $totalDelta > 0 ? (int) round(100 * (1 - ($idle2 - $idle1) / $totalDelta)) : null;

        preg_match_all('/^(\w+):\s+(\d+) kB/m', (string) file_get_contents('/proc/meminfo'), $m);
        $mem = array_combine($m[1], array_map('intval', $m[2]));
        $total = isset($mem['MemTotal']) ? $mem['MemTotal'] * 1024 : null;
        $available = isset($mem['MemAvailable']) ? $mem['MemAvailable'] * 1024 : null;

        return [
            'cpu_percent' => $cpu,
            'memory_used_bytes' => $total !== null && $available !== null ? $total - $available : null,
            'memory_total_bytes' => $total,
        ];
    }

    /**
     * @return array{cpu_percent: int|null, memory_used_bytes: int|null, memory_total_bytes: int|null}
     */
    private function windows(): array
    {
        $script = '$c=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average;'
            .'$o=Get-CimInstance Win32_OperatingSystem;'
            .'Write-Output "$c $($o.TotalVisibleMemorySize) $($o.FreePhysicalMemory)"';

        // `php artisan serve` starts PHP with a trimmed environment; PowerShell's CIM
        // queries fail without SystemRoot, and PATH may not include it.
        $root = getenv('SystemRoot') ?: ($_SERVER['SystemRoot'] ?? 'C:\\Windows');
        $powershell = $root.'\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

        $result = Process::timeout(10)
            ->env(['SystemRoot' => $root, 'windir' => $root])
            ->run([is_file($powershell) ? $powershell : 'powershell', '-NoProfile', '-NonInteractive', '-Command', $script]);
        if (! $result->successful()) {
            return $this->unavailable();
        }

        [$cpu, $totalKb, $freeKb] = array_pad(preg_split('/\s+/', trim($result->output())), 3, null);

        return [
            'cpu_percent' => is_numeric($cpu) ? (int) round((float) $cpu) : null,
            'memory_used_bytes' => is_numeric($totalKb) && is_numeric($freeKb) ? ((int) $totalKb - (int) $freeKb) * 1024 : null,
            'memory_total_bytes' => is_numeric($totalKb) ? (int) $totalKb * 1024 : null,
        ];
    }

    /**
     * @return array{cpu_percent: null, memory_used_bytes: null, memory_total_bytes: null}
     */
    private function unavailable(): array
    {
        return ['cpu_percent' => null, 'memory_used_bytes' => null, 'memory_total_bytes' => null];
    }
}

<?php

namespace App\Http\Middleware;

use App\Services\ApiLatency;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Times each API request for the dashboard's response-time chart. Recording
 * happens after the response is sent, and a failure to record never affects
 * the request itself.
 */
class RecordApiLatency
{
    public function __construct(private ApiLatency $latency) {}

    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set('latency_started_at', microtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $started = $request->attributes->get('latency_started_at');
        if (! is_float($started)) {
            return;
        }

        try {
            $this->latency->record((int) round((microtime(true) - $started) * 1000), $response->getStatusCode());
        } catch (Throwable) {
            // Metrics are best-effort; e.g. the table may not be migrated yet.
        }
    }
}

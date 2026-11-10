<?php

return [

    /*
    | Readings at or above these are shown as "High"/"Slow" on the admin
    | dashboard. Adjust to the server the parish actually runs on.
    */
    'limits' => [
        'cpu_percent' => (int) env('DASHBOARD_CPU_LIMIT', 85),
        'memory_percent' => (int) env('DASHBOARD_MEMORY_LIMIT', 90),
        'latency_ms' => (int) env('DASHBOARD_LATENCY_LIMIT_MS', 800),
    ],

];

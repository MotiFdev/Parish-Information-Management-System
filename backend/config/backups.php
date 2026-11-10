<?php

return [

    /*
    | Backup & Recovery. Backups are written to storage/app/private/backups.
    | The relational database is saved with PostgreSQL's pg_dump and restored
    | with pg_restore; pg_bin_path is the folder holding both (leave it empty
    | when they are on the PATH). On Laragon: C:\laragon\bin\postgresql\postgresql\bin
    */
    'pg_bin_path' => env('PG_BIN_PATH', ''),

    'directory' => 'backups',

    /** The nightly backup, in the parish's time zone. Needs `php artisan schedule:work` (or a cron / Task Scheduler entry running schedule:run). */
    'schedule_time' => env('BACKUP_TIME', '02:00'),

    /** Backup files older than this are deleted after each scheduled run; the latest good one of each database is always kept. */
    'keep_days' => (int) env('BACKUP_KEEP_DAYS', 30),

    /*
    | Tables left out of the relational backup: the backup history itself and
    | short-lived server data (sessions, cache, queued jobs, latency readings).
    | A restore leaves them as they are, so nobody is signed out by it.
    | Patterns also match each table's id sequence.
    */
    'skip_tables' => ['backup_runs*', 'sessions*', 'cache*', 'jobs*', 'job_batches*', 'failed_jobs*', 'api_request_metrics*'],

];

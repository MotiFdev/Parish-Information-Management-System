<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// AI Record Search: embed any register entry the save-time job missed (Gemini busy or down).
Schedule::command('records:index')->hourly()->withoutOverlapping();

// Backup & Recovery: both databases every night, then old backup files are pruned.
Schedule::command('backups:run')->dailyAt(config('backups.schedule_time'))->timezone(config('app.parish_timezone', 'Asia/Manila'))->withoutOverlapping();

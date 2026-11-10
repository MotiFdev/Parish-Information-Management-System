<?php

use App\Http\Controllers\Api\Admin\AiSettingsController;
use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\BackupController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AiSearchController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Community\ChapelController as CommunityChapelController;
use App\Http\Controllers\Api\Community\EventController as CommunityEventController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OfferingController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\Ppc\ChapelController as PpcChapelController;
use App\Http\Controllers\Api\Ppc\EventController as PpcEventController;
use App\Http\Controllers\Api\Priest\DashboardController as PriestDashboardController;
use App\Http\Controllers\Api\Priest\RecordCorrectionController as PriestRecordCorrectionController;
use App\Http\Controllers\Api\Priest\RecordRequestController as PriestRecordRequestController;
use App\Http\Controllers\Api\Priest\ReportController as PriestReportController;
use App\Http\Controllers\Api\Priest\SacramentalRecordController as PriestSacramentalRecordController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\Public\AnnouncementController as PublicAnnouncementController;
use App\Http\Controllers\Api\Public\AppointmentController as PublicAppointmentController;
use App\Http\Controllers\Api\Public\ChapelController as PublicChapelController;
use App\Http\Controllers\Api\Public\EventController as PublicEventController;
use App\Http\Controllers\Api\Public\InquiryController as PublicInquiryController;
use App\Http\Controllers\Api\Public\ParishController as PublicParishController;
use App\Http\Controllers\Api\Public\RecordRequestController as PublicRecordRequestController;
use App\Http\Controllers\Api\SonaController;
use App\Http\Controllers\Api\Staff\AnnouncementController as StaffAnnouncementController;
use App\Http\Controllers\Api\Staff\AppointmentController as StaffAppointmentController;
use App\Http\Controllers\Api\Staff\DashboardController as StaffDashboardController;
use App\Http\Controllers\Api\Staff\DocumentController as StaffDocumentController;
use App\Http\Controllers\Api\Staff\ParishionerController as StaffParishionerController;
use App\Http\Controllers\Api\Staff\RecordRequestController as StaffRecordRequestController;
use App\Http\Controllers\Api\Staff\ReportController as StaffReportController;
use App\Http\Controllers\Api\Staff\SacramentalRecordController as StaffSacramentalRecordController;
use App\Http\Controllers\Api\Staff\SettingsController as StaffSettingsController;
use App\Http\Controllers\Api\TestController;
use Illuminate\Support\Facades\Route;

Route::get('/test', [TestController::class, 'index']);
Route::get('/sonas', [SonaController::class, 'index']);
Route::get('/profile-photos/{file}', [ProfileController::class, 'photo'])->where('file', '[A-Za-z0-9]{40}\.(jpg|jpeg|png|webp)')->name('profile-photos.show');

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:6,1,password-reset');
    Route::post('/forgot-password', [PasswordResetController::class, 'forgot'])->middleware('throttle:5,1,forgot-password');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::put('/password', [PasswordController::class, 'update'])->middleware('throttle:6,1,password-change');
        Route::patch('/profile', [ProfileController::class, 'update']);
        Route::post('/profile/photo', [ProfileController::class, 'storePhoto'])->middleware('throttle:10,1,profile-photo');
        Route::delete('/profile/photo', [ProfileController::class, 'destroyPhoto']);
    });
});

/*
| Public site API: no account. People send record requests and appointment
| requests, then follow them with the reference number they get back. The
| reference is the only key, so lookups are throttled per address.
*/
Route::prefix('public')->group(function () {
    // Approved GKK and PYA-KKK events for the home page.
    Route::get('/events', [PublicEventController::class, 'index'])->middleware('throttle:60,1,public-events');
    // The Chapels & Officers page.
    Route::get('/chapels', [PublicChapelController::class, 'index'])->middleware('throttle:60,1,public-chapels');
    Route::get('/announcements', [PublicAnnouncementController::class, 'index'])->middleware('throttle:60,1,public-announcements');
    Route::get('/parish', [PublicParishController::class, 'show'])->middleware('throttle:60,1,public-parish');
    // Parish Inquiries chat. Each question calls Gemini, so one visitor can't spend the parish's quota.
    Route::post('/inquiries', [PublicInquiryController::class, 'ask'])->middleware('throttle:15,1,inquiries');

    Route::controller(PublicAppointmentController::class)->prefix('appointments')->group(function () {
        Route::get('/availability', 'availability')->middleware('throttle:60,1,appointment-availability');
        Route::post('/', 'store')->middleware('throttle:10,1,appointment-create');
        Route::get('/{reference}', 'show')->where('reference', '[A-Za-z0-9 -]{1,30}')->middleware('throttle:20,1,appointment-track');
    });

    Route::controller(PublicRecordRequestController::class)->prefix('record-requests')->group(function () {
        Route::post('/', 'store')->middleware('throttle:10,1,record-request-create');
        Route::get('/{reference}', 'show')->where('reference', '[A-Za-z0-9 -]{1,30}')->middleware('throttle:20,1,record-request-track');
        Route::post('/{reference}/documents/{requestDocument}', 'upload')
            ->where('reference', '[A-Za-z0-9 -]{1,30}')->whereUuid('requestDocument')->middleware('throttle:20,1,record-request-upload');
        Route::post('/{reference}/details/unlock', 'unlockDetails')->where('reference', '[A-Za-z0-9 -]{1,30}')->middleware('throttle:10,1,record-request-unlock');
        Route::put('/{reference}/details', 'updateDetails')->where('reference', '[A-Za-z0-9 -]{1,30}')->middleware('throttle:10,1,record-request-details');
    });
});

/*
| Parish office (staff portal) API.
*/
Route::prefix('secretary')->middleware(['auth:sanctum', 'active', 'role:secretary'])->group(function () {
    Route::controller(StaffAppointmentController::class)->prefix('appointments')->group(function () {
        Route::get('/', 'index');
        Route::get('/assignees', 'assignees');
        Route::post('/{appointment}/approve', 'approve')->whereUuid('appointment');
        Route::post('/{appointment}/reject', 'reject')->whereUuid('appointment');
        Route::post('/{appointment}/reschedule', 'reschedule')->whereUuid('appointment');
        Route::post('/{appointment}/assign', 'assign')->whereUuid('appointment');
    });

    Route::get('/dashboard', [StaffDashboardController::class, 'show']);
    Route::get('/reports', [StaffReportController::class, 'show']);

    Route::controller(StaffSettingsController::class)->prefix('settings')->group(function () {
        Route::get('/', 'show');
        Route::put('/notifications', 'updateNotifications');
        Route::put('/defaults', 'updateDefaults');
    });

    Route::controller(StaffAnnouncementController::class)->prefix('announcements')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::patch('/{announcement}', 'update')->whereUuid('announcement');
        Route::delete('/{announcement}', 'destroy')->whereUuid('announcement');
        foreach (['publish' => 'publish', 'unschedule' => 'unschedule', 'archive' => 'archive', 'to-draft' => 'toDraft', 'pin' => 'pin'] as $path => $method) {
            Route::post("/{announcement}/{$path}", $method)->whereUuid('announcement');
        }
    });

    Route::controller(StaffDocumentController::class)->prefix('documents')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:60,1,document-upload');
        Route::patch('/{document}/link', 'relink')->whereUuid('document');
    });

    Route::controller(StaffParishionerController::class)->prefix('parishioners')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::patch('/{parishioner}', 'update')->whereUuid('parishioner');
        Route::post('/{parishioner}/archive', 'archive')->whereUuid('parishioner');
        Route::post('/{parishioner}/restore', 'restore')->whereUuid('parishioner');
    });

    Route::controller(StaffSacramentalRecordController::class)->prefix('sacramental-records')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::post('/{record}/corrections', 'correct')->whereUuid('record');
    });
    Route::get('/record-requests/{recordRequest}/entry-draft', [StaffSacramentalRecordController::class, 'draft'])->whereUuid('recordRequest');

    Route::controller(StaffRecordRequestController::class)->group(function () {
        Route::get('/registers/lookup', 'lookup');
        Route::prefix('record-requests')->group(function () {
            Route::get('/', 'index');
            Route::post('/{recordRequest}/start', 'start')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/documents/{requestDocument}/review', 'reviewDocument')->whereUuid(['recordRequest', 'requestDocument']);
            Route::post('/{recordRequest}/remarks', 'remark')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/requirements', 'requestDocuments')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/return-details', 'returnDetails')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/register', 'register')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/send', 'send')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/ready', 'ready')->whereUuid('recordRequest');
            Route::post('/{recordRequest}/complete', 'complete')->whereUuid('recordRequest');
        });
    });
});

/*
| GKK and PYA-KKK portal API: Chapels & Officers, and the events they set up.
*/
Route::prefix('community')->middleware(['auth:sanctum', 'active', 'role:gkk,pya-kkk'])->group(function () {
    Route::controller(CommunityChapelController::class)->group(function () {
        Route::get('/chapels', 'index');
        Route::post('/chapels', 'store');
        Route::patch('/chapels/{chapel}', 'update')->whereNumber('chapel');
        Route::delete('/chapels/{chapel}', 'destroy')->whereNumber('chapel');
        Route::post('/chapels/{chapel}/officers/import', 'importOfficers')->whereNumber('chapel');
        Route::post('/officers', 'storeOfficer');
        Route::patch('/officers/{officer}', 'updateOfficer')->whereUuid('officer');
        Route::delete('/officers/{officer}', 'destroyOfficer')->whereUuid('officer');
    });

    Route::controller(CommunityEventController::class)->prefix('events')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::patch('/{event}', 'update')->whereUuid('event');
        Route::delete('/{event}', 'destroy')->whereUuid('event');
    });
});

/*
| PPC portal API: approving GKK and PYA-KKK events, and the chapels and
| officers they add.
*/
Route::prefix('ppc')->middleware(['auth:sanctum', 'active', 'role:ppc'])->group(function () {
    Route::controller(PpcChapelController::class)->group(function () {
        Route::get('/chapels', 'index');
        Route::post('/chapels/{chapel}/approve', 'approveChapel')->whereNumber('chapel');
        Route::post('/chapels/{chapel}/reject', 'rejectChapel')->whereNumber('chapel');
        Route::post('/officers/approve', 'approveOfficers');
        Route::post('/officers/{officer}/reject', 'rejectOfficer')->whereUuid('officer');
    });

    Route::controller(PpcEventController::class)->prefix('events')->group(function () {
        Route::get('/', 'index');
        Route::post('/{event}/approve', 'approve')->whereUuid('event');
        Route::post('/{event}/reject', 'reject')->whereUuid('event');
    });
});

/*
| Parish priest portal API: certificate approvals and the registers, read-only.
*/
Route::prefix('priest')->middleware(['auth:sanctum', 'active', 'role:priest'])->group(function () {
    Route::controller(PriestRecordRequestController::class)->prefix('record-requests')->group(function () {
        Route::get('/', 'index');
        Route::post('/{recordRequest}/approve', 'approve')->whereUuid('recordRequest');
        Route::post('/{recordRequest}/reject', 'reject')->whereUuid('recordRequest');
    });

    Route::get('/sacramental-records', [PriestSacramentalRecordController::class, 'index']);
    Route::get('/reports', [PriestReportController::class, 'show']);
    Route::get('/dashboard', [PriestDashboardController::class, 'show']);

    Route::controller(PriestRecordCorrectionController::class)->prefix('record-corrections')->group(function () {
        Route::get('/', 'index');
        Route::post('/{correction}/approve', 'approve')->whereUuid('correction');
        Route::post('/{correction}/reject', 'reject')->whereUuid('correction');
    });
});

/*
| AI Record Search, the same for staff and the priest: each portal has its own
| path so the page stays inside that portal's API.
*/
foreach (['secretary', 'priest'] as $portal) {
    Route::controller(AiSearchController::class)->prefix("{$portal}/ai-search")->middleware(['auth:sanctum', 'active', "role:{$portal}"])->group(function () {
        Route::get('/', 'index');
        // Each search calls Gemini; the limit keeps one person from spending the parish's quota.
        Route::post('/', 'search')->middleware('throttle:30,1,ai-search');
        Route::delete('/history', 'clear');
        Route::delete('/history/{search}', 'forget')->whereUuid('search');
    });
}

/*
| The offerings ledger, kept by the parish office and the priest.
*/
Route::controller(OfferingController::class)->prefix('offerings')->middleware(['auth:sanctum', 'active', 'role:secretary,priest'])->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::patch('/{offering}', 'update')->whereUuid('offering');
    Route::delete('/{offering}', 'destroy')->whereUuid('offering');
});

/*
| The header bell in every portal: the signed-in person's own notices.
*/
Route::controller(NotificationController::class)->prefix('notifications')->middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('/', 'index')->middleware('throttle:120,1,notifications');
    Route::post('/read-all', 'readAll');
    Route::post('/{notification}/read', 'read')->whereUuid('notification');
});

/*
| Uploaded documents: staff and the priest get a short-lived link;
| the file route itself only accepts valid, unexpired signatures.
*/
Route::get('/documents/{document}/link', [DocumentController::class, 'link'])->whereUuid('document')->middleware(['auth:sanctum', 'active', 'throttle:60,1,document-link']);
Route::get('/documents/{document}/file', [DocumentController::class, 'file'])->whereUuid('document')->middleware('signed')->name('documents.file');

/*
| Administrator portal API. Everything in here needs a signed-in, active
| System Administrator; add the /admin/* endpoints (users, audit logs, backup,
| AI settings) inside this group.
*/
Route::prefix('admin')->middleware(['auth:sanctum', 'active', 'role:admin'])->group(function () {
    Route::controller(DashboardController::class)->prefix('dashboard')->group(function () {
        Route::get('/health', 'health');
        Route::get('/sessions', 'sessions');
        Route::get('/alerts', 'alerts');
        Route::post('/alerts/{alert}/review', 'reviewAlert')->whereUuid('alert');
    });

    // Read-only on purpose: audit entries can't be edited or deleted through the API.
    Route::controller(AuditLogController::class)->prefix('audit-logs')->group(function () {
        Route::get('/', 'index');
        Route::get('/export', 'export')->middleware('throttle:10,1,audit-export');
    });

    // AI Engine Settings. Saving a new model, each re-index step, and each preview call Gemini.
    Route::controller(AiSettingsController::class)->prefix('ai-settings')->group(function () {
        Route::get('/', 'show');
        Route::put('/', 'update')->middleware('throttle:20,1,ai-settings-save');
        Route::post('/reindex', 'startReindex');
        Route::post('/reindex/step', 'stepReindex')->middleware('throttle:120,1,ai-reindex-step');
        Route::post('/preview', 'preview')->middleware('throttle:20,1,ai-settings-preview');
    });

    // Backups run pg_dump/pg_restore on the server, so they are throttled hard.
    Route::controller(BackupController::class)->prefix('backups')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store')->middleware('throttle:6,1,backup-run');
        Route::post('/{backup}/restore', 'restore')->whereUuid('backup')->middleware('throttle:3,1,backup-restore');
    });

    Route::controller(UserController::class)->prefix('users')->group(function () {
        Route::get('/', 'index');
        Route::post('/', 'store');
        Route::patch('/{user}', 'update')->whereUuid('user');
        Route::post('/{user}/password-reset', 'sendPasswordReset')->whereUuid('user')->middleware('throttle:10,1,user-password-reset');
        Route::post('/{user}/deactivate', 'deactivate')->whereUuid('user');
        Route::post('/{user}/activate', 'activate')->whereUuid('user');
    });
});

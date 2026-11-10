<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\ParishSetting;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Support\StaffPreferences;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * The staff Settings page: the signed-in staff member's notification choices
 * and page defaults, plus the office hours the whole office shares.
 */
class SettingsController extends Controller
{
    public function __construct(private AuditLogger $audit, private OfficeNotifier $notifier) {}

    #[OA\Get(path: '/api/secretary/settings', summary: 'My notification choices and page defaults, and the office hours', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Settings')])]
    public function show(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();

        return response()->json($this->present($me));
    }

    #[OA\Put(
        path: '/api/secretary/settings/notifications',
        summary: 'Turn notifications on or off',
        description: 'Fields: email, newRequests, resubmissions, priestDecisions, bookings, announcements (booleans; send only the ones that change).',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved')],
    )]
    public function updateNotifications(Request $request): JsonResponse
    {
        $rules = array_map(fn () => ['sometimes', 'boolean'], StaffPreferences::NOTIFY);
        $data = array_map('boolval', $request->validate($rules));
        /** @var User $me */
        $me = $request->user();

        DB::transaction(function () use ($me, $data) {
            $prefs = User::query()->lockForUpdate()->findOrFail($me->user_id)->preferences ?? [];
            $prefs['notify'] = [...($prefs['notify'] ?? []), ...$data];
            $me->forceFill(['preferences' => $prefs])->save();
        });

        if (array_key_exists('announcements', $data)) {
            // Posts this person already scheduled follow the new choice.
            Announcement::query()->where('created_by_user_id', $me->user_id)->get()->each(fn (Announcement $post) => $this->notifier->syncScheduled($post));
        }

        return response()->json($this->present($me));
    }

    #[OA\Put(
        path: '/api/secretary/settings/defaults',
        summary: 'Where the office pages open, and the office hours',
        description: 'Fields: register, calendar_view, report_period, page_size (mine), office_hours (shared by the whole office).',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 422, description: 'Invalid')],
    )]
    public function updateDefaults(Request $request): JsonResponse
    {
        $choices = StaffPreferences::CHOICES;
        $data = $request->validate([
            'register' => ['required', Rule::in($choices['register'])],
            'calendar_view' => ['required', Rule::in($choices['calendarView'])],
            'report_period' => ['required', Rule::in($choices['reportPeriod'])],
            'page_size' => ['required', Rule::in($choices['pageSize'])],
            'office_hours' => ['required', 'string', 'max:120'],
        ], [
            'office_hours.required' => 'Enter the office hours parishioners should see.',
        ]);
        $hours = trim(preg_replace('/\s+/u', ' ', $data['office_hours']) ?? '');
        /** @var User $me */
        $me = $request->user();
        $before = ParishSetting::value('office_hours');

        DB::transaction(function () use ($me, $data, $hours, $before) {
            $prefs = User::query()->lockForUpdate()->findOrFail($me->user_id)->preferences ?? [];
            $prefs['defaults'] = [
                'register' => $data['register'],
                'calendarView' => $data['calendar_view'],
                'reportPeriod' => $data['report_period'],
                'pageSize' => (string) $data['page_size'],
            ];
            $me->forceFill(['preferences' => $prefs])->save();

            if ($hours !== $before) {
                ParishSetting::put('office_hours', $hours, $me);
            }
        });

        if ($hours !== $before) {
            $this->audit->log('OFFICE_HOURS_UPDATED', 'parish_settings', 'office_hours', $me, ['from' => $before, 'to' => $hours]);
        }

        return response()->json($this->present($me));
    }

    /**
     * @return array<string, mixed>
     */
    private function present(User $me): array
    {
        return [...StaffPreferences::of($me), 'office_hours' => ParishSetting::value('office_hours')];
    }
}

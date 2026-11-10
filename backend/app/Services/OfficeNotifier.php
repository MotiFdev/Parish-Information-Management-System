<?php

namespace App\Services;

use App\Enums\AnnouncementStatus;
use App\Enums\UserRole;
use App\Models\Announcement;
use App\Models\Appointment;
use App\Models\Notification;
use App\Models\RecordRequest;
use App\Models\SacramentalRecord;
use App\Models\SacramentalRecordCorrection;
use App\Models\User;
use App\Notifications\OfficeNoticeNotification;
use App\Support\StaffPreferences;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Date;

/**
 * Notices for the header bell in the staff and priest portals. Staff choose
 * which office events reach them (StaffPreferences), and can get an email
 * copy; the priest is told what is waiting for him.
 */
class OfficeNotifier
{
    /** A requester sent a new record request. */
    public function newRequest(RecordRequest $r): void
    {
        $subject = RecordRequests::subject($r);
        $type = $r->recordType?->name;
        $this->toStaff('newRequests', "New {$r->request_type->value} request {$r->request_number}".($type ? " ({$type})" : '').($subject ? " for {$subject}." : '.'), self::requestLink($r), ['request_id' => $r->request_id]);
    }

    /** A requester uploaded a document again or sent corrected details: tell whoever handles it, or everyone if no one does yet. */
    public function resubmitted(RecordRequest $r, string $message): void
    {
        $handler = $r->handled_by_staff_id ? User::query()->find($r->handled_by_staff_id) : null;
        $this->toStaff('resubmissions', $message, self::requestLink($r), ['request_id' => $r->request_id], $handler);
    }

    /** The priest decided on a request: tell the staff member who sent it. */
    public function priestDecided(RecordRequest $r, bool $approved, ?string $reason): void
    {
        $sender = $r->verified_by_staff_id ? User::query()->find($r->verified_by_staff_id) : null;
        if (! $sender) {
            return;
        }
        $message = $approved
            ? "The parish priest approved request {$r->request_number}. Mark it ready for collection once the certificate is printed."
            : "The parish priest did not approve request {$r->request_number}: {$reason}";
        $this->toStaff('priestDecisions', $message, self::requestLink($r), ['request_id' => $r->request_id], $sender);
    }

    public function newBooking(Appointment $a): void
    {
        $when = $a->scheduled_start->timezone((string) config('app.parish_timezone', 'Asia/Manila'));
        $this->toStaff(
            'bookings',
            "New appointment request: {$a->event_type} on {$when->format('M j')} at {$when->format('g:i A')}, from {$a->requester_name}.",
            '/secretary/appointments?'.http_build_query(['date' => $when->toDateString(), 'appointment' => $a->appointment_id]),
            ['appointment_id' => $a->appointment_id],
        );
    }

    /** A request was sent for approval. */
    public function awaitingPriest(RecordRequest $r): void
    {
        $this->toPriests("Request {$r->request_number} is waiting for your approval.", '/priest/records/verify?'.http_build_query(['request' => $r->request_number]), ['request_id' => $r->request_id]);
    }

    public function correctionAwaitingPriest(SacramentalRecord $record, string $type, string $subject): void
    {
        $this->toPriests(
            "A correction to the {$type} entry for {$subject} is waiting for your review.",
            '/priest/records/sacramental?'.http_build_query(['register' => strtolower($type), 'entry' => $record->record_id]),
            [],
        );
    }

    /**
     * Scheduled announcements go live on their own, with nothing running at
     * that moment. So the "now live" notice is written ahead, dated at the
     * publish time; the inbox only shows notices whose time has come. Call
     * after every change to the post, so the notice follows the schedule.
     */
    /** Tells the staff member who filed a register correction what the priest decided. */
    public function correctionDecided(SacramentalRecordCorrection $c, bool $approved, ?string $reason): void
    {
        $record = $c->record()->with(['sacramentType', 'primaryParishioner', 'secondaryParishioner'])->first();
        $sender = $c->requestedBy;
        if (! $record || ! $sender) {
            return;
        }
        $type = $record->sacramentType->name;
        $subject = app(SacramentalRegister::class)->subjectOf($record);
        $message = $approved
            ? "The parish priest approved your correction to the {$type} entry for {$subject}. The register now shows the new details."
            : "The parish priest did not approve your correction to the {$type} entry for {$subject}: {$reason}";
        $link = '/secretary/sacraments?'.http_build_query(['register' => strtolower($type), 'entry' => $record->record_id]);
        $this->toStaff('priestDecisions', $message, $link, [], $sender);
    }

    public function syncScheduled(Announcement $post): void
    {
        Notification::query()->where('announcement_id', $post->announcement_id)->where('created_at', '>', Date::now())->delete();

        $author = $post->created_by_user_id ? User::query()->find($post->created_by_user_id) : null;
        $scheduled = $post->status === AnnouncementStatus::Published && $post->published_at?->isFuture();
        if (! $scheduled || ! $author?->is_active || ! StaffPreferences::wants($author, 'announcements')) {
            return;
        }

        Notification::create([
            'user_id' => $author->user_id,
            'announcement_id' => $post->announcement_id,
            'kind' => 'announcements',
            'message' => "Your scheduled announcement “{$post->title}” is now live on the home page.",
            'link' => '/secretary/announcements?'.http_build_query(['notice' => $post->announcement_id]),
            'created_at' => $post->published_at,
        ]);
    }

    /**
     * @param  array<string, string>  $refs
     */
    private function toStaff(string $event, string $message, string $link, array $refs, ?User $only = null): void
    {
        $people = $only ? collect([$only])->filter(fn (User $u) => $u->is_active && $u->hasRole(UserRole::ParishStaff)) : $this->active(UserRole::ParishStaff);

        foreach ($people as $person) {
            if (! StaffPreferences::wants($person, $event)) {
                continue;
            }
            Notification::create(['user_id' => $person->user_id, 'kind' => $event, 'message' => $message, 'link' => $link, ...$refs]);
            if (StaffPreferences::wants($person, 'email') && $person->email) {
                $person->notify(new OfficeNoticeNotification($message, $link));
            }
        }
    }

    /**
     * @param  array<string, string>  $refs
     */
    private function toPriests(string $message, string $link, array $refs): void
    {
        foreach ($this->active(UserRole::ParishPriest) as $priest) {
            Notification::create(['user_id' => $priest->user_id, 'kind' => 'approvals', 'message' => $message, 'link' => $link, ...$refs]);
        }
    }

    /**
     * @return Collection<int, User>
     */
    private function active(UserRole $role): Collection
    {
        return User::query()->with('role')->where('is_active', true)
            ->whereHas('role', fn (Builder $q) => $q->where('role_name', $role->value))
            ->get();
    }

    private static function requestLink(RecordRequest $r): string
    {
        return '/secretary/requests?'.http_build_query(['request' => $r->request_number]);
    }
}

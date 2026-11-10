<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Announcement;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * The sample announcements the home page and the staff Announcements page
 * used to show: live, scheduled, draft, and archived posts. Runs only when
 * APP_ENV=local. Safe to re-run: a post with
 * the same title is left as it is.
 */
class AnnouncementSampleSeeder extends Seeder
{
    /**
     * title, body (editor HTML), category, status, publish time (Manila), pinned. A Published post with a
     * future time is scheduled.
     *
     * @var list<array{0: string, 1: string, 2: string, 3: string, 4: string|null, 5?: bool}>
     */
    private const POSTS = [
        ['Fiesta Novena for the Sacred Heart of Jesus', '<p>Join the nine-day novena leading to the parish fiesta. Each evening Mass is assigned to a Sona; please check the schedule posted at the church entrance.</p>', 'Parish', 'Published', '2026-10-27 09:00', true],
        ['All Souls’ Day Mass schedule', '<p>Masses will be celebrated at the parish cemetery chapel on November 2. Mass intentions for the departed are accepted at the parish office until October 31.</p>', 'Liturgy', 'Published', '2026-10-25 09:00'],
        ['Community baptism in November', '<p>Parents and godparents must attend the pre-baptismal seminar on the Saturday before the baptism. Bring the child’s PSA birth certificate.</p>', 'Sacraments', 'Published', '2026-10-20 09:00'],
        ['Chapel officers’ assembly', '<p>All chapel presidents and ministry coordinators are invited to the quarterly assembly at the parish hall after the 9:00 AM Mass.</p>', 'Chapels', 'Published', '2026-10-18 09:00'],
        ['Parish office hours during the fiesta', '<p>The parish office will close at noon on the feast of the Sacred Heart. Certificate releases resume the following day.</p>', 'Parish', 'Published', '2026-10-12 09:00'],
        ['Wedding banns for October', '<p>The following couples intend to marry. Anyone who knows of an impediment is asked to tell the parish priest.</p><ul><li>Joshua Reyes and Kristine Uy</li><li>Mark Aquino and Bea Gonzaga</li></ul>', 'Sacraments', 'Published', '2026-10-04 09:00'],
        ['Christ the King procession', '<p>The parish procession for the Solemnity of Christ the King starts after the 4:00 PM Mass on <strong>Sunday, November 22</strong>.</p><ul><li>Each Sona brings its banner and gathers at the church patio by 3:30 PM.</li><li>Marshals from the Social Services ministry guide the route.</li></ul>', 'Liturgy', 'Published', '2026-11-15 08:00'],
        ['Advent recollection for chapel officers', '<p>A half-day recollection for chapel presidents and ministry coordinators, led by Fr. Antonio Reyes.</p><p>Please confirm attendance with your Sona coordinator by November 25.</p>', 'Chapels', 'Published', '2026-11-20 09:00'],
        ['Simbang Gabi schedule', '<p>Nine dawn Masses from December 16 to 24.</p><ol><li>4:30 AM at the parish church</li><li>Chapel schedules to follow</li></ol>', 'Liturgy', 'Draft', null],
        ['Updated requirements for certificate requests', '<p>From December, requests for a marriage requirement copy need a valid ID of the person named on the record.</p>', 'Sacraments', 'Draft', null],
        ['Holy Week schedule', '<p>Palm Sunday to Easter Sunday Mass and service times for the parish church and all chapels.</p>', 'Liturgy', 'Archived', '2026-03-20 09:00'],
        ['Summer catechism for children', '<p>Catechism classes for children aged 7 to 12, every Saturday in May at the parish hall.</p>', 'Parish', 'Archived', '2026-04-25 09:00'],
    ];

    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        $author = User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::ParishStaff->value))->first()
            ?? User::query()->whereHas('role', fn ($q) => $q->where('role_name', UserRole::SystemAdministrator->value))->first();
        if (! $author) {
            $this->command?->warn('No staff or admin account to post the announcements under; run PortalUserSeeder first.');

            return;
        }

        $added = 0;
        foreach (self::POSTS as $post) {
            [$title, $body, $category, $status, $on] = $post;
            $at = $on ? CarbonImmutable::parse($on, 'Asia/Manila')->utc() : null;
            $a = Announcement::query()->firstOrCreate(['title' => $title], [
                'content_markdown' => $body, 'category' => $category, 'is_pinned' => $post[5] ?? false,
                'status' => $status, 'published_at' => $at, 'created_by_user_id' => $author->user_id,
            ]);
            if ($a->wasRecentlyCreated) {
                $stamp = $at && $at->isPast() ? $at : CarbonImmutable::parse('2026-10-30 09:00', 'Asia/Manila')->utc();
                $a->forceFill(['created_at' => $stamp, 'updated_at' => $stamp])->saveQuietly();
                $added++;
            } elseif (! str_starts_with(trim($a->content_markdown), '<')) {
                // Posts saved before the editor stored HTML.
                $a->forceFill(['content_markdown' => $body])->saveQuietly();
            }
        }

        $this->command?->info("Added {$added} sample announcements.");
    }
}

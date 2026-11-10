<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\AnnouncementStatus;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\OfficeNotifier;
use App\Support\DisplayName;
use App\Support\SafeHtml;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Announcements for the parishioner home page, written by staff. A post is a
 * Draft, Published (live), Scheduled (Published with a future publish time),
 * or Archived (hidden, kept for the record). One live post is pinned: when a
 * pinned post is published or scheduled it takes the pin from the others; a
 * draft keeps its pin until then. Only drafts and archived posts can be deleted.
 */
class AnnouncementController extends Controller
{
    public const CATEGORIES = ['Parish', 'Liturgy', 'Sacraments', 'Chapels'];

    public function __construct(private AuditLogger $audit, private OfficeNotifier $notifier) {}

    #[OA\Get(path: '/api/secretary/announcements', summary: 'Every announcement, last edited first', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Announcements')])]
    public function index(): JsonResponse
    {
        $posts = Announcement::query()->with('createdBy')->orderByDesc('updated_at')->orderByDesc('created_at')->get();

        return response()->json(['data' => $posts->map(fn (Announcement $a) => $this->present($a))->values()]);
    }

    #[OA\Post(
        path: '/api/secretary/announcements',
        summary: 'Write an announcement',
        description: 'Fields: title, category, body (HTML; cleaned on save), pinned, mode (draft | now | schedule), publish_at (with schedule).',
        tags: ['Staff'],
        responses: [new OA\Response(response: 201, description: 'Saved'), new OA\Response(response: 422, description: 'Invalid')],
    )]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);
        /** @var User $me */
        $me = $request->user();

        $post = DB::transaction(function () use ($data, $me) {
            $post = new Announcement(['created_by_user_id' => $me->user_id]);

            $post = $this->fill($post, $data);
            $this->notifier->syncScheduled($post);

            return $post;
        });
        $this->audit->log('ANNOUNCEMENT_CREATED', 'announcements', $post->announcement_id, $me, ['title' => $post->title, 'status' => $this->status($post)]);

        return response()->json(['data' => $this->present($post->fresh('createdBy'))], 201);
    }

    #[OA\Patch(
        path: '/api/secretary/announcements/{announcement}',
        summary: 'Edit an announcement; mode keep leaves a live post live',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 409, description: 'Archived: move it back to drafts first')],
    )]
    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        if ($announcement->status === AnnouncementStatus::Archived) {
            return response()->json(['message' => 'Move this announcement back to drafts before editing it.'], 409);
        }
        $data = $this->validated($request, $announcement);
        DB::transaction(fn () => $this->notifier->syncScheduled($this->fill($announcement, $data)));
        $this->log($request, 'ANNOUNCEMENT_UPDATED', $announcement);

        return response()->json(['data' => $this->present($announcement->fresh('createdBy'))]);
    }

    #[OA\Post(path: '/api/secretary/announcements/{announcement}/publish', summary: 'Publish now (a draft or a scheduled post)', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Live')])]
    public function publish(Request $request, Announcement $announcement): JsonResponse
    {
        return $this->move($request, $announcement, fn (string $s) => in_array($s, ['Draft', 'Scheduled'], true), 'ANNOUNCEMENT_PUBLISHED', function (Announcement $a) {
            $a->forceFill(['status' => AnnouncementStatus::Published, 'published_at' => now()]);
            if ($a->is_pinned) {
                $this->unpinOthers($a);
            }
        });
    }

    #[OA\Post(path: '/api/secretary/announcements/{announcement}/unschedule', summary: 'Cancel a schedule: back to drafts', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Draft')])]
    public function unschedule(Request $request, Announcement $announcement): JsonResponse
    {
        return $this->move($request, $announcement, fn (string $s) => $s === 'Scheduled', 'ANNOUNCEMENT_UNSCHEDULED', fn (Announcement $a) => $a->forceFill(['status' => AnnouncementStatus::Draft, 'published_at' => null]));
    }

    #[OA\Post(path: '/api/secretary/announcements/{announcement}/archive', summary: 'Archive a live post: hidden from parishioners, kept here', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Archived')])]
    public function archive(Request $request, Announcement $announcement): JsonResponse
    {
        return $this->move($request, $announcement, fn (string $s) => $s === 'Published', 'ANNOUNCEMENT_ARCHIVED', fn (Announcement $a) => $a->forceFill(['status' => AnnouncementStatus::Archived, 'is_pinned' => false]));
    }

    #[OA\Post(path: '/api/secretary/announcements/{announcement}/to-draft', summary: 'Move an archived post back to drafts', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Draft')])]
    public function toDraft(Request $request, Announcement $announcement): JsonResponse
    {
        return $this->move($request, $announcement, fn (string $s) => $s === 'Archived', 'ANNOUNCEMENT_TO_DRAFT', fn (Announcement $a) => $a->forceFill(['status' => AnnouncementStatus::Draft, 'published_at' => null]));
    }

    #[OA\Post(path: '/api/secretary/announcements/{announcement}/pin', summary: 'Pin (moving the pin from any other post) or unpin a live post', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Saved')])]
    public function pin(Request $request, Announcement $announcement): JsonResponse
    {
        $pinned = $request->validate(['pinned' => ['required', 'boolean']])['pinned'];

        return $this->move($request, $announcement, fn (string $s) => $s === 'Published', $pinned ? 'ANNOUNCEMENT_PINNED' : 'ANNOUNCEMENT_UNPINNED', function (Announcement $a) use ($pinned) {
            if ($pinned) {
                $this->unpinOthers($a);
            }
            $a->forceFill(['is_pinned' => $pinned]);
        });
    }

    #[OA\Delete(path: '/api/secretary/announcements/{announcement}', summary: 'Delete a draft or archived post for good', tags: ['Staff'], responses: [new OA\Response(response: 204, description: 'Deleted'), new OA\Response(response: 409, description: 'Live or scheduled posts are archived or unscheduled instead')])]
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        if (! in_array($this->status($announcement), ['Draft', 'Archived'], true)) {
            return response()->json(['message' => 'Only drafts and archived announcements can be deleted. Archive or unschedule it first.'], 409);
        }
        $title = $announcement->title;
        $id = $announcement->announcement_id;
        $announcement->delete();
        /** @var User $me */
        $me = $request->user();
        $this->audit->log('ANNOUNCEMENT_DELETED', 'announcements', $id, $me, ['title' => $title]);

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Announcement $current): array
    {
        $live = $current && $this->status($current) === 'Published';
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'body' => ['required', 'string', 'max:50000'],
            'pinned' => ['boolean'],
            'mode' => ['required', Rule::in($live ? ['keep', 'draft'] : ['draft', 'now', 'schedule'])],
            'publish_at' => ['required_if:mode,schedule', 'nullable', 'date', 'after:now'],
        ], [
            'title.required' => 'Give the announcement a title.',
            'body.required' => 'Write the announcement.',
            'publish_at.required_if' => 'Choose the date and time it goes live.',
            'publish_at.after' => 'Choose a time later than now.',
        ]);

        $data['body'] = SafeHtml::clean($data['body']);
        if (SafeHtml::text($data['body']) === '') {
            throw ValidationException::withMessages(['body' => 'Write the announcement.']);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function fill(Announcement $post, array $data): Announcement
    {
        $post->fill(['title' => trim($data['title']), 'category' => $data['category'], 'content_markdown' => $data['body']]);
        match ($data['mode']) {
            'draft' => $post->forceFill(['status' => AnnouncementStatus::Draft, 'published_at' => null]),
            'now' => $post->forceFill(['status' => AnnouncementStatus::Published, 'published_at' => now()]),
            'schedule' => $post->forceFill(['status' => AnnouncementStatus::Published, 'published_at' => $data['publish_at']]),
            default => null,
        };
        $pinned = (bool) ($data['pinned'] ?? false);
        if ($pinned && $post->status === AnnouncementStatus::Published) {
            $this->unpinOthers($post);
        }
        $post->forceFill(['is_pinned' => $pinned])->save();

        return $post;
    }

    private function unpinOthers(Announcement $post): void
    {
        Announcement::query()->where('is_pinned', true)->where('status', AnnouncementStatus::Published->value)
            ->when($post->exists, fn ($q) => $q->whereKeyNot($post->getKey()))
            ->update(['is_pinned' => false]);
    }

    /**
     * Runs one status change if the post is in a state that allows it.
     *
     * @param  \Closure(string): bool  $allowed
     * @param  \Closure(Announcement): mixed  $change
     */
    private function move(Request $request, Announcement $announcement, \Closure $allowed, string $action, \Closure $change): JsonResponse
    {
        $done = DB::transaction(function () use ($announcement, $allowed, $change) {
            $a = Announcement::query()->lockForUpdate()->findOrFail($announcement->getKey());
            if (! $allowed($this->status($a))) {
                return null;
            }
            $change($a);
            $a->save();
            $this->notifier->syncScheduled($a);

            return $a;
        });
        if (! $done) {
            return response()->json(['message' => 'This announcement has changed since you opened it. Reload to see where it stands.'], 409);
        }
        $this->log($request, $action, $done);

        return response()->json(['data' => $this->present($done->fresh('createdBy'))]);
    }

    private function log(Request $request, string $action, Announcement $a): void
    {
        /** @var User $me */
        $me = $request->user();
        $this->audit->log($action, 'announcements', $a->announcement_id, $me, ['title' => $a->title, 'status' => $this->status($a)]);
    }

    /** Draft, Scheduled, Published, or Archived, as staff see it. */
    private function status(Announcement $a): string
    {
        $status = $a->status instanceof AnnouncementStatus ? $a->status : AnnouncementStatus::from((string) $a->status);

        return $status === AnnouncementStatus::Published && $a->published_at?->isFuture() ? 'Scheduled' : $status->value;
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Announcement $a): array
    {
        return [
            'id' => $a->announcement_id,
            'title' => $a->title,
            'category' => $a->category,
            'status' => $this->status($a),
            'body' => $a->content_markdown,
            'pinned' => $a->is_pinned,
            'publish_at' => $a->published_at?->toIso8601String(),
            'author' => DisplayName::of($a->createdBy) ?? 'Parish Office',
            'updated_at' => ($a->updated_at ?? $a->created_at)?->toIso8601String(),
        ];
    }
}

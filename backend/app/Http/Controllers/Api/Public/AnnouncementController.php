<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\AnnouncementStatus;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Support\SafeHtml;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;

/**
 * Parish announcements on the public home page: published posts whose
 * publish time has come, the pinned one first, then newest first.
 */
class AnnouncementController extends Controller
{
    private const LIMIT = 20;

    #[OA\Get(
        path: '/api/public/announcements',
        summary: 'Published parish announcements, pinned first, then newest',
        tags: ['Public'],
        responses: [new OA\Response(response: 200, description: 'Announcements')],
    )]
    public function index(): JsonResponse
    {
        $posts = Announcement::query()
            ->where('status', AnnouncementStatus::Published->value)
            ->where('published_at', '<=', now())
            ->orderByDesc('is_pinned')
            ->orderByDesc('published_at')
            ->limit(self::LIMIT)
            ->get();

        return response()->json(['data' => $posts->map(fn (Announcement $a) => [
            'id' => $a->announcement_id,
            'title' => $a->title,
            'excerpt' => self::excerpt($a->content_markdown),
            'category' => $a->category,
            'published_at' => $a->published_at->toIso8601String(),
            'pinned' => $a->is_pinned,
        ])->values()]);
    }

    /** Plain text for the card: the body without markup, cut at a word near 280 characters. */
    public static function excerpt(string $body): string
    {
        $text = SafeHtml::text($body);
        if (mb_strlen($text) <= 280) {
            return $text;
        }

        return rtrim(Str::beforeLast(mb_substr($text, 0, 280), ' '), ' ,.;:').'…';
    }
}

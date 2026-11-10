<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationChannel;
use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Date;
use OpenApi\Attributes as OA;

/**
 * The header bell: the signed-in person's own in-app notices. A notice dated
 * ahead (a scheduled announcement going live) shows once its time comes.
 */
class NotificationController extends Controller
{
    private const LIMIT = 30;

    #[OA\Get(path: '/api/notifications', summary: 'My latest notices and how many are unread', tags: ['Notifications'], responses: [new OA\Response(response: 200, description: 'Notices')])]
    public function index(Request $request): JsonResponse
    {
        /** @var User $me */
        $me = $request->user();
        $notices = $this->mine($me)->orderByDesc('created_at')->limit(self::LIMIT)->get();

        return response()->json([
            'data' => $notices->map(fn (Notification $n) => [
                'id' => $n->notification_id,
                'kind' => $n->kind,
                'message' => $n->message,
                'link' => $n->link,
                'read' => $n->is_read,
                'created_at' => $n->created_at->toIso8601String(),
            ])->values(),
            'unread' => $this->mine($me)->where('is_read', false)->count(),
        ]);
    }

    #[OA\Post(path: '/api/notifications/{notification}/read', summary: 'Mark one notice read', tags: ['Notifications'], responses: [new OA\Response(response: 204, description: 'Read')])]
    public function read(Request $request, string $notification): Response
    {
        /** @var User $me */
        $me = $request->user();
        $this->mine($me)->whereKey($notification)->update(['is_read' => true]);

        return response()->noContent();
    }

    #[OA\Post(path: '/api/notifications/read-all', summary: 'Mark every notice read', tags: ['Notifications'], responses: [new OA\Response(response: 204, description: 'Read')])]
    public function readAll(Request $request): Response
    {
        /** @var User $me */
        $me = $request->user();
        $this->mine($me)->where('is_read', false)->update(['is_read' => true]);

        return response()->noContent();
    }

    /**
     * @return Builder<Notification>
     */
    private function mine(User $me): Builder
    {
        return Notification::query()
            ->where('user_id', $me->user_id)
            ->where('channel', NotificationChannel::InApp->value)
            ->where('created_at', '<=', Date::now());
    }
}

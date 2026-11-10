<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuthUserResource;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The signed-in user's own profile: name and profile picture. Email and
 * username stay with the System Administrator, since they are how people sign in.
 */
class ProfileController extends Controller
{
    /** Photos live on the private local disk and are served through photo() below. */
    public const PHOTO_DIRECTORY = 'profile-photos';

    public function __construct(private AuditLogger $audit) {}

    #[OA\Patch(
        path: '/api/auth/profile',
        summary: 'Update your own first and last name',
        tags: ['Authentication'],
        responses: [new OA\Response(response: 200, description: 'The updated user'), new OA\Response(response: 422, description: 'Invalid input')],
    )]
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
        ], [
            'first_name.required' => 'Enter your first name.',
            'last_name.required' => 'Enter your last name.',
        ]);

        /** @var User $user */
        $user = $request->user();
        $before = $user->only(['first_name', 'last_name']);
        $user->fill($validated)->save();

        if ($user->wasChanged()) {
            $this->audit->log('PROFILE_UPDATED', 'users', $user->user_id, $user, [
                'before' => $before,
                'after' => $user->only(['first_name', 'last_name']),
            ]);
        }

        return response()->json(['user' => new AuthUserResource($user->load('role'))]);
    }

    #[OA\Post(
        path: '/api/auth/profile/photo',
        summary: 'Upload or replace your profile picture (JPG, PNG, or WebP up to 2 MB)',
        tags: ['Authentication'],
        responses: [new OA\Response(response: 200, description: 'The updated user'), new OA\Response(response: 422, description: 'Not an image, or too large')],
    )]
    public function storePhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:min_width=64,min_height=64,max_width=6000,max_height=6000'],
        ], [
            'photo.required' => 'Choose a picture to upload.',
            'photo.mimes' => 'Upload a JPG, PNG, or WebP picture.',
            'photo.max' => 'The picture is too large. The limit is 2 MB.',
            'photo.dimensions' => 'Use a picture at least 64 by 64 pixels.',
        ]);

        /** @var User $user */
        $user = $request->user();
        $file = $request->file('photo');
        $ext = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension());
        $path = $file->storeAs(self::PHOTO_DIRECTORY, Str::random(40).'.'.$ext, ['disk' => 'local']);

        $old = $user->photo_path;
        $user->forceFill(['photo_path' => $path])->save();
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        $this->audit->log('PROFILE_PHOTO_UPDATED', 'users', $user->user_id, $user);

        return response()->json(['user' => new AuthUserResource($user->load('role'))]);
    }

    #[OA\Delete(
        path: '/api/auth/profile/photo',
        summary: 'Remove your profile picture',
        tags: ['Authentication'],
        responses: [new OA\Response(response: 200, description: 'The updated user')],
    )]
    public function destroyPhoto(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->photo_path) {
            Storage::disk('local')->delete($user->photo_path);
            $user->forceFill(['photo_path' => null])->save();
            $this->audit->log('PROFILE_PHOTO_REMOVED', 'users', $user->user_id, $user);
        }

        return response()->json(['user' => new AuthUserResource($user->load('role'))]);
    }

    /**
     * Serves a profile picture. The 40-character random file name is the only
     * key, so it works in a plain <img> tag without a session.
     */
    public function photo(string $file): StreamedResponse
    {
        $path = self::PHOTO_DIRECTORY.'/'.$file;
        $disk = Storage::disk('local');
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}

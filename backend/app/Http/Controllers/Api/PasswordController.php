<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use OpenApi\Attributes as OA;

/**
 * Changing your own password while signed in, for any role. (A forgotten
 * password goes through /api/auth/forgot-password instead.)
 */
class PasswordController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    #[OA\Put(
        path: '/api/auth/password',
        summary: 'Change your password; other devices are signed out',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['current_password', 'password', 'password_confirmation'],
            properties: [
                new OA\Property(property: 'current_password', type: 'string', format: 'password'),
                new OA\Property(property: 'password', type: 'string', format: 'password'),
                new OA\Property(property: 'password_confirmation', type: 'string', format: 'password'),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Changed'),
            new OA\Response(response: 422, description: 'Wrong current password, or the new one is too weak or unchanged'),
        ],
    )]
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', PasswordRule::min(8)->letters()->numbers()],
        ], [
            'current_password.current_password' => 'That isn’t your current password.',
            'password.different' => 'Choose a password different from your current one.',
        ]);

        $user = $request->user();
        $user->forceFill(['password_hash' => $request->string('password')->value()])->setRememberToken(Str::random(60));
        $user->save();

        // Keep this session; end the others, which were opened with the old password.
        DB::table('sessions')
            ->where('user_id', $user->user_id)
            ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
            ->delete();

        $this->audit->log('PASSWORD_CHANGED', 'users', $user->user_id, $user);

        return response()->json(['message' => 'Your password has been changed. Other devices were signed out.']);
    }
}

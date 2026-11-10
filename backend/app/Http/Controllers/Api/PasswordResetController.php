<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\SetPasswordNotification;
use App\Services\AuditLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;
use Throwable;

/**
 * "Forgot password?" on the sign-in page, and the emailed set/reset link that
 * both it and User Management send.
 */
class PasswordResetController extends Controller
{
    public const FORGOT_MESSAGE = 'If an account uses that email, we sent it a link to choose a new password. Check your inbox and spam folder.';

    public function __construct(private AuditLogger $audit) {}

    #[OA\Post(
        path: '/api/auth/forgot-password',
        summary: 'Email a link to choose a new password',
        description: 'Always answers the same way, whether or not the email has an account, so it cannot be used to find out who has one.',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['email'],
            properties: [new OA\Property(property: 'email', type: 'string', format: 'email')],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Request received'),
            new OA\Response(response: 429, description: 'Too many requests'),
        ],
    )]
    public function forgot(Request $request): JsonResponse
    {
        $email = $request->validate(['email' => ['required', 'email', 'max:150']])['email'];

        /** @var User|null $user */
        $user = User::whereRaw('LOWER(email) = LOWER(?)', [trim($email)])->first();
        $tokens = Password::broker()->getRepository();

        // Deactivated accounts get nothing; a link sent in the last minute isn't sent again.
        if ($user?->is_active && ! $tokens->recentlyCreatedToken($user)) {
            try {
                $user->notify(new SetPasswordNotification($tokens->create($user)));
            } catch (Throwable $e) {
                // The answer stays the same either way; the failure is in the log for whoever runs the server.
                report($e);
            }
        }

        $this->audit->log('PASSWORD_RESET_REQUESTED', 'users', $user?->user_id ?? 'unknown', null, [
            'email' => $email,
            ...($user && ! $user->is_active ? ['note' => 'Account is deactivated; no link sent.'] : []),
        ]);

        return response()->json(['message' => self::FORGOT_MESSAGE]);
    }

    #[OA\Post(
        path: '/api/auth/reset-password',
        summary: 'Choose a new password with the token from the emailed link',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['token', 'email', 'password', 'password_confirmation'],
            properties: [
                new OA\Property(property: 'token', type: 'string'),
                new OA\Property(property: 'email', type: 'string', format: 'email'),
                new OA\Property(property: 'password', type: 'string', format: 'password'),
                new OA\Property(property: 'password_confirmation', type: 'string', format: 'password'),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Password changed; the user can now sign in'),
            new OA\Response(response: 422, description: 'Weak password, or the link is invalid or expired'),
            new OA\Response(response: 429, description: 'Too many attempts'),
        ],
    )]
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password_hash' => $password])->setRememberToken(Str::random(60));
                $user->save();

                // Any session opened with the old password ends now.
                DB::table('sessions')->where('user_id', $user->user_id)->delete();

                event(new PasswordReset($user));
                $this->audit->log('PASSWORD_RESET', 'users', $user->user_id, $user);
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            // Same message for an unknown email and a bad token, so the form can't be used to probe for accounts.
            throw ValidationException::withMessages([
                'token' => 'This link is invalid or has expired. Use “Forgot password?” on the sign-in page to get a new one.',
            ]);
        }

        return response()->json(['message' => 'Your password has been set. You can now sign in.']);
    }
}

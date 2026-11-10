<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\AuthUserResource;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\SecurityAlerts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class AuthController extends Controller
{
    public function __construct(private AuditLogger $audit, private SecurityAlerts $alerts) {}

    #[OA\Post(
        path: '/api/auth/login',
        summary: 'Sign in with username or email',
        description: 'Session-cookie login for the SPA. Call GET /sanctum/csrf-cookie first and send the X-XSRF-TOKEN header.',
        tags: ['Authentication'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['login', 'password'],
            properties: [
                new OA\Property(property: 'login', type: 'string', example: 'jdelacruz'),
                new OA\Property(property: 'password', type: 'string', format: 'password'),
                new OA\Property(property: 'remember', type: 'boolean', example: false),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Signed in; returns the user, role, and dashboard path'),
            new OA\Response(response: 403, description: 'Account is deactivated'),
            new OA\Response(response: 422, description: 'Invalid credentials or input'),
            new OA\Response(response: 429, description: 'Too many attempts'),
        ],
    )]
    public function login(LoginRequest $request): JsonResponse
    {
        $request->ensureIsNotRateLimited();

        $login = $request->string('login')->trim()->value();
        $credentials = [
            fn ($query) => $query->whereRaw('LOWER(email) = LOWER(?)', [$login])
                ->orWhereRaw('LOWER(username) = LOWER(?)', [$login]),
            'password' => $request->string('password')->value(),
        ];

        if (! Auth::guard('web')->validate($credentials)) {
            $request->hitRateLimiter();

            /** @var User|null $attempted */
            $attempted = Auth::guard('web')->getLastAttempted();
            $this->audit->log('LOGIN_FAILED', 'users', $attempted?->user_id ?? 'unknown', $attempted, [
                'login' => $login,
            ]);

            // The attempt that triggers the lockout raises one alert; later ones are blocked before reaching here.
            if ($request->attempts() >= LoginRequest::MAX_ATTEMPTS) {
                $this->alerts->repeatedFailedSignIns($login, $request->ip() ?? 'unknown', $request->attempts(), $attempted);
            }

            throw ValidationException::withMessages(['login' => trans('auth.failed')]);
        }

        /** @var User $user */
        $user = Auth::guard('web')->getLastAttempted();
        $request->clearRateLimiter();

        if (! $user->is_active) {
            $this->audit->log('LOGIN_BLOCKED_INACTIVE', 'users', $user->user_id, $user);

            return response()->json(['message' => 'This account has been deactivated.'], 403);
        }

        Auth::getProvider()->rehashPasswordIfRequired($user, $credentials);
        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        // last_login is not a profile change, so leave updated_at alone.
        $user->timestamps = false;
        $user->forceFill(['last_login' => now()])->save();
        $user->timestamps = true;

        // Before the LOGIN entry is written, so this sign-in's address doesn't count as already seen.
        $this->alerts->checkNewAddress($user, $request->ip() ?? 'unknown');
        $this->audit->log('LOGIN', 'users', $user->user_id, $user);

        return response()->json(['user' => new AuthUserResource($user->load('role'))]);
    }

    #[OA\Post(
        path: '/api/auth/logout',
        summary: 'Sign out and end the session',
        tags: ['Authentication'],
        responses: [
            new OA\Response(response: 204, description: 'Signed out'),
            new OA\Response(response: 401, description: 'Not signed in'),
        ],
    )]
    public function logout(Request $request): Response
    {
        $user = $request->user();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $this->audit->log('LOGOUT', 'users', $user->user_id, $user);

        return response()->noContent();
    }

    #[OA\Get(
        path: '/api/auth/me',
        summary: 'The signed-in user, role, and dashboard path',
        tags: ['Authentication'],
        responses: [
            new OA\Response(response: 200, description: 'Current user'),
            new OA\Response(response: 401, description: 'Not signed in'),
            new OA\Response(response: 403, description: 'Account is deactivated'),
        ],
    )]
    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => new AuthUserResource($request->user()->load('role'))]);
    }
}

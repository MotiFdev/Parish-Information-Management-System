<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UserRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\Role;
use App\Models\User;
use App\Notifications\SetPasswordNotification;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;
use Throwable;

class UserController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/admin/users',
        summary: 'List accounts with search, role filter, and paging',
        tags: ['Admin: Users'],
        parameters: [
            new OA\Parameter(name: 'search', in: 'query', description: 'Matches name, username, or email', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'role', in: 'query', schema: new OA\Schema(type: 'string', enum: ['admin', 'priest', 'secretary', 'gkk', 'pya-kkk', 'ppc'])),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'A page of accounts, plus per-role counts for the current search and overall totals'),
            new OA\Response(response: 403, description: 'Not a System Administrator'),
        ],
    )]
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', Rule::in(self::roleSlugs())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $searched = self::withCurrentRole()->when(
            filled($validated['search'] ?? null),
            fn (Builder $q) => $this->applySearch($q, $validated['search']),
        );

        // Counts follow the search but not the role filter, so each role option can say what choosing it would show.
        $byRole = (clone $searched)
            ->join('roles', 'roles.role_id', '=', 'users.role_id')
            ->groupBy('roles.role_name')
            ->selectRaw('roles.role_name, count(*) as total')
            ->pluck('total', 'role_name');
        $counts = ['all' => (int) $byRole->sum()];
        foreach (UserRole::cases() as $role) {
            $counts[$role->slug()] = (int) ($byRole[$role->value] ?? 0);
        }

        $page = $searched
            ->with('role')
            ->when($validated['role'] ?? null, fn (Builder $q, string $slug) => $q->whereHas(
                'role',
                fn (Builder $r) => $r->where('role_name', UserRole::fromSlug($slug)->value),
            ))
            ->orderByRaw('last_name IS NULL, LOWER(last_name), LOWER(first_name), LOWER(username)')
            ->paginate($validated['per_page'] ?? 10)
            ->withQueryString();

        return AdminUserResource::collection($page)->additional([
            'counts' => $counts,
            'summary' => [
                'total' => self::withCurrentRole()->count(),
                'deactivated' => self::withCurrentRole()->where('is_active', false)->count(),
            ],
        ]);
    }

    #[OA\Post(
        path: '/api/admin/users',
        summary: 'Create an account and email a link to set its password',
        tags: ['Admin: Users'],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            required: ['first_name', 'last_name', 'username', 'email', 'role'],
            properties: [
                new OA\Property(property: 'first_name', type: 'string', example: 'Liza'),
                new OA\Property(property: 'last_name', type: 'string', example: 'Mercado'),
                new OA\Property(property: 'username', type: 'string', example: 'l.mercado'),
                new OA\Property(property: 'email', type: 'string', format: 'email'),
                new OA\Property(property: 'role', type: 'string', enum: ['admin', 'priest', 'secretary', 'gkk', 'pya-kkk', 'ppc']),
            ],
        )),
        responses: [
            new OA\Response(response: 201, description: 'Created; invite_sent says whether the email went out'),
            new OA\Response(response: 422, description: 'Invalid input or username/email taken'),
        ],
    )]
    public function store(UserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'role_id' => self::roleId($data['role']),
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'username' => $data['username'],
            'email' => $data['email'],
            // Nobody knows this password; the person sets their own from the emailed link.
            'password_hash' => Str::random(64),
            'is_active' => true,
        ]);

        $this->audit->log('USER_CREATED', 'users', $user->user_id, $request->user(), [
            'username' => $user->username,
            'email' => $user->email,
            'role' => $data['role'],
        ]);

        $sent = $this->sendPasswordLink($user, newAccount: true);

        return (new AdminUserResource($user->load('role')))
            ->additional(['invite_sent' => $sent])
            ->response()
            ->setStatusCode(201);
    }

    #[OA\Patch(
        path: '/api/admin/users/{user}',
        summary: 'Edit an account; send only the fields that changed',
        tags: ['Admin: Users'],
        parameters: [new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))],
        responses: [
            new OA\Response(response: 200, description: 'Updated account'),
            new OA\Response(response: 422, description: 'Invalid input, a taken username/email, or changing your own role'),
        ],
    )]
    public function update(UserRequest $request, User $user): AdminUserResource
    {
        $data = $request->validated();

        if (isset($data['role']) && $request->user()->is($user) && $data['role'] !== $user->roleType()?->slug()) {
            throw ValidationException::withMessages(['role' => 'You can’t change your own role. Another administrator can.']);
        }

        $roleBefore = $user->roleType()?->value;
        $user->fill(collect($data)->except('role')->all());
        if (isset($data['role'])) {
            $user->role_id = self::roleId($data['role']);
        }

        // Before/after for each changed field, in the shape the Audit Logs page shows.
        $changes = [];
        foreach (array_keys(collect($user->getDirty())->except(['updated_at'])->all()) as $field) {
            $changes[$field === 'role_id' ? 'role' : $field] = $field === 'role_id'
                ? [$roleBefore, UserRole::fromSlug($data['role'])->value]
                : [$user->getOriginal($field), $user->getAttribute($field)];
        }

        if ($changes) {
            $user->save();
            $this->audit->log('USER_UPDATED', 'users', $user->user_id, $request->user(), ['changes' => $changes]);
        }

        return new AdminUserResource($user->load('role'));
    }

    #[OA\Post(
        path: '/api/admin/users/{user}/password-reset',
        summary: 'Email the account a link to choose a new password',
        tags: ['Admin: Users'],
        parameters: [new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))],
        responses: [
            new OA\Response(response: 200, description: 'Email sent'),
            new OA\Response(response: 503, description: 'The mail server could not be reached'),
        ],
    )]
    public function sendPasswordReset(Request $request, User $user): JsonResponse
    {
        if (! $this->sendPasswordLink($user, newAccount: false)) {
            return response()->json(['message' => 'The email could not be sent. Check the mail settings and try again.'], 503);
        }

        $this->audit->log('PASSWORD_RESET_SENT', 'users', $user->user_id, $request->user(), ['email' => $user->email]);

        return response()->json(['message' => "A reset link was sent to {$user->email}."]);
    }

    #[OA\Post(
        path: '/api/admin/users/{user}/deactivate',
        summary: 'Stop an account from signing in and end its sessions',
        tags: ['Admin: Users'],
        parameters: [new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))],
        responses: [
            new OA\Response(response: 200, description: 'Deactivated'),
            new OA\Response(response: 422, description: 'You cannot deactivate your own account'),
        ],
    )]
    public function deactivate(Request $request, User $user): AdminUserResource
    {
        if ($request->user()->is($user)) {
            throw ValidationException::withMessages(['user' => 'You can’t deactivate your own account.']);
        }

        if ($user->is_active) {
            $user->forceFill(['is_active' => false])->save();
            // Sign them out everywhere now, not on their next request.
            DB::table('sessions')->where('user_id', $user->user_id)->delete();
            $this->audit->log('USER_DEACTIVATED', 'users', $user->user_id, $request->user());
        }

        return new AdminUserResource($user->load('role'));
    }

    #[OA\Post(
        path: '/api/admin/users/{user}/activate',
        summary: 'Let a deactivated account sign in again',
        tags: ['Admin: Users'],
        parameters: [new OA\Parameter(name: 'user', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))],
        responses: [new OA\Response(response: 200, description: 'Reactivated'), new OA\Response(response: 422, description: 'A retired parishioner account, whose role no longer exists')],
    )]
    public function activate(Request $request, User $user): AdminUserResource
    {
        if ($user->roleType() === null) {
            throw ValidationException::withMessages(['user' => 'This was a parishioner account. Parishioners no longer sign in, so it can’t be reactivated.']);
        }

        if (! $user->is_active) {
            $user->forceFill(['is_active' => true])->save();
            $this->audit->log('USER_ACTIVATED', 'users', $user->user_id, $request->user());
        }

        return new AdminUserResource($user->load('role'));
    }

    /** Emails a set-password link. Returns false if the mail server failed, so the caller can say so. */
    private function sendPasswordLink(User $user, bool $newAccount): bool
    {
        try {
            $token = Password::broker()->createToken($user);
            $user->notify(new SetPasswordNotification($token, $newAccount));

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    private function applySearch(Builder $query, string $search): void
    {
        $like = '%'.addcslashes($search, '%_\\').'%';

        $query->where(fn (Builder $q) => $q
            ->whereRaw("CONCAT_WS(' ', first_name, last_name) ILIKE ?", [$like])
            ->orWhere('username', 'ILIKE', $like)
            ->orWhere('email', 'ILIKE', $like));
    }

    /**
     * @return list<string>
     */
    /**
     * Accounts whose role still exists. Parishioner accounts were retired when
     * parishioners stopped signing in; they stay in the table for the audit
     * log but not in User Management.
     *
     * @return Builder<User>
     */
    private static function withCurrentRole(): Builder
    {
        return User::query()->whereHas('role', fn (Builder $r) => $r->whereIn('role_name', array_map(fn (UserRole $role) => $role->value, UserRole::cases())));
    }

    private static function roleSlugs(): array
    {
        return array_map(fn (UserRole $r) => $r->slug(), UserRole::cases());
    }

    private static function roleId(string $slug): int
    {
        return Role::where('role_name', UserRole::fromSlug($slug)->value)->value('role_id');
    }
}

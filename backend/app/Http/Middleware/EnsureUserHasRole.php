<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Usage: ->middleware('role:admin') or ->middleware('role:priest,staff').
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roleSlugs): Response
    {
        $allowed = array_map(UserRole::fromSlug(...), $roleSlugs);

        if (! $request->user()?->hasRole(...$allowed)) {
            abort(403, 'You do not have access to this resource.');
        }

        return $next($request);
    }
}

<?php

use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\Response;

/*
 * In production the React build is copied into public/ (see docker/Dockerfile).
 * Any URL that is not an API route or a real file gets the React app, and the
 * frontend router shows the right page. Without a build (local dev) it falls
 * back to the welcome page.
 */
Route::fallback(function (): Response|View {
    if (request()->is('api/*', 'sanctum/*')) {
        abort(404);
    }

    $spa = public_path('index.html');

    if (! file_exists($spa)) {
        return view('welcome');
    }

    return response()->file($spa, ['Cache-Control' => 'no-cache']);
});

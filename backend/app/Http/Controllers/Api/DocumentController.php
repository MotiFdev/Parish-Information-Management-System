<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\RecordRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Uploaded documents are private. Signed-in users who may see one get a link
 * that works for a few minutes; the file itself is served only on that link.
 */
class DocumentController extends Controller
{
    #[OA\Get(
        path: '/api/documents/{document}/link',
        summary: 'A short-lived link to view an uploaded document',
        description: 'Only staff and the priest can open request documents.',
        tags: ['Documents'],
        responses: [new OA\Response(response: 200, description: 'url and expires_at'), new OA\Response(response: 404, description: 'Not found or not allowed')],
    )]
    public function link(Request $request, Document $document): JsonResponse
    {
        abort_unless($request->user()->hasRole(UserRole::ParishStaff, UserRole::ParishPriest), 404);

        $minutes = max(1, (int) config('record_requests.link_minutes'));

        return response()->json([
            'url' => RecordRequests::link($document),
            'file_name' => $document->file_name,
            'file_type' => $document->file_type,
            'expires_at' => now()->addMinutes($minutes)->toIso8601String(),
        ]);
    }

    /** Reached only through a signed link; the 'signed' middleware rejects expired or altered ones. */
    public function file(Document $document): StreamedResponse
    {
        $disk = Storage::disk(RecordRequests::disk());
        abort_unless($disk->exists($document->file_path), 404);

        return $disk->response($document->file_path, $document->file_name, [
            'Content-Type' => $document->file_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}

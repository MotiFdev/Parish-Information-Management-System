<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sona;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

/**
 * The parish's Sonas and active chapels. Public: sign-up, the profile page,
 * and the Chapels page all need the list, and none of it is personal.
 */
class SonaController extends Controller
{
    #[OA\Get(
        path: '/api/sonas',
        summary: 'Sonas with their active chapels',
        tags: ['Parish'],
        responses: [new OA\Response(response: 200, description: 'Sonas in name order, each with its chapels')],
    )]
    public function index(): JsonResponse
    {
        $sonas = Sona::query()
            // Chapels still waiting for the PPC, or rejected, are not offered to the public.
            ->with(['chapels' => fn ($q) => $q->where('is_active', true)->approved()->orderBy('name')])
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $sonas->map(fn (Sona $s) => [
            'sona_id' => $s->sona_id,
            'name' => $s->name,
            'chapels' => $s->chapels->map(fn ($c) => ['chapel_id' => $c->chapel_id, 'name' => $c->name])->values(),
        ])]);
    }
}

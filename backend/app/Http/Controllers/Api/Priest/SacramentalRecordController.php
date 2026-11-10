<?php

namespace App\Http\Controllers\Api\Priest;

use App\Http\Controllers\Controller;
use App\Services\SacramentalRegister;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use OpenApi\Attributes as OA;

/**
 * Sacramental Review in the priest portal: the four registers, read-only.
 * Changes go through a correction that staff file and the priest approves.
 */
class SacramentalRecordController extends Controller
{
    public function __construct(private SacramentalRegister $register) {}

    #[OA\Get(
        path: '/api/priest/sacramental-records',
        summary: 'One register (?type=Baptism|Confirmation|Marriage|Burial), newest first, with the entry count of each register',
        tags: ['Priest'],
        responses: [new OA\Response(response: 200, description: 'data (entries) and counts')],
    )]
    public function index(Request $request): JsonResponse
    {
        $type = $request->validate(['type' => ['required', Rule::in(SacramentalRegister::TYPES)]])['type'];

        return response()->json($this->register->listing($type));
    }
}

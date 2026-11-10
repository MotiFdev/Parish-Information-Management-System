<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ParishSetting;
use Illuminate\Http\JsonResponse;
use OpenApi\Attributes as OA;

/**
 * Parish details the office keeps up to date from staff Settings.
 */
class ParishController extends Controller
{
    #[OA\Get(path: '/api/public/parish', summary: 'Office hours', tags: ['Public'], responses: [new OA\Response(response: 200, description: 'Parish details')])]
    public function show(): JsonResponse
    {
        return response()->json(['office_hours' => ParishSetting::value('office_hours')]);
    }
}

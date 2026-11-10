<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use OpenApi\Attributes as OA;

class TestController extends Controller
{
    #[OA\Get(
        path: '/api/test',
        summary: 'Test the Parish API',
        tags: ['Testing'],
        responses: [
            new OA\Response(
                response: 200,
                description: 'API is working'
            ),
        ]
    )]
    public function index()
    {
        return response()->json([
            'success' => true,
            'message' => 'Parish Information Management System API is working!',
        ]);
    }
}

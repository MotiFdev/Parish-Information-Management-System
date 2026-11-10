<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Services\ParishAssistant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use OpenApi\Attributes as OA;
use RuntimeException;

/**
 * Parish Inquiries: the "Ask the parish" chat on the public site. Nothing is
 * stored; the browser sends the conversation so far with each question.
 */
class InquiryController extends Controller
{
    #[OA\Post(
        path: '/api/public/inquiries',
        summary: 'Ask the parish assistant a question',
        tags: ['Public'],
        responses: [
            new OA\Response(response: 200, description: 'The answer'),
            new OA\Response(response: 503, description: 'The assistant is unavailable'),
        ],
    )]
    public function ask(Request $request, ParishAssistant $assistant): JsonResponse
    {
        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.from' => ['required', 'in:user,parish'],
            'messages.*.text' => ['required', 'string', 'max:2000'],
        ]);
        $messages = array_values(array_map(fn (array $m) => ['from' => $m['from'], 'text' => trim($m['text'])], $data['messages']));

        if (end($messages)['from'] !== 'user') {
            return response()->json(['message' => 'The last message must be the question.'], 422);
        }
        // Gemini expects the conversation to start with the user.
        while ($messages[0]['from'] !== 'user') {
            array_shift($messages);
        }

        try {
            return response()->json(['reply' => $assistant->reply($messages)]);
        } catch (RuntimeException $e) {
            Log::warning('Parish Inquiries failed: '.$e->getMessage());

            return response()->json(['message' => 'The parish assistant is unavailable right now.'], 503);
        }
    }
}

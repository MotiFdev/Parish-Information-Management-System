<?php

namespace Tests\Feature\Public;

use App\Enums\UserRole;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InquiryTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.gemini.key' => 'test-key', 'services.gemini.chat_model' => 'gemini-test']);
    }

    public function test_questions_are_answered_by_gemini_with_parish_information(): void
    {
        Announcement::query()->create([
            'title' => 'Baptism seminar moved', 'content_markdown' => '<p>The seminar is now on Saturday.</p>', 'status' => 'Published',
            'published_at' => now()->subDay(), 'created_by_user_id' => User::factory()->role(UserRole::ParishStaff)->create()->user_id,
        ]);
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [['content' => ['parts' => [['text' => 'Sunday Masses are at 5:30 AM and 7:00 AM.']]]]],
        ])]);

        $this->postJson('/api/public/inquiries', ['messages' => [
            ['from' => 'parish', 'text' => 'Hello!'],
            ['from' => 'user', 'text' => 'What time is Mass?'],
            ['from' => 'parish', 'text' => 'Which day?'],
            ['from' => 'user', 'text' => 'Sunday'],
        ]])->assertOk()->assertJsonPath('reply', 'Sunday Masses are at 5:30 AM and 7:00 AM.');

        Http::assertSent(function (HttpRequest $request) {
            $system = $request['systemInstruction']['parts'][0]['text'];

            return str_ends_with($request->url(), '/models/gemini-test:generateContent')
                && $request->header('x-goog-api-key') === ['test-key']
                && str_contains($system, 'Baptism seminar moved')
                && str_contains($system, 'Monday to Saturday, 8:00 AM to 5:00 PM')
                // The conversation starts with the parishioner, in Gemini's roles.
                && array_column($request['contents'], 'role') === ['user', 'model', 'user'];
        });
    }

    public function test_the_chat_says_it_is_unavailable_when_gemini_fails(): void
    {
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(['error' => ['message' => 'quota']], 429)]);

        $this->postJson('/api/public/inquiries', ['messages' => [['from' => 'user', 'text' => 'Hi']]])->assertStatus(503);

        config(['services.gemini.key' => null]);
        $this->postJson('/api/public/inquiries', ['messages' => [['from' => 'user', 'text' => 'Hi']]])->assertStatus(503);
    }

    public function test_the_last_message_must_be_a_question(): void
    {
        Http::fake();

        $this->postJson('/api/public/inquiries', ['messages' => [['from' => 'parish', 'text' => 'Hello!']]])->assertStatus(422);
        $this->postJson('/api/public/inquiries', ['messages' => []])->assertStatus(422);

        Http::assertNothingSent();
    }
}

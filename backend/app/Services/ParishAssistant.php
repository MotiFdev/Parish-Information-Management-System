<?php

namespace App\Services;

use App\Enums\AnnouncementStatus;
use App\Enums\ApprovalStatus;
use App\Models\Announcement;
use App\Models\CommunityEvent;
use App\Models\ParishSetting;
use App\Support\SafeHtml;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Parish Inquiries on the public site: answers parishioners' questions with
 * Gemini, grounded in what the parish publishes (office hours, Mass times,
 * announcements, approved events) and how the site's request flows work.
 */
class ParishAssistant
{
    /** The regular Mass schedule at the parish church, as the public site shows it. */
    private const MASS_SCHEDULE = [
        'Sunday: 5:30 AM, 7:00 AM, 9:00 AM, 4:30 PM, 6:00 PM',
        'Saturday: 6:00 AM, 5:30 PM (5:30 PM is the anticipated Sunday Mass)',
        'Monday to Friday: 6:00 AM, 5:30 PM',
    ];

    public function configured(): bool
    {
        return filled(config('services.gemini.key'));
    }

    /**
     * @param  list<array{from: 'user'|'parish', text: string}>  $messages  the conversation so far, ending with the parishioner's question
     *
     * @throws RuntimeException when the key is missing or Gemini gives no answer
     */
    public function reply(array $messages): string
    {
        if (! $this->configured()) {
            throw new RuntimeException('Parish Inquiries is not set up: GEMINI_API_KEY is missing.');
        }
        $model = 'models/'.config('services.gemini.chat_model');

        try {
            $response = Http::baseUrl((string) config('services.gemini.url'))
                ->withHeaders(['x-goog-api-key' => (string) config('services.gemini.key')])
                ->acceptJson()->timeout(30)->retry(2, 500, throw: false)
                ->post("/{$model}:generateContent", [
                    'systemInstruction' => ['parts' => [['text' => $this->instructions()]]],
                    'contents' => array_map(fn (array $m) => [
                        'role' => $m['from'] === 'user' ? 'user' : 'model',
                        'parts' => [['text' => $m['text']]],
                    ], $messages),
                    'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 1024],
                ]);
        } catch (ConnectionException) {
            throw new RuntimeException('The parish assistant could not be reached.');
        }

        $parts = $response->successful() ? $response->json('candidates.0.content.parts') : null;
        $text = is_array($parts) ? trim(implode('', array_column($parts, 'text'))) : '';
        if ($text === '') {
            throw new RuntimeException($this->failure($response));
        }

        return $text;
    }

    private function instructions(): string
    {
        $tz = (string) config('app.parish_timezone', 'Asia/Manila');
        $today = now($tz);
        $officeHours = ParishSetting::value('office_hours');
        $mass = implode("\n", array_map(fn ($l) => "- {$l}", self::MASS_SCHEDULE));

        $announcements = Announcement::query()
            ->where('status', AnnouncementStatus::Published->value)
            ->where('published_at', '<=', now())
            ->orderByDesc('is_pinned')->orderByDesc('published_at')
            ->limit(8)->get()
            ->map(fn (Announcement $a) => '- '.$a->published_at->setTimezone($tz)->toFormattedDateString().": {$a->title}. "
                .mb_strimwidth(SafeHtml::text($a->content_markdown), 0, 600, '…'))
            ->implode("\n") ?: '- None right now.';

        $events = CommunityEvent::query()
            ->where('status', ApprovalStatus::Approved->value)
            ->whereDate('event_date', '>=', $today->toDateString())
            ->orderBy('event_date')->orderBy('start_time')
            ->limit(15)->get(['name', 'venue', 'event_date', 'start_time'])
            ->map(fn (CommunityEvent $e) => '- '.$e->event_date->toFormattedDateString().' at '.substr((string) $e->start_time, 0, 5)
                ." — {$e->name} ({$e->venue})")
            ->implode("\n") ?: '- None scheduled.';

        return <<<TEXT
        You are Parish Inquiries, the assistant on the parish's public website. You help parishioners with Mass schedules,
        sacramental certificate requirements, appointments, office hours, announcements, and how to use this website.

        Rules:
        - Answer only from the parish information below and general Catholic parish practice. If you don't know a parish-specific
          detail (fees, a priest's availability, a chapel's Mass times), say so and suggest visiting or calling the parish office.
        - Never make up dates, times, fees, names, or reference numbers.
        - You cannot see anyone's requests or records. For the status of a request, point them to Track Request.
        - Keep answers short and friendly: a few sentences or a short list. Use plain text with "•" bullets; no Markdown headings, bold, or tables.
        - Reply in the language the parishioner uses (English, Filipino, or Cebuano/Bisaya).
        - Politely decline questions unrelated to the parish or the Church.

        Today is {$today->format('l, F j, Y')}.

        Parish office hours: {$officeHours}. Bring a valid ID when collecting a certificate marked Ready for Collection.

        Regular Mass schedule at the parish church:
        {$mass}
        Chapel Mass times vary by Sona; parishioners should check the announcements for their chapel.

        How the website works:
        - Record Requests → New Request: request a Baptism, Confirmation, Marriage, or Burial certificate. Baptism needs the
          baptized person's full name, date of birth, parents' names, approximate date and church of baptism, and a PSA birth
          certificate. Confirmation needs the approximate confirmation date, sponsor's name, and a baptismal certificate.
          Burial needs the death certificate, burial permit, and the informant's contact details.
        - Book Appointment: e.g. House Blessing (confirm the home address, pick an open date and time) or a Wedding Pre-interview,
          which comes first for anyone planning a church wedding; canonical requirements are discussed there. The secretary confirms or
          suggest another schedule.
        - Track Request: enter the reference number (starts with RR for records or AP for appointments). Record requests move
          through Pending → Under Verification → Approved → Ready for Collection → Completed.
        - Chapels: the chapels and their GKK and PYA-KKK officers.

        Current announcements:
        {$announcements}

        Upcoming GKK and PYA-KKK events:
        {$events}
        TEXT;
    }

    private function failure(Response $response): string
    {
        return match (true) {
            $response->status() === 429 => 'The parish assistant is busy.',
            in_array($response->status(), [401, 403], true) => 'Gemini refused the API key; check GEMINI_API_KEY.',
            $response->successful() => 'Gemini returned no answer (finish reason: '.($response->json('candidates.0.finishReason') ?? $response->json('promptFeedback.blockReason') ?? 'unknown').').',
            default => 'Gemini did not answer properly ('.$response->status().').',
        };
    }
}

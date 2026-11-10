<?php

namespace App\Services;

use App\Models\ParishSetting;
use App\Models\SacramentalRecord;
use Illuminate\Support\Collection;

/**
 * AI Record Search ranking. Gemini finds the entries closest in meaning to the
 * question; each is then scored 0 to 1 from that closeness and from how many of
 * the question's names and years the entry really contains, so a surname or a
 * year the person typed counts for more than a loose resemblance.
 */
class RecordSearch
{
    /** Gemini similarity mapped onto 0..1: below FLOOR is unrelated, CEILING and above is as close as entries get. */
    private const FLOOR = 0.55;

    private const CEILING = 0.80;

    /** Weight of the name-and-year match when the question has words that identify entries. */
    private const KEYWORD_WEIGHT = 0.6;

    private const CANDIDATES = 60;

    private const MAX_RESULTS = 50;

    private const STOP = ['a', 'an', 'and', 'are', 'around', 'about', 'approximately', 'circa', 'at', 'by', 'did', 'for', 'from', 'had', 'has', 'in', 'is', 'it',
        'of', 'on', 'or', 'record', 'records', 'entry', 'entries', 'register', 'the', 'to', 'was', 'were', 'who', 'with', 'find', 'show', 'me', 'any', 'all',
        'someone', 'named', 'called', 'presided', 'officiated', 'sponsored', 'sponsor', 'fr', 'father', 'rev', 'reverend', 'mr', 'mrs', 'ms', 'sr', 'jr',
        'year', 'years', 'between', 'during', 'since', 'before', 'after', 'whose', 'their', 'his', 'her'];

    private const TYPE_WORDS = [
        'baptism' => 'Baptism', 'baptisms' => 'Baptism', 'baptized' => 'Baptism', 'baptised' => 'Baptism', 'christening' => 'Baptism',
        'confirmation' => 'Confirmation', 'confirmations' => 'Confirmation', 'confirmed' => 'Confirmation',
        'marriage' => 'Marriage', 'marriages' => 'Marriage', 'married' => 'Marriage', 'wedding' => 'Marriage', 'weddings' => 'Marriage',
        'burial' => 'Burial', 'burials' => 'Burial', 'buried' => 'Burial', 'funeral' => 'Burial', 'funerals' => 'Burial', 'died' => 'Burial', 'death' => 'Burial',
    ];

    public function __construct(private RecordSearchIndex $index, private SacramentalRegister $register) {}

    /**
     * @return array{min: float, strong: float}
     */
    public static function thresholds(): array
    {
        return ['min' => (float) ParishSetting::value('ai_min_score'), 'strong' => (float) ParishSetting::value('ai_strong_score')];
    }

    /**
     * The words that identify entries, and the register the question names, if any.
     *
     * @return array{terms: list<string>, type: ?string, loose: bool}
     */
    public function parse(string $question): array
    {
        $words = preg_split("/[^\\p{L}0-9'-]+/u", mb_strtolower($question), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $type = collect($words)->map(fn ($w) => self::TYPE_WORDS[$w] ?? null)->filter()->first();
        $terms = collect($words)
            ->map(fn ($w) => trim($w, "'-"))
            ->filter(fn ($w) => mb_strlen($w) > 1 && ! in_array($w, self::STOP, true) && ! isset(self::TYPE_WORDS[$w]))
            ->unique()->values()->all();
        $loose = (bool) array_intersect($words, ['around', 'about', 'approximately', 'circa']);

        return ['terms' => $terms, 'type' => $type, 'loose' => $loose];
    }

    /**
     * @param  array{type?: ?string, from?: ?int, to?: ?int, strong_only?: bool, all?: bool}  $filters  all: skip the thresholds (AI Engine Settings preview)
     * @return array{results: list<array<string, mixed>>, type: ?string}
     */
    public function run(string $question, array $filters): array
    {
        $parsed = $this->parse($question);
        // A register named in the question narrows the search unless one was chosen.
        $type = $filters['type'] ?? null ?: $parsed['type'];
        $nearest = $this->index->nearest($question, [...$filters, 'type' => $type], self::CANDIDATES);

        $records = SacramentalRecord::query()->with(SacramentalRegister::relations())
            ->whereIn('record_id', $nearest->pluck('record_id'))->get()->keyBy('record_id');

        $candidates = $nearest->filter(fn ($n) => $records->has($n['record_id']))->map(function (array $n) use ($records, $parsed) {
            $record = $records[$n['record_id']];
            $year = (int) $record->event_date->format('Y');
            $text = mb_strtolower($n['text']);
            $matches = collect($parsed['terms'])->mapWithKeys(fn (string $t) => [$t => $this->termMatch($t, $text, $year, $parsed['loose'])]);

            return [...$n, 'record' => $record, 'matches' => $matches];
        })->values();

        // Words no candidate contains describe rather than identify ("twins", "same day"); only the rest are scored.
        $active = collect($parsed['terms'])->filter(fn ($t) => $candidates->contains(fn ($c) => $c['matches'][$t] > 0))->values();
        $thresholds = self::thresholds();

        $results = $candidates->map(function (array $c) use ($active) {
            $meaning = max(0.0, min(1.0, ($c['similarity'] - self::FLOOR) / (self::CEILING - self::FLOOR)));
            $keywords = $active->isEmpty() ? 0.0 : $active->avg(fn ($t) => $c['matches'][$t]);
            $score = $active->isEmpty() ? $meaning : (1 - self::KEYWORD_WEIGHT) * $meaning + self::KEYWORD_WEIGHT * $keywords;

            return [...$c, 'score' => round(min(0.99, $score), 2), 'found' => $active->filter(fn ($t) => $c['matches'][$t] > 0)->values()->all()];
        })
            ->filter(fn ($c) => ($filters['all'] ?? false) || ($c['score'] >= $thresholds['min'] && (! ($filters['strong_only'] ?? false) || $c['score'] >= $thresholds['strong'])))
            ->sortByDesc(fn ($c) => [$c['score'], $c['similarity']])
            ->take(self::MAX_RESULTS)
            ->map(fn (array $c) => $this->present($c))
            ->values()->all();

        return ['results' => $results, 'type' => $type];
    }

    /** 1 for a full match; a year near the one asked counts for part. */
    private function termMatch(string $term, string $text, int $year, bool $loose): float
    {
        if (preg_match('/^(1[89]|20)\d\d$/', $term)) {
            $off = abs($year - (int) $term);
            $scale = $loose ? [1.0, 0.8, 0.6, 0.4] : [1.0, 0.5, 0.25];

            return $scale[$off] ?? 0.0;
        }

        return preg_match('/\b'.preg_quote($term, '/').'/u', $text) ? 1.0 : 0.0;
    }

    /**
     * @param  array<string, mixed>  $c
     * @return array<string, mixed>
     */
    private function present(array $c): array
    {
        $entry = $this->register->present($c['record']);
        $year = $c['record']->event_date->format('Y');
        $words = collect($c['found'])->reject(fn ($t) => preg_match('/^\d{4}$/', $t));
        $hasYear = count($c['found']) > $words->count();

        $highlights = collect($entry['details'])->filter(function (array $d) use ($words, $hasYear, $year) {
            $value = mb_strtolower($d[1]);

            return $words->contains(fn ($w) => preg_match('/\b'.preg_quote($w, '/').'/u', $value)) || ($hasYear && str_contains($d[1], $year));
        })->take(3)->values();

        return ['entry' => $entry, 'score' => $c['score'], 'terms' => $c['found'], 'highlights' => $highlights];
    }

    /** Every year the registers cover, newest first, for the year filters. */
    public function years(): Collection
    {
        $range = SacramentalRecord::query()->selectRaw('min(extract(year from event_date)) as lo, max(extract(year from event_date)) as hi')->toBase()->first();
        if (! $range?->lo) {
            return collect();
        }

        return collect(range((int) $range->hi, (int) $range->lo))->map(fn ($y) => (string) $y);
    }
}

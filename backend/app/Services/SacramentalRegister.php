<?php

namespace App\Services;

use App\Enums\ApprovalStatus;
use App\Jobs\IndexRecordForSearch;
use App\Models\Parishioner;
use App\Models\SacramentalRecord;
use App\Models\SacramentalRecordCorrection;
use App\Models\SacramentType;
use App\Models\User;
use App\Support\DisplayName;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The four parish registers as staff type them in from the books. The form's
 * fields (frontend features/staff/sacraments/entryFields.ts) are mapped here
 * onto the tables:
 *
 * - p.* / s.*  the entry's person (and, for a marriage, the bride) in parishioners
 * - r.*        sacramental_records: the sacrament's date, place, and minister
 * - d.<column> sacramental_record_details
 * - sp.<type>  sacramental_sponsors, one row per comma-separated name
 *
 * Form values are keyed by the field's slug ("date_of_baptism"); dates are YYYY-MM-DD.
 */
class SacramentalRegister
{
    public const TYPES = ['Baptism', 'Confirmation', 'Marriage', 'Burial'];

    private const SEXES = ['Female', 'Male'];

    /**
     * label, kind, required, target, and (for text) the column's length.
     *
     * @var array<string, list<array{0: string, 1: string, 2: bool, 3: string, 4?: int|list<string>}>>
     */
    private const FIELDS = [
        'Baptism' => [
            ['Baptized', 'text', true, 'p.name', 150],
            ['Sex', 'select', true, 'p.sex', self::SEXES],
            ['Date of birth', 'date', true, 'p.date_of_birth'],
            ['Place of birth', 'text', true, 'p.place_of_birth', 150],
            ['Date of baptism', 'date', true, 'r.event_date'],
            ['Place of baptism', 'text', true, 'r.event_place', 200],
            ['Minister', 'text', true, 'r.officiating_minister', 150],
            ['Father', 'text', true, 'd.father_name', 200],
            ['Mother', 'text', true, 'd.mother_name', 200],
            ['Godparents', 'text', true, 'sp.Godparent', 300],
        ],
        'Confirmation' => [
            ['Confirmed', 'text', true, 'p.name', 150],
            ['Date of birth', 'date', true, 'p.date_of_birth'],
            ['Place of birth', 'text', true, 'p.place_of_birth', 150],
            ['Father', 'text', true, 'd.father_name', 200],
            ['Mother', 'text', true, 'd.mother_name', 200],
            ['Date of confirmation', 'date', true, 'r.event_date'],
            ['Place of confirmation', 'text', true, 'r.event_place', 200],
            ['Minister', 'text', false, 'r.officiating_minister', 150],
            ['Sponsor', 'text', true, 'sp.Sponsor', 300],
            ['Baptismal parish', 'text', true, 'd.baptismal_parish', 200],
            ['Date of baptism', 'date', false, 'd.baptism_date'],
        ],
        'Marriage' => [
            ['Groom', 'text', true, 'p.name', 150],
            ["Groom's date of birth", 'date', true, 'p.date_of_birth'],
            ["Groom's place of birth", 'text', true, 'p.place_of_birth', 150],
            ["Groom's parents", 'text', true, 'd.groom_parents', 300],
            ["Groom's baptismal parish", 'text', true, 'd.baptismal_parish', 200],
            ['Bride', 'text', true, 's.name', 150],
            ["Bride's date of birth", 'date', true, 's.date_of_birth'],
            ["Bride's place of birth", 'text', true, 's.place_of_birth', 150],
            ["Bride's parents", 'text', true, 'd.bride_parents', 300],
            ["Bride's baptismal parish", 'text', true, 'd.spouse_baptismal_parish', 200],
            ['Date of marriage', 'date', true, 'r.event_date'],
            ['Place of marriage', 'text', true, 'r.event_place', 200],
            ['Presiding priest', 'text', true, 'r.officiating_minister', 150],
            ['Marriage license no.', 'text', true, 'd.license_number', 50],
            ['Civil marriage date', 'date', false, 'd.civil_marriage_date'],
            ['Civil marriage place', 'text', false, 'd.civil_marriage_place', 200],
            ['Witnesses', 'text', true, 'sp.Witness', 300],
        ],
        'Burial' => [
            ['Deceased', 'text', true, 'p.name', 150],
            ['Sex', 'select', true, 'p.sex', self::SEXES],
            ['Date of birth', 'date', false, 'p.date_of_birth'],
            ['Date of death', 'date', true, 'd.date_of_death'],
            ['Age at death', 'number', true, 'd.age_at_death'],
            ['Place of death', 'text', true, 'd.place_of_death', 200],
            ['Cause of death', 'text', false, 'd.cause_of_death', 200],
            ['Civil status', 'select', true, 'd.civil_status', ['Single', 'Married', 'Widowed', 'Separated']],
            ['Spouse', 'text', false, 'd.spouse_name', 200],
            ['Parents', 'text', false, 'd.parents_names', 300],
            ['Funeral Mass', 'date', true, 'd.funeral_mass_date'],
            ['Date of burial', 'date', true, 'r.event_date'],
            ['Place of burial', 'text', true, 'd.burial_place', 200],
            ['Church', 'text', true, 'r.event_place', 200],
            ['Officiating priest', 'text', true, 'r.officiating_minister', 150],
            ['Informant', 'text', true, 'd.informant_name', 200],
            ['Informant relationship', 'text', true, 'd.informant_relationship', 50],
            ['Informant contact', 'text', true, 'd.informant_contact', 20],
            ['Informant address', 'text', true, 'd.informant_address', 300],
        ],
    ];

    /** Lower-case words that belong to the surname that follows ("Dela Cruz", "De los Reyes"). */
    private const SURNAME_PARTICLES = ['de', 'dela', 'del', 'delos', 'la', 'las', 'los', 'san', 'santa', 'sta.', 'sto.', 'santo', 'di', 'da', 'van', 'von'];

    public static function slug(string $label): string
    {
        return trim((string) preg_replace('/[^a-z0-9]+/', '_', strtolower($label)), '_');
    }

    /**
     * @return list<array{slug: string, label: string, kind: string, required: bool, target: string, max: int|null, options: list<string>|null}>
     */
    public function fields(string $type): array
    {
        return array_map(fn (array $f) => [
            'slug' => self::slug($f[0]),
            'label' => $f[0],
            'kind' => $f[1],
            'required' => $f[2],
            'target' => $f[3],
            'max' => is_int($f[4] ?? null) ? $f[4] : null,
            'options' => is_array($f[4] ?? null) ? $f[4] : null,
        ], self::FIELDS[$type]);
    }

    /**
     * Rules for "values.*". A correction can't blank a field the entry already
     * has, but an older entry missing a required field shouldn't block a fix.
     *
     * @param  array<string, string>|null  $current  the entry's values, for a correction
     * @return array<string, list<mixed>>
     */
    public function rules(string $type, ?array $current = null): array
    {
        $rules = ['values' => ['required', 'array']];
        foreach ($this->fields($type) as $f) {
            $required = $f['required'] && ($current === null || ($current[$f['slug']] ?? '') !== '');
            $r = [$required ? 'required' : 'nullable'];
            $r = [...$r, ...match ($f['kind']) {
                'date' => ['date_format:Y-m-d', 'before_or_equal:today'],
                'number' => ['integer', 'between:0,150'],
                'select' => [Rule::in($f['options'] ?? [])],
                default => ['string', 'max:'.($f['max'] ?? 200)],
            }];
            $rules["values.{$f['slug']}"] = $r;
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(string $type): array
    {
        $messages = [];
        foreach ($this->fields($type) as $f) {
            $key = "values.{$f['slug']}";
            $what = Str::lower($f['label']);
            $messages["{$key}.required"] = $f['kind'] === 'select' ? "Choose the {$what}." : "Enter the {$what}.";
            $messages["{$key}.before_or_equal"] = 'This date can’t be in the future.';
            $messages["{$key}.date_format"] = 'Enter a valid date.';
            $messages["{$key}.integer"] = 'Enter a whole number.';
            $messages["{$key}.between"] = 'Enter an age from 0 to 150.';
            $messages["{$key}.max"] = 'This is too long for the register.';
            $messages["{$key}.in"] = "Choose the {$what} from the list.";
        }

        return $messages;
    }

    /**
     * Adds a new entry at its place in the register book.
     *
     * @param  array<string, mixed>  $values
     * @param  array{book: string, page: string, line: string}  $place
     */
    public function create(string $type, array $place, array $values, User $by): SacramentalRecord
    {
        return DB::transaction(function () use ($type, $place, $values, $by) {
            $record = new SacramentalRecord([
                'sacrament_type_id' => SacramentType::query()->where('name', $type)->valueOrFail('sacrament_type_id'),
                'book_number' => $place['book'],
                'page_number' => $place['page'],
                'line_number' => $place['line'],
                'created_by_user_id' => $by->user_id,
            ]);
            $this->write($record, $type, $values);
            IndexRecordForSearch::dispatch($record->record_id);

            return $record;
        });
    }

    /**
     * Writes the form's values onto an entry and its people, details, and sponsors.
     * Call inside a transaction.
     *
     * @param  array<string, mixed>  $values
     */
    public function write(SacramentalRecord $record, string $type, array $values): void
    {
        $buckets = ['p' => [], 's' => [], 'r' => [], 'd' => [], 'sp' => []];
        foreach ($this->fields($type) as $f) {
            [$bucket, $column] = explode('.', $f['target'], 2);
            $raw = $values[$f['slug']] ?? null;
            $value = is_string($raw) ? (trim($raw) === '' ? null : trim($raw)) : $raw;
            $buckets[$bucket][$column] = $value;
        }

        $primary = $record->primaryParishioner ?? new Parishioner;
        $this->fillPerson($primary, $buckets['p'], $type === 'Marriage' ? 'Male' : null)->save();

        $secondaryId = null;
        if ($type === 'Marriage') {
            $secondary = $record->secondaryParishioner ?? new Parishioner;
            $this->fillPerson($secondary, $buckets['s'], 'Female')->save();
            $secondaryId = $secondary->parishioner_id;
        }

        $record->fill([
            'primary_parishioner_id' => $primary->parishioner_id,
            'secondary_parishioner_id' => $secondaryId,
            'event_date' => $buckets['r']['event_date'],
            'event_place' => $buckets['r']['event_place'] ?? '',
            // NOT NULL in the schema; a confirmation's minister may be unknown.
            'officiating_minister' => $buckets['r']['officiating_minister'] ?? '',
        ])->save();

        $record->details()->updateOrCreate(['record_id' => $record->record_id], $buckets['d']);

        $record->sponsors()->delete();
        foreach ($buckets['sp'] as $sponsorType => $names) {
            foreach (array_filter(array_map('trim', explode(',', (string) $names))) as $name) {
                $record->sponsors()->create(['sponsor_name' => $name, 'sponsor_type' => $sponsorType]);
            }
        }

        $record->unsetRelation('primaryParishioner')->unsetRelation('secondaryParishioner')
            ->unsetRelation('details')->unsetRelation('sponsors');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function fillPerson(Parishioner $person, array $data, ?string $sex): Parishioner
    {
        $name = $this->splitName((string) ($data['name'] ?? ''));
        $sex ??= $data['sex'] ?? $person->sex;
        $person->fill([
            ...$name,
            'sex' => $sex,
            'gender' => $sex,
            'date_of_birth' => $data['date_of_birth'] ?? null,
            'place_of_birth' => $data['place_of_birth'] ?? null,
        ]);

        return $person;
    }

    /**
     * "Elena Santos Dela Cruz" becomes first "Elena Santos", last "Dela Cruz";
     * "Teresa Garcia (née Navarro)" keeps her maiden surname as the middle name,
     * as Filipino married names do. Joining the parts back gives the name as typed.
     *
     * @return array{first_name: string, middle_name: string|null, last_name: string, suffix: string|null}
     */
    public function splitName(string $full): array
    {
        $full = trim((string) preg_replace('/\s+/u', ' ', $full));
        $maiden = null;
        if (preg_match('/^(.*?)\s*\(n[ée]e\s+([^)]+)\)$/iu', $full, $m)) {
            [$full, $maiden] = [trim($m[1]), trim($m[2])];
        }

        $words = $full === '' ? [] : explode(' ', $full);
        $suffix = null;
        if (count($words) > 1 && preg_match('/^(jr|sr)\.?$|^(ii|iii|iv|v)$/i', (string) end($words))) {
            $suffix = array_pop($words);
        }

        $last = count($words) > 1 ? [array_pop($words)] : [];
        while (count($words) > 1 && in_array(Str::lower((string) end($words)), self::SURNAME_PARTICLES, true)) {
            array_unshift($last, array_pop($words));
        }

        return [
            'first_name' => implode(' ', $words),
            'middle_name' => $maiden,
            'last_name' => implode(' ', $last),
            'suffix' => $suffix,
        ];
    }

    public function nameOf(?Parishioner $p): string
    {
        if (! $p) {
            return '';
        }
        $name = trim(implode(' ', array_filter([$p->first_name, $p->last_name, $p->suffix])));

        return $p->middle_name ? "{$name} (née {$p->middle_name})" : $name;
    }

    /**
     * The entry as form values: what the edit form starts from and what a correction is compared with.
     *
     * @return array<string, string>
     */
    public function valuesOf(SacramentalRecord $record): array
    {
        $type = $record->sacramentType->name;
        $out = [];
        foreach ($this->fields($type) as $f) {
            [$bucket, $column] = explode('.', $f['target'], 2);
            $value = match ($bucket) {
                'p', 's' => $this->personValue($bucket === 'p' ? $record->primaryParishioner : $record->secondaryParishioner, $column),
                'r' => $record->getAttribute($column),
                'd' => $record->details?->getAttribute($column),
                'sp' => $record->sponsors->where('sponsor_type', $column)->pluck('sponsor_name')->implode(', '),
            };
            $out[$f['slug']] = $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : (string) ($value ?? '');
        }

        return $out;
    }

    private function personValue(?Parishioner $p, string $column): mixed
    {
        return $column === 'name' ? $this->nameOf($p) : $p?->getAttribute($column);
    }

    /**
     * What changes between two sets of values, labelled and formatted for people.
     *
     * @param  array<string, string>  $before
     * @param  array<string, mixed>  $after
     * @return list<array{field: string, from: string, to: string}>
     */
    public function diff(string $type, array $before, array $after): array
    {
        $changes = [];
        foreach ($this->fields($type) as $f) {
            $from = trim((string) ($before[$f['slug']] ?? ''));
            $to = trim((string) ($after[$f['slug']] ?? ''));
            if ($f['kind'] === 'text') {
                $to = (string) preg_replace('/\s+/u', ' ', $to);
            }
            if ($from !== $to) {
                $changes[] = ['field' => $f['label'], 'from' => $this->display($f['kind'], $from), 'to' => $this->display($f['kind'], $to)];
            }
        }

        return $changes;
    }

    private function display(string $kind, string $value): string
    {
        return $kind === 'date' && $value !== '' ? CarbonImmutable::parse($value)->format('F j, Y') : $value;
    }

    /**
     * Eager loads for present().
     *
     * @return list<string>
     */
    public static function relations(): array
    {
        return ['sacramentType', 'primaryParishioner', 'secondaryParishioner', 'details', 'sponsors', 'documents', 'corrections.requestedBy'];
    }

    /**
     * One register, newest first, with every register's entry count: the list
     * staff work from in Sacramental Records and the priest reads in Sacramental Review.
     *
     * @return array{data: list<array<string, mixed>>, counts: array<string, int>, waiting: array<string, int>}
     */
    public function listing(string $type): array
    {
        $entries = SacramentalRecord::query()
            ->with(self::relations())
            ->whereHas('sacramentType', fn ($q) => $q->where('name', $type))
            ->orderByDesc('event_date')
            ->orderByDesc('created_at')
            ->get();

        $counts = SacramentalRecord::query()
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->groupBy('sacrament_types.name')
            ->selectRaw('sacrament_types.name, count(*) as total')
            ->pluck('total', 'name');

        $waiting = SacramentalRecordCorrection::query()
            ->where('sacramental_record_corrections.status', ApprovalStatus::Pending->value)
            ->join('sacramental_records', 'sacramental_records.record_id', '=', 'sacramental_record_corrections.record_id')
            ->join('sacrament_types', 'sacrament_types.sacrament_type_id', '=', 'sacramental_records.sacrament_type_id')
            ->groupBy('sacrament_types.name')
            ->selectRaw('sacrament_types.name, count(*) as total')
            ->pluck('total', 'name');

        $perType = fn ($totals) => collect(self::TYPES)->mapWithKeys(fn ($t) => [$t => (int) ($totals[$t] ?? 0)])->all();

        return [
            'data' => $entries->map(fn ($e) => $this->present($e))->values()->all(),
            'counts' => $perType($counts),
            'waiting' => $perType($waiting),
        ];
    }

    /** Who the entry is for: "Elena Santos Dela Cruz", or "Paolo & Teresa Garcia" for a marriage. */
    public function subjectOf(SacramentalRecord $record): string
    {
        $firstWord = fn (?string $s) => explode(' ', trim((string) $s))[0] ?? '';
        $primary = $record->primaryParishioner;

        return $record->sacramentType?->name === 'Marriage'
            ? trim($firstWord($primary?->first_name).' & '.$firstWord($record->secondaryParishioner?->first_name).' '.$primary?->last_name)
            : $this->nameOf($primary);
    }

    /**
     * The entry as the Sacramental Records page shows it (RegisterEntry on the frontend).
     *
     * @return array<string, mixed>
     */
    public function present(SacramentalRecord $record): array
    {
        $type = $record->sacramentType->name;
        $values = $this->valuesOf($record);
        $details = [];
        foreach ($this->fields($type) as $f) {
            if ($values[$f['slug']] !== '') {
                $details[] = [$f['label'], $this->display($f['kind'], $values[$f['slug']])];
            }
        }

        $firstWord = fn (?string $s) => explode(' ', trim((string) $s))[0] ?? '';
        $subject = $this->subjectOf($record);
        $people = match ($type) {
            'Baptism' => 'Parents: '.$firstWord($values['father']).' & '.$firstWord($values['mother']),
            'Confirmation' => 'Sponsor: '.$values['sponsor'],
            'Marriage' => 'Presiding: '.$values['presiding_priest'],
            default => 'Age '.$values['age_at_death'],
        };

        $approved = $record->corrections->where('status', ApprovalStatus::Approved)->sortByDesc('reviewed_at')->first();
        $pending = $record->corrections->firstWhere('status', ApprovalStatus::Pending);
        $first = $approved?->changes[0] ?? null;

        return [
            'id' => $record->record_id,
            'type' => $type,
            'subject' => $subject,
            'date' => $record->event_date->toDateString(),
            'register' => ['book' => (int) $record->book_number, 'page' => (int) $record->page_number, 'line' => (int) $record->line_number],
            'people' => $people,
            'details' => $details,
            'values' => $values,
            'correction' => $record->is_corrected && $first ? [
                'field' => count($approved->changes) > 1 ? "{$first['field']} and ".(count($approved->changes) - 1).' more' : $first['field'],
                'from' => $first['from'],
                'to' => $first['to'],
                'approvedOn' => $approved->reviewed_at?->format('F j, Y') ?? '',
                'request' => 'a correction filed by '.(DisplayName::of($approved->requestedBy) ?? 'the parish office'),
            ] : null,
            'pending_correction' => $pending ? [
                'correction_id' => $pending->correction_id,
                'changes' => $pending->changes,
                'requested_by' => DisplayName::of($pending->requestedBy),
                'requested_at' => $pending->created_at?->toIso8601String(),
            ] : null,
            'scans' => $record->documents->map(fn ($d) => ['label' => $d->file_name, 'file' => $d->file_name, 'document_id' => $d->document_id])->values(),
        ];
    }

    /**
     * Applies an approved correction. Call inside a transaction with the correction locked.
     */
    public function applyCorrection(SacramentalRecordCorrection $correction): void
    {
        $record = $correction->record()->with(self::relations())->firstOrFail();
        $this->write($record, $record->sacramentType->name, $correction->proposed_values);
        $record->forceFill(['is_corrected' => true])->save();
        IndexRecordForSearch::dispatch($record->record_id);
    }
}

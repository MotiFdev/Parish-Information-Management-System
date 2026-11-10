<?php

namespace App\Services;

use App\Enums\RecordRequestStatus;
use App\Enums\RecordRequestType;
use App\Models\RecordRequest;
use Carbon\CarbonImmutable;

/**
 * Fills the register's create form from an approved New Registration, so
 * staff check and complete the entry instead of typing it again. Request
 * fields (config/record_requests.php) map onto register fields by slug
 * (SacramentalRegister::FIELDS). What can't go into a form field as written,
 * such as an approximate date, comes back as a note for staff to settle.
 */
class RegisterDraft
{
    /**
     * Register slug => request field, or a list of request fields joined with " and " / ", ".
     *
     * @var array<string, array<string, string|array{0: string, 1: list<string>}>>
     */
    private const MAP = [
        'Baptism' => [
            'baptized' => 'fullName', 'sex' => 'sex', 'date_of_birth' => 'birthDate', 'place_of_birth' => 'birthPlace',
            'date_of_baptism' => 'baptismDate', 'place_of_baptism' => 'baptismChurch',
            'father' => 'father', 'mother' => 'mother', 'godparents' => [', ', ['godfather', 'godmother']],
        ],
        'Confirmation' => [
            'confirmed' => 'fullName', 'date_of_birth' => 'birthDate', 'place_of_birth' => 'birthPlace', 'father' => 'father', 'mother' => 'mother',
            'date_of_confirmation' => 'confirmationDate', 'place_of_confirmation' => 'confirmationPlace', 'minister' => 'minister',
            'sponsor' => 'sponsor', 'baptismal_parish' => 'baptismParish', 'date_of_baptism' => 'baptismDate',
        ],
        'Marriage' => [
            'groom' => 'groomName', 'groom_s_date_of_birth' => 'groomBirthDate', 'groom_s_place_of_birth' => 'groomBirthPlace',
            'groom_s_parents' => [' and ', ['groomFather', 'groomMother']], 'groom_s_baptismal_parish' => 'groomBaptismParish',
            'bride' => 'brideName', 'bride_s_date_of_birth' => 'brideBirthDate', 'bride_s_place_of_birth' => 'brideBirthPlace',
            'bride_s_parents' => [' and ', ['brideFather', 'brideMother']], 'bride_s_baptismal_parish' => 'brideBaptismParish',
            'date_of_marriage' => 'marriageDate', 'place_of_marriage' => 'marriagePlace', 'presiding_priest' => 'presidingPriest',
            'marriage_license_no' => 'licenseNumber', 'witnesses' => 'witnesses',
        ],
        'Burial' => [
            'deceased' => 'deceasedName', 'sex' => 'sex', 'date_of_birth' => 'birthDate', 'date_of_death' => 'deathDate',
            'age_at_death' => 'ageAtDeath', 'place_of_death' => 'deathPlace', 'cause_of_death' => 'causeOfDeath',
            'civil_status' => 'civilStatus', 'spouse' => 'spouse', 'parents' => 'parents', 'funeral_mass' => 'funeralMassDate',
            'date_of_burial' => 'burialDate', 'place_of_burial' => 'burialPlace', 'church' => 'funeralChurch',
            'officiating_priest' => 'officiatingPriest', 'informant' => 'informantName',
            'informant_relationship' => 'informantRelationship', 'informant_contact' => 'informantContact', 'informant_address' => 'informantAddress',
        ],
    ];

    /** Request fields with no register field of their own, shown to staff as notes. */
    private const NOTE_ONLY = ['Marriage' => ['civilDetails' => 'Civil marriage details']];

    public function __construct(private SacramentalRegister $register) {}

    /** Why a register entry can't be made from this request yet, or null when it can. */
    public function blockedReason(RecordRequest $r): ?string
    {
        if ($r->request_type !== RecordRequestType::NewRegistration) {
            return 'Only a New Registration request creates a register entry.';
        }
        if ($r->status !== RecordRequestStatus::Approved) {
            return 'The priest has to approve this request before its register entry is made.';
        }
        if ($r->register_book !== null || $r->createdRecord()->exists()) {
            return 'This request already has its register entry.';
        }

        return null;
    }

    /**
     * @return array{type: string, values: array<string, string>, notes: list<string>}
     */
    public function for(RecordRequest $r): array
    {
        $type = $r->recordType->name;
        $given = collect($r->subject_details['fields'] ?? [])->map(fn ($v) => trim((string) $v))->filter(fn ($v) => $v !== '');
        $fields = collect($this->register->fields($type))->keyBy('slug');
        $values = [];
        $notes = [];

        foreach (self::MAP[$type] ?? [] as $slug => $source) {
            $field = $fields[$slug] ?? null;
            if (! $field) {
                continue;
            }
            $raw = is_array($source)
                ? implode($source[0], $given->only($source[1])->values()->all())
                : (string) ($given[$source] ?? '');
            // Witnesses and similar lists may be typed one per line.
            $raw = trim((string) preg_replace('/\s*[\r\n]+\s*/', ', ', $raw));
            if ($raw === '') {
                continue;
            }

            $value = $this->fit($field, $raw);
            if ($value === null) {
                $notes[] = "{$field['label']}: the requester wrote “{$raw}”. Enter it as written in the register.";

                continue;
            }
            $values[$slug] = $value;
        }

        foreach (self::NOTE_ONLY[$type] ?? [] as $name => $label) {
            if (isset($given[$name])) {
                $notes[] = "{$label} from the request: “{$given[$name]}”.";
            }
        }

        return ['type' => $type, 'values' => $values, 'notes' => $notes];
    }

    /**
     * The value as the form field takes it, or null when it doesn't fit (staff then decide).
     *
     * @param  array{kind: string, options?: list<string>}  $field
     */
    private function fit(array $field, string $raw): ?string
    {
        return match ($field['kind']) {
            'date' => $this->isoDate($raw),
            'select' => collect($field['options'] ?? [])->first(fn ($o) => strcasecmp($o, $raw) === 0),
            'number' => preg_match('/^\d{1,3}$/', $raw) ? $raw : null,
            default => $raw,
        };
    }

    private function isoDate(string $raw): ?string
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return null;
        }
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $raw);

        return $date && $date->format('Y-m-d') === $raw && ! $date->isFuture() ? $raw : null;
    }
}

<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\ApprovalStatus;
use App\Http\Controllers\Controller;
use App\Models\Chapel;
use App\Models\Parishioner;
use App\Models\SacramentalRecord;
use App\Models\Sona;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * The parish directory for staff: personal details, address with Sona and
 * chapel, and the father and mother links that make up the family tree.
 * Records are archived, never deleted, so sacramental records and family
 * links stay intact. People first written down from a register book may lack
 * an address or birth date; editing them doesn't force those fields until
 * they are known.
 */
class ParishionerController extends Controller
{
    /** Form field => column. */
    private const COLUMNS = [
        'first_name' => 'first_name', 'middle_name' => 'middle_name', 'last_name' => 'last_name', 'suffix' => 'suffix',
        'sex' => 'sex', 'date_of_birth' => 'date_of_birth', 'place_of_birth' => 'place_of_birth',
        'contact_number' => 'contact_number', 'email' => 'email',
        'address_street' => 'address_street', 'address_barangay' => 'address_barangay', 'address_city' => 'address_city',
        'chapel_id' => 'chapel_id', 'father_id' => 'father_parishioner_id', 'mother_id' => 'mother_parishioner_id',
    ];

    /** Required for a new record; on an existing one only once it has a value. */
    private const REQUIRED_ONCE_KNOWN = ['sex', 'date_of_birth', 'place_of_birth', 'address_street', 'address_barangay', 'address_city', 'chapel_id'];

    public function __construct(private AuditLogger $audit) {}

    #[OA\Get(
        path: '/api/secretary/parishioners',
        summary: 'The whole directory (archived included), with each person’s register entries, and the Sonas and chapels',
        description: 'One parish is small enough to load whole; the page searches and filters it.',
        tags: ['Staff'],
        responses: [new OA\Response(response: 200, description: 'data (people) and sonas')],
    )]
    public function index(): JsonResponse
    {
        $people = Parishioner::query()
            ->with(['sacramentalRecords.sacramentType', 'spouseSacramentalRecords.sacramentType', 'chapel'])
            ->orderBy('last_name')->orderBy('first_name')
            ->get();

        return response()->json([
            'data' => $people->map(fn (Parishioner $p) => $this->present($p))->values(),
            'sonas' => Sona::query()->orderBy('sona_id')->get()->map(fn (Sona $s) => [
                'id' => (string) $s->sona_id,
                'name' => $s->name,
                'chapels' => Chapel::query()->where('sona_id', $s->sona_id)->where('approval_status', ApprovalStatus::Approved->value)
                    ->orderBy('name')->get()
                    ->map(fn (Chapel $c) => ['id' => (string) $c->chapel_id, 'name' => $c->name, 'active' => $c->is_active])->values(),
            ])->values(),
        ]);
    }

    #[OA\Post(path: '/api/secretary/parishioners', summary: 'Add a parishioner', tags: ['Staff'], responses: [new OA\Response(response: 201, description: 'The new record'), new OA\Response(response: 422, description: 'Invalid')])]
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);
        $p = Parishioner::query()->create($this->columns($data));

        $this->audit->log('PARISHIONER_ADDED', 'parishioners', $p->parishioner_id, $this->me($request), ['name' => $this->nameOf($p)]);

        return response()->json(['data' => $this->present($this->fresh($p))], 201);
    }

    #[OA\Patch(path: '/api/secretary/parishioners/{parishioner}', summary: 'Edit a parishioner', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Saved'), new OA\Response(response: 422, description: 'Invalid')])]
    public function update(Request $request, Parishioner $parishioner): JsonResponse
    {
        $data = $this->validated($request, $parishioner);
        $before = $parishioner->only(array_values(self::COLUMNS));
        $parishioner->fill($this->columns($data));
        $changed = collect($parishioner->getDirty())->keys()
            ->mapWithKeys(fn ($k) => [$k => ['from' => $this->plain($before[$k] ?? null), 'to' => $this->plain($parishioner->getAttribute($k))]])
            ->all();
        $parishioner->save();

        if ($changed) {
            $this->audit->log('PARISHIONER_UPDATED', 'parishioners', $parishioner->parishioner_id, $this->me($request), [
                'name' => $this->nameOf($parishioner), 'changes' => $changed,
            ]);
        }

        return response()->json(['data' => $this->present($this->fresh($parishioner))]);
    }

    #[OA\Post(path: '/api/secretary/parishioners/{parishioner}/archive', summary: 'Archive: hidden from the directory, links kept', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Archived'), new OA\Response(response: 409, description: 'Already archived')])]
    public function archive(Request $request, Parishioner $parishioner): JsonResponse
    {
        return $this->setArchived($request, $parishioner, true);
    }

    #[OA\Post(path: '/api/secretary/parishioners/{parishioner}/restore', summary: 'Restore an archived parishioner', tags: ['Staff'], responses: [new OA\Response(response: 200, description: 'Restored'), new OA\Response(response: 409, description: 'Not archived')])]
    public function restore(Request $request, Parishioner $parishioner): JsonResponse
    {
        return $this->setArchived($request, $parishioner, false);
    }

    private function setArchived(Request $request, Parishioner $parishioner, bool $archived): JsonResponse
    {
        if ($parishioner->is_archived === $archived) {
            return response()->json(['message' => $archived ? 'This parishioner is already archived.' : 'This parishioner is not archived.'], 409);
        }
        $parishioner->forceFill(['is_archived' => $archived])->save();
        $this->audit->log($archived ? 'PARISHIONER_ARCHIVED' : 'PARISHIONER_RESTORED', 'parishioners', $parishioner->parishioner_id, $this->me($request), [
            'name' => $this->nameOf($parishioner),
        ]);

        return response()->json(['data' => $this->present($this->fresh($parishioner))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Parishioner $current): array
    {
        if ($request->filled('contact_number')) {
            $request->merge(['contact_number' => trim((string) $request->input('contact_number'))]);
        }
        $required = fn (string $field) => ! $current || filled($current->getAttribute(self::COLUMNS[$field])) ? 'required' : 'nullable';
        $parent = ['nullable', 'uuid', Rule::exists('parishioners', 'parishioner_id')];

        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:20'],
            'sex' => [$required('sex'), Rule::in(['Female', 'Male'])],
            'date_of_birth' => [$required('date_of_birth'), 'date_format:Y-m-d', 'before_or_equal:today'],
            'place_of_birth' => [$required('place_of_birth'), 'string', 'max:150'],
            'contact_number' => ['nullable', 'string', 'regex:/^[0-9 +()-]{7,20}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'address_street' => [$required('address_street'), 'string', 'max:150'],
            'address_barangay' => [$required('address_barangay'), 'string', 'max:100'],
            'address_city' => [$required('address_city'), 'string', 'max:100'],
            'chapel_id' => [$required('chapel_id'), 'integer', Rule::exists('chapels', 'chapel_id')->where('approval_status', ApprovalStatus::Approved->value)],
            'father_id' => $parent,
            'mother_id' => $parent,
        ], [
            'first_name.required' => 'Enter the first name.',
            'last_name.required' => 'Enter the last name.',
            'sex.required' => 'Choose the sex as recorded.',
            'date_of_birth.required' => 'Enter the date of birth.',
            'date_of_birth.before_or_equal' => 'The date of birth can’t be in the future.',
            'place_of_birth.required' => 'Enter the place of birth.',
            'contact_number.regex' => 'Use digits, spaces, and + only.',
            'email.email' => 'Enter an email address like name@example.com.',
            'address_street.required' => 'Enter the street or purok.',
            'address_barangay.required' => 'Enter the barangay.',
            'address_city.required' => 'Enter the city or municipality.',
            'chapel_id.required' => 'Choose the chapel.',
            'chapel_id.exists' => 'Choose a chapel from the list.',
            'father_id.exists' => 'That person is no longer in the directory.',
            'mother_id.exists' => 'That person is no longer in the directory.',
        ]);

        $this->checkParents($data, $current);

        return $data;
    }

    /**
     * A parent must be someone else, of the matching sex, born first, and not one of this person's descendants.
     *
     * @param  array<string, mixed>  $data
     */
    private function checkParents(array $data, ?Parishioner $current): void
    {
        $errors = [];
        foreach (['father_id' => ['Male', 'father'], 'mother_id' => ['Female', 'mother']] as $field => [$sex, $word]) {
            $parent = filled($data[$field] ?? null) ? Parishioner::query()->find($data[$field]) : null;
            if (! $parent) {
                continue;
            }
            $born = $data['date_of_birth'] ?? $current?->date_of_birth?->toDateString();
            if ($current && $parent->parishioner_id === $current->parishioner_id) {
                $errors[$field] = "A person can’t be their own {$word}.";
            } elseif ($parent->sex && $parent->sex !== $sex) {
                $errors[$field] = 'Choose a '.($sex === 'Male' ? 'man' : 'woman')." as the {$word}.";
            } elseif ($born && $parent->date_of_birth && $parent->date_of_birth->toDateString() >= $born) {
                $errors[$field] = "The {$word} must be born before this parishioner.";
            } elseif ($current && $this->isAncestor($current, $parent)) {
                $errors[$field] = "That person is this parishioner’s descendant, so they can’t be the {$word}.";
            }
        }
        if (filled($data['father_id'] ?? null) && ($data['father_id'] ?? null) === ($data['mother_id'] ?? null)) {
            $errors['mother_id'] = 'The father and mother must be different people.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** Whether $ancestor appears among $person's parents, grandparents, and so on. */
    private function isAncestor(Parishioner $ancestor, Parishioner $person): bool
    {
        $seen = [];
        $queue = [$person->father_parishioner_id, $person->mother_parishioner_id];
        while ($queue && count($seen) < 500) {
            $id = array_shift($queue);
            if (! $id || isset($seen[$id])) {
                continue;
            }
            if ($id === $ancestor->parishioner_id) {
                return true;
            }
            $seen[$id] = true;
            $next = Parishioner::query()->whereKey($id)->first(['father_parishioner_id', 'mother_parishioner_id']);
            if ($next) {
                array_push($queue, $next->father_parishioner_id, $next->mother_parishioner_id);
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function columns(array $data): array
    {
        $out = [];
        foreach (self::COLUMNS as $field => $column) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $value = $data[$field];
            $out[$column] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
        }

        return $out;
    }

    private function fresh(Parishioner $p): Parishioner
    {
        return $p->fresh(['sacramentalRecords.sacramentType', 'spouseSacramentalRecords.sacramentType', 'chapel']);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Parishioner $p): array
    {
        $entry = fn (SacramentalRecord $r, string $role) => [
            'record_id' => $r->record_id,
            'type' => $r->sacramentType?->name,
            'date' => $r->event_date?->toDateString(),
            'role' => $role,
            'register' => ['book' => (int) $r->book_number, 'page' => (int) $r->page_number, 'line' => (int) $r->line_number],
        ];
        $sacraments = $p->sacramentalRecords->map(fn ($r) => $entry($r, $r->sacramentType?->name === 'Marriage' ? 'Groom' : 'Recipient'))
            ->concat($p->spouseSacramentalRecords->map(fn ($r) => $entry($r, 'Bride')))
            ->sortBy('date')->values();

        return [
            'id' => $p->parishioner_id,
            'first_name' => $p->first_name,
            'middle_name' => $p->middle_name,
            'last_name' => $p->last_name,
            'suffix' => $p->suffix,
            'sex' => $p->sex,
            'date_of_birth' => $p->date_of_birth?->toDateString(),
            'place_of_birth' => $p->place_of_birth,
            'contact_number' => $p->contact_number,
            'email' => $p->email,
            'address_street' => $p->address_street,
            'address_barangay' => $p->address_barangay,
            'address_city' => $p->address_city,
            'chapel_id' => $p->chapel_id ? (string) $p->chapel_id : null,
            'sona_id' => $p->chapel ? (string) $p->chapel->sona_id : null,
            'father_id' => $p->father_parishioner_id,
            'mother_id' => $p->mother_parishioner_id,
            'is_archived' => $p->is_archived,
            'sacraments' => $sacraments,
        ];
    }

    private function nameOf(Parishioner $p): string
    {
        return implode(' ', array_filter([$p->first_name, $p->middle_name, $p->last_name, $p->suffix]));
    }

    private function plain(mixed $value): mixed
    {
        return $value instanceof \DateTimeInterface ? $value->format('Y-m-d') : $value;
    }

    private function me(Request $request): User
    {
        /** @var User */
        return $request->user();
    }
}

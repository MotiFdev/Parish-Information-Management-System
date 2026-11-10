<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\SacramentalRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SacramentalRecordTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    private User $priest;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staff = User::factory()->role(UserRole::ParishStaff)->create();
        $this->priest = User::factory()->role(UserRole::ParishPriest)->create();
    }

    /** @return array<string, string> */
    private function baptism(array $overrides = []): array
    {
        return [
            'baptized' => 'Elena Santos Dela Cruz',
            'sex' => 'Female',
            'date_of_birth' => '2019-05-02',
            'place_of_birth' => 'Davao City',
            'date_of_baptism' => '2019-06-18',
            'place_of_baptism' => 'Sacred Heart of Jesus Parish',
            'minister' => 'Fr. Antonio Reyes',
            'father' => 'Ramon Dela Cruz',
            'mother' => 'Maria Santos',
            'godparents' => 'Victor Tan, Rosa Uy',
            ...$overrides,
        ];
    }

    private function addBaptism(array $values = [], array $place = ['book' => '12', 'page' => '48', 'line' => '3']): TestResponse
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', ['type' => 'Baptism', ...$place, 'values' => $this->baptism($values)]);
    }

    public function test_staff_add_an_entry_and_see_it_in_the_register(): void
    {
        $this->addBaptism()
            ->assertCreated()
            ->assertJsonPath('entry.subject', 'Elena Santos Dela Cruz')
            ->assertJsonPath('entry.register', ['book' => 12, 'page' => 48, 'line' => 3])
            ->assertJsonPath('entry.people', 'Parents: Ramon & Maria');

        $record = SacramentalRecord::query()->with(['primaryParishioner', 'sponsors', 'details'])->sole();
        $this->assertSame('Elena Santos', $record->primaryParishioner->first_name);
        $this->assertSame('Dela Cruz', $record->primaryParishioner->last_name);
        $this->assertSame(['Rosa Uy', 'Victor Tan'], $record->sponsors->pluck('sponsor_name')->sort()->values()->all());
        $this->assertSame('Maria Santos', $record->details->mother_name);
        $this->assertDatabaseHas('audit_logs', ['action' => 'SACRAMENTAL_RECORD_ADDED', 'record_id_affected' => $record->record_id]);

        $this->getJson('/api/secretary/sacramental-records?type=Baptism')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('counts.Baptism', 1)
            ->assertJsonPath('counts.Burial', 0)
            ->assertJsonPath('data.0.details.0', ['Baptized', 'Elena Santos Dela Cruz'])
            ->assertJsonPath('data.0.values.date_of_baptism', '2019-06-18');
    }

    public function test_a_place_in_the_book_holds_one_entry(): void
    {
        $this->addBaptism()->assertCreated();

        $this->addBaptism(['baptized' => 'Someone Else'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.register.0', 'Book 12, page 48, line 3 already holds Elena Santos Dela Cruz.');
    }

    public function test_required_fields_and_future_dates_are_refused(): void
    {
        $this->addBaptism(['father' => '', 'date_of_baptism' => now()->addDay()->toDateString()])
            ->assertUnprocessable()
            ->assertJsonPath('errors', fn ($errors) => $errors['values.father'] === ['Enter the father.']
                && $errors['values.date_of_baptism'] === ['This date can’t be in the future.']);

        $this->assertDatabaseCount('sacramental_records', 0);
    }

    public function test_a_marriage_keeps_the_brides_maiden_name(): void
    {
        $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Marriage', 'book' => '3', 'page' => '10', 'line' => '1',
            'values' => [
                'groom' => 'Paolo Garcia', 'groom_s_date_of_birth' => '1990-01-01', 'groom_s_place_of_birth' => 'Davao City',
                'groom_s_parents' => 'Jose and Ana Garcia', 'groom_s_baptismal_parish' => 'San Pedro Cathedral',
                'bride' => 'Teresa Garcia (née Navarro)', 'bride_s_date_of_birth' => '1992-02-02', 'bride_s_place_of_birth' => 'Tagum',
                'bride_s_parents' => 'Luis and Carmen Navarro', 'bride_s_baptismal_parish' => 'Sacred Heart of Jesus Parish',
                'date_of_marriage' => '2020-12-12', 'place_of_marriage' => 'Sacred Heart of Jesus Parish', 'presiding_priest' => 'Fr. Antonio Reyes',
                'marriage_license_no' => '2020-1212-301', 'witnesses' => 'Mark Lim, Joy Tan',
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('entry.subject', 'Paolo & Teresa Garcia')
            ->assertJsonPath('entry.values.bride', 'Teresa Garcia (née Navarro)');
    }

    public function test_a_correction_waits_for_the_priest_and_applies_when_approved(): void
    {
        $id = $this->addBaptism()->json('entry.id');

        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => $this->baptism(['mother' => 'Maria Santos Dela Cruz'])])
            ->assertOk()
            ->assertJsonCount(1, 'entry.pending_correction.changes')
            ->assertJsonPath('entry.pending_correction.changes.0.field', 'Mother')
            ->assertJsonPath('entry.pending_correction.changes.0.from', 'Maria Santos')
            ->assertJsonPath('entry.pending_correction.changes.0.to', 'Maria Santos Dela Cruz')
            // The register itself is unchanged until the priest approves.
            ->assertJsonPath('entry.values.mother', 'Maria Santos');

        // Sending another replaces the one still waiting.
        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => $this->baptism(['mother' => 'Maria Cruz Santos'])])->assertOk();
        $this->assertDatabaseCount('sacramental_record_corrections', 1);

        $correction = $this->actingAs($this->priest)->getJson('/api/priest/record-corrections')
            ->assertOk()->assertJsonCount(1, 'data')->json('data.0.correction_id');

        $this->postJson("/api/priest/record-corrections/{$correction}/approve")
            ->assertOk()
            ->assertJsonPath('entry.values.mother', 'Maria Cruz Santos')
            ->assertJsonPath('entry.correction.to', 'Maria Cruz Santos')
            ->assertJsonPath('entry.pending_correction', null);

        $this->assertTrue(SacramentalRecord::query()->sole()->is_corrected);
        // The staff member who filed it hears back.
        $this->assertDatabaseHas('notifications', ['user_id' => $this->staff->user_id, 'kind' => 'priestDecisions', 'link' => "/secretary/sacraments?register=baptism&entry={$id}"]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'RECORD_CORRECTED', 'record_id_affected' => $id]);
        $this->postJson("/api/priest/record-corrections/{$correction}/approve")->assertConflict();
    }

    public function test_an_unchanged_correction_is_refused_and_a_rejection_needs_a_reason(): void
    {
        $id = $this->addBaptism()->json('entry.id');

        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => $this->baptism()])
            ->assertUnprocessable()->assertJsonValidationErrors('values');

        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => $this->baptism(['minister' => 'Fr. Miguel Torres'])])->assertOk();
        $correction = SacramentalRecord::query()->sole()->corrections()->sole();

        $this->actingAs($this->priest)->postJson("/api/priest/record-corrections/{$correction->correction_id}/reject", ['reason' => ''])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/priest/record-corrections/{$correction->correction_id}/reject", ['reason' => 'The book says Fr. Reyes.'])->assertOk()
            ->assertJsonPath('entry.values.minister', 'Fr. Antonio Reyes');
    }

    public function test_a_lookup_names_an_entry_at_the_same_place_in_another_register(): void
    {
        $this->addBaptism()->assertCreated();

        $this->getJson('/api/secretary/registers/lookup?record_type=Confirmation&book=12&page=48&line=3')
            ->assertOk()
            ->assertJsonPath('entry', null)
            ->assertJsonPath('elsewhere', [['register' => 'Baptism', 'subject' => 'Elena Santos Dela Cruz']]);
    }

    public function test_the_priest_reads_the_registers_with_corrections_still_waiting(): void
    {
        $id = $this->addBaptism()->json('entry.id');
        $this->postJson("/api/secretary/sacramental-records/{$id}/corrections", ['values' => $this->baptism(['mother' => 'Maria Santos Dela Cruz'])])->assertOk();

        $this->actingAs($this->priest)->getJson('/api/priest/sacramental-records?type=Baptism')
            ->assertOk()
            ->assertJsonPath('counts.Baptism', 1)
            ->assertJsonPath('counts.Burial', 0)
            ->assertJsonPath('waiting.Baptism', 1)
            ->assertJsonPath('waiting.Marriage', 0)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.values.mother', 'Maria Santos')
            ->assertJsonPath('data.0.pending_correction.changes.0.to', 'Maria Santos Dela Cruz');
        $this->getJson('/api/priest/sacramental-records?type=Wedding')->assertUnprocessable();
        $this->getJson('/api/priest/sacramental-records?type=Confirmation')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_only_staff_use_the_registers(): void
    {
        $this->actingAs($this->priest)->getJson('/api/secretary/sacramental-records?type=Baptism')->assertForbidden();
        $this->actingAs($this->staff)->getJson('/api/priest/record-corrections')->assertForbidden();
        $this->getJson('/api/priest/sacramental-records?type=Baptism')->assertForbidden();
    }
}

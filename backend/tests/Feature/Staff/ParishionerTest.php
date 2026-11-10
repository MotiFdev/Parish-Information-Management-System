<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Chapel;
use App\Models\Parishioner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ParishionerTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staff = User::factory()->role(UserRole::ParishStaff)->create();
    }

    /** @return array<string, mixed> */
    private function person(array $overrides = []): array
    {
        return [
            'first_name' => 'Ramon', 'middle_name' => 'Cruz', 'last_name' => 'Santos', 'suffix' => '',
            'sex' => 'Male', 'date_of_birth' => '1984-03-12', 'place_of_birth' => 'San Miguel',
            'contact_number' => '0917 555 0142', 'email' => 'ramon@example.com',
            'address_street' => 'Purok 3, Mabini St.', 'address_barangay' => 'Brgy. San Isidro', 'address_city' => 'San Miguel',
            'chapel_id' => Chapel::query()->where('approval_status', 'Approved')->value('chapel_id'),
            ...$overrides,
        ];
    }

    private function add(array $overrides = []): TestResponse
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/parishioners', $this->person($overrides));
    }

    public function test_staff_add_a_parishioner_and_link_their_parents(): void
    {
        $father = $this->add()->assertCreated()->json('data.id');
        $mother = $this->add(['first_name' => 'Maria', 'middle_name' => 'Lopez', 'sex' => 'Female', 'date_of_birth' => '1986-07-21'])->json('data.id');

        $child = $this->add(['first_name' => 'Juan', 'middle_name' => 'Lopez', 'date_of_birth' => '2012-09-04', 'father_id' => $father, 'mother_id' => $mother])
            ->assertCreated()
            ->assertJsonPath('data.father_id', $father)
            ->assertJsonPath('data.suffix', null)
            ->json('data.id');

        $this->getJson('/api/secretary/parishioners')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('sonas.0.chapels.0.id', fn ($id) => is_string($id));
        $this->assertDatabaseHas('audit_logs', ['action' => 'PARISHIONER_ADDED', 'record_id_affected' => $child]);
    }

    public function test_family_links_must_make_sense(): void
    {
        $father = $this->add()->json('data.id');
        $mother = $this->add(['first_name' => 'Maria', 'sex' => 'Female', 'date_of_birth' => '1986-07-21'])->json('data.id');

        // Wrong sex, and a parent born after the child.
        $this->add(['first_name' => 'Juan', 'date_of_birth' => '2012-09-04', 'father_id' => $mother])
            ->assertUnprocessable()->assertJsonPath('errors.father_id.0', 'Choose a man as the father.');
        $this->add(['first_name' => 'Juan', 'date_of_birth' => '1980-01-01', 'father_id' => $father])
            ->assertUnprocessable()->assertJsonPath('errors.father_id.0', 'The father must be born before this parishioner.');

        // A child can't become their parent's father.
        $child = $this->add(['first_name' => 'Juan', 'date_of_birth' => '2012-09-04', 'father_id' => $father])->json('data.id');
        $this->patchJson("/api/secretary/parishioners/{$father}", $this->person(['date_of_birth' => null, 'father_id' => $child]))
            ->assertUnprocessable()->assertJsonValidationErrors('date_of_birth');
        Parishioner::query()->whereKey($father)->update(['date_of_birth' => null]);
        $this->patchJson("/api/secretary/parishioners/{$father}", $this->person(['date_of_birth' => null, 'father_id' => $child]))
            ->assertUnprocessable()->assertJsonPath('errors.father_id.0', 'That person is this parishioner’s descendant, so they can’t be the father.');
    }

    public function test_a_person_from_the_register_can_be_edited_before_their_address_is_known(): void
    {
        $p = Parishioner::query()->create(['first_name' => 'Elena', 'last_name' => 'Dela Cruz', 'sex' => 'Female']);

        $this->actingAs($this->staff)->patchJson("/api/secretary/parishioners/{$p->parishioner_id}", ['first_name' => 'Elena Santos', 'last_name' => 'Dela Cruz', 'sex' => 'Female'])
            ->assertOk()
            ->assertJsonPath('data.first_name', 'Elena Santos');
        // But sex was known, so it can't be blanked.
        $this->patchJson("/api/secretary/parishioners/{$p->parishioner_id}", ['first_name' => 'Elena', 'last_name' => 'Dela Cruz'])
            ->assertUnprocessable()->assertJsonValidationErrors('sex');
        $this->assertDatabaseHas('audit_logs', ['action' => 'PARISHIONER_UPDATED', 'record_id_affected' => $p->parishioner_id]);
    }

    public function test_archiving_keeps_the_record_and_can_be_undone(): void
    {
        $id = $this->add()->json('data.id');

        $this->postJson("/api/secretary/parishioners/{$id}/archive")->assertOk()->assertJsonPath('data.is_archived', true);
        $this->postJson("/api/secretary/parishioners/{$id}/archive")->assertConflict();
        $this->postJson("/api/secretary/parishioners/{$id}/restore")->assertOk()->assertJsonPath('data.is_archived', false);
        $this->assertDatabaseCount('parishioners', 1);
    }

    public function test_only_staff_use_the_directory(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create())->getJson('/api/secretary/parishioners')->assertForbidden();
    }
}

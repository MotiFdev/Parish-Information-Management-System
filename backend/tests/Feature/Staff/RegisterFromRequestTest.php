<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\RecordRequest;
use App\Models\SacramentalRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegisterFromRequestTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    private User $priest;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/parishioner/requests/new']);
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create();
        $this->priest = User::factory()->role(UserRole::ParishPriest)->create();
    }

    private function newRegistration(bool $approved = true): RecordRequest
    {
        $number = $this->post('/api/public/record-requests', [
            'record_type' => 'Baptism', 'request_type' => 'New Registration',
            'full_name' => 'Jocelyn Pascual', 'relationship' => 'Parent', 'contact_number' => '0917 555 0142',
            'email' => 'jocelyn@example.com', 'address' => 'Purok 3, San Isidro', 'parish' => 'Sacred Heart of Jesus Parish',
            'purpose' => 'Personal copy', 'privacy_consent' => '1',
            'details' => [
                'fullName' => 'Sofia Lopez', 'birthDate' => '2026-08-30', 'birthPlace' => 'San Miguel', 'sex' => 'female',
                'baptismDate' => 'October 2026', 'baptismChurch' => 'Sacred Heart of Jesus Parish',
                'father' => 'Dennis Lopez', 'mother' => 'Jocelyn Pascual', 'godfather' => 'Carlos Mendoza', 'godmother' => 'Nina Soriano',
            ],
            'documents' => ['birthCert' => UploadedFile::fake()->create('birth.pdf', 300, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.request_number');

        $r = RecordRequest::where('request_number', $number)->sole();
        $base = "/api/secretary/record-requests/{$r->request_id}";
        $this->actingAs($this->staff)->postJson("{$base}/start")->assertOk();
        if ($approved) {
            $this->postJson("{$base}/documents/{$r->requestDocuments()->value('request_document_id')}/review", ['status' => 'Verified'])->assertOk();
            $this->postJson("{$base}/send")->assertOk();
            $this->actingAs($this->priest)->postJson("/api/priest/record-requests/{$r->request_id}/approve")->assertOk();
        }

        return $r->refresh();
    }

    public function test_an_approved_new_registration_fills_the_entry_form(): void
    {
        $r = $this->newRegistration();

        $this->actingAs($this->staff)->getJson("/api/secretary/record-requests/{$r->request_id}/entry-draft")
            ->assertOk()
            ->assertJsonPath('type', 'Baptism')
            ->assertJsonPath('values.baptized', 'Sofia Lopez')
            ->assertJsonPath('values.sex', 'Female')
            ->assertJsonPath('values.date_of_birth', '2026-08-30')
            ->assertJsonPath('values.godparents', 'Carlos Mendoza, Nina Soriano')
            // An approximate date isn't guessed; staff see what was written.
            ->assertJsonMissingPath('values.date_of_baptism')
            ->assertJsonPath('notes.0', 'Date of baptism: the requester wrote “October 2026”. Enter it as written in the register.');
    }

    public function test_only_an_approved_new_registration_has_a_draft(): void
    {
        $r = $this->newRegistration(approved: false);

        $this->actingAs($this->staff)->getJson("/api/secretary/record-requests/{$r->request_id}/entry-draft")
            ->assertConflict()
            ->assertJsonPath('message', 'The priest has to approve this request before its register entry is made.');
    }

    public function test_saving_the_entry_links_it_to_the_request(): void
    {
        $r = $this->newRegistration();
        $values = $this->actingAs($this->staff)->getJson("/api/secretary/record-requests/{$r->request_id}/entry-draft")->json('values');
        $entry = [
            'type' => 'Baptism', 'book' => '14', 'page' => '171', 'line' => '1', 'request_id' => $r->request_id,
            'values' => [...$values, 'date_of_baptism' => '2026-10-18', 'minister' => 'Fr. Antonio Reyes'],
        ];

        $id = $this->postJson('/api/secretary/sacramental-records', $entry)->assertCreated()->json('entry.id');

        $r->refresh();
        $this->assertSame(['14', '171', '1', $id], [$r->register_book, $r->register_page, $r->register_line, $r->record_id]);
        $this->assertSame($r->request_id, SacramentalRecord::query()->find($id)->source_request_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'REGISTER_LINKED', 'record_id_affected' => $r->request_id]);
        // The request can now be released.
        $this->postJson("/api/secretary/record-requests/{$r->request_id}/ready")->assertOk();

        // A second entry from the same request is refused, and nothing is saved.
        $this->getJson("/api/secretary/record-requests/{$r->request_id}/entry-draft")->assertConflict();
        $this->postJson('/api/secretary/sacramental-records', [...$entry, 'line' => '2'])
            ->assertUnprocessable()->assertJsonValidationErrors('request_id');
        $this->assertDatabaseCount('sacramental_records', 1);
    }
}

<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Document;
use App\Models\Parishioner;
use App\Models\RecordRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
    }

    private function baptismEntry(): string
    {
        return $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Baptism', 'book' => '12', 'page' => '48', 'line' => '3',
            'values' => [
                'baptized' => 'Elena Santos Dela Cruz', 'sex' => 'Female', 'date_of_birth' => '2019-05-02', 'place_of_birth' => 'Davao City',
                'date_of_baptism' => '2019-06-18', 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
                'father' => 'Ramon Dela Cruz', 'mother' => 'Maria Santos', 'godparents' => 'Victor Tan, Rosa Uy',
            ],
        ])->assertCreated()->json('entry.id');
    }

    public function test_a_scan_uploaded_to_an_entry_shows_on_that_entry(): void
    {
        $entry = $this->baptismEntry();

        $this->post('/api/secretary/documents', [
            'file' => UploadedFile::fake()->create('book-12-page-48.pdf', 400, 'application/pdf'), 'link' => 'register', 'target_id' => $entry,
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.file_type', 'PDF')
            ->assertJsonPath('data.uploaded_by', 'Liza Mercado')
            ->assertJsonPath('data.link.title', 'Baptism register')
            ->assertJsonPath('data.link.detail', 'Elena Santos Dela Cruz · book 12, page 48');

        $document = Document::query()->sole();
        Storage::disk('local')->assertExists($document->file_path);
        $this->getJson('/api/secretary/sacramental-records?type=Baptism')->assertJsonPath('data.0.scans.0.document_id', $document->document_id);
        $this->assertDatabaseHas('audit_logs', ['action' => 'DOCUMENT_ADDED', 'record_id_affected' => $document->document_id]);
    }

    public function test_an_unfiled_scan_can_be_filed_later(): void
    {
        $id = $this->actingAs($this->staff)->post('/api/secretary/documents', [
            'file' => UploadedFile::fake()->image('scan-001.jpg'), 'link' => 'none',
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.link.kind', 'none')->json('data.id');
        $person = Parishioner::query()->create(['first_name' => 'Maria', 'last_name' => 'Santos', 'sex' => 'Female']);

        $this->patchJson("/api/secretary/documents/{$id}/link", ['link' => 'parishioner', 'target_id' => $person->parishioner_id, 'label' => 'Valid ID'])
            ->assertOk()
            ->assertJsonPath('data.link.title', 'Maria Santos')
            ->assertJsonPath('data.link.detail', 'Valid ID');
        $this->patchJson("/api/secretary/documents/{$id}/link", ['link' => 'register'])->assertUnprocessable()->assertJsonValidationErrors('target_id');

        $this->getJson('/api/secretary/documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('targets.parishioners.0.name', 'Maria Santos');
    }

    public function test_a_requesters_upload_stays_with_its_request(): void
    {
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/parishioner/requests/new']);
        $this->post('/api/public/record-requests', [
            'record_type' => 'Baptism', 'request_type' => 'Certificate Request', 'full_name' => 'Maria Santos', 'relationship' => 'Parent',
            'contact_number' => '0917 555 0142', 'email' => 'maria@example.com', 'address' => 'Purok 3', 'parish' => 'Sacred Heart of Jesus Parish',
            'purpose' => 'Personal copy', 'privacy_consent' => '1',
            'details' => ['fullName' => 'Juan Santos', 'birthDate' => '2015-04-02', 'baptismDate' => 'May 2015', 'baptismChurch' => 'Sacred Heart', 'father' => 'Pedro Santos', 'mother' => 'Maria Santos'],
            'documents' => ['birthCert' => UploadedFile::fake()->create('birth.pdf', 300, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();
        $document = Document::query()->sole();

        $this->actingAs($this->staff)->getJson('/api/secretary/documents')
            ->assertJsonPath('data.0.uploaded_by', 'Maria Santos (requester)')
            ->assertJsonPath('data.0.movable', false)
            ->assertJsonPath('data.0.link.kind', 'request');
        $this->patchJson("/api/secretary/documents/{$document->document_id}/link", ['link' => 'none'])->assertConflict();

        // Staff can add a file to a request still being checked; it waits to be verified like the others.
        $request = RecordRequest::query()->sole();
        $this->post('/api/secretary/documents', [
            'file' => UploadedFile::fake()->create('id.pdf', 100, 'application/pdf'), 'link' => 'request', 'target_id' => $request->request_id, 'label' => 'Valid ID',
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.link.detail', 'Valid ID · Juan Santos');
        $this->assertSame(2, $request->requestDocuments()->count());
    }

    public function test_only_staff_use_documents(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create())->getJson('/api/secretary/documents')->assertForbidden();
    }
}

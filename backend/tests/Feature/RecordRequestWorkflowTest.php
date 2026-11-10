<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Notification;
use App\Models\RecordRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class RecordRequestWorkflowTest extends TestCase
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
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->priest = User::factory()->role(UserRole::ParishPriest)->create(['first_name' => 'Antonio', 'last_name' => 'Reyes']);
    }

    /**
     * @return array<string, mixed>
     */
    private function form(array $overrides = []): array
    {
        return [
            'record_type' => 'Baptism',
            'request_type' => 'Certificate Request',
            'full_name' => 'Maria Santos',
            'relationship' => 'Parent',
            'contact_number' => '0917 555 0142',
            'email' => 'maria@example.com',
            'address' => 'Purok 3, San Isidro, San Miguel',
            'parish' => 'Sacred Heart of Jesus Parish',
            'purpose' => 'Other',
            'purpose_other' => 'School enrollment',
            'details' => [
                'fullName' => 'Juan Santos', 'birthDate' => '2015-04-02', 'baptismDate' => 'May 2015',
                'baptismChurch' => 'Sacred Heart of Jesus Parish', 'father' => 'Pedro Santos', 'mother' => 'Maria Santos (née Cruz)',
            ],
            'documents' => ['birthCert' => UploadedFile::fake()->create('birth.pdf', 300, 'application/pdf')],
            'privacy_consent' => '1',
            ...$overrides,
        ];
    }

    private function submit(array $overrides = []): RecordRequest
    {
        $number = $this->post('/api/public/record-requests', $this->form($overrides), ['Accept' => 'application/json'])
            ->assertCreated()->json('data.request_number');

        return RecordRequest::where('request_number', $number)->sole();
    }

    private function track(RecordRequest $r): TestResponse
    {
        return $this->getJson("/api/public/record-requests/{$r->request_number}")->assertOk();
    }

    public function test_submitting_stores_the_request_and_its_file_privately(): void
    {
        $r = $this->submit();

        $this->assertMatchesRegularExpression('/^RR-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/', $r->request_number);
        $this->assertNull($r->requested_by_user_id);
        $this->assertSame('Maria Santos', $r->client_full_name);
        $this->assertSame('Other: School enrollment', $r->purpose);
        $this->assertSame('Juan Santos', $r->subject_details['fields']['fullName']);
        $doc = $r->requestDocuments()->with('document')->sole();
        $this->assertSame('PSA birth certificate', $doc->title);
        Storage::disk('local')->assertExists($doc->document->file_path);
        $this->assertNull($doc->document->uploaded_by_user_id);
        $this->assertTrue(AuditLog::where('action', 'REQUEST_SUBMITTED')->whereNull('user_id')->exists());
    }

    public function test_tracking_by_reference_shows_progress_but_not_personal_details(): void
    {
        $r = $this->submit();

        $response = $this->track($r)
            ->assertJsonPath('data.request_number', $r->request_number)
            ->assertJsonPath('data.subject', 'Juan Santos')
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.documents.0.title', 'PSA birth certificate')
            ->assertJsonPath('data.documents.0.file.file_name', 'birth.pdf')
            ->assertJsonMissingPath('data.client')
            ->assertJsonMissingPath('data.details')
            ->assertJsonMissingPath('data.register')
            ->assertJsonMissingPath('data.documents.0.file.document_id');

        foreach (['09175550142', 'maria@example.com', 'Purok 3', 'Pedro Santos', $r->request_id] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }

        // Typed in lower case and without dashes, it still finds the request.
        $this->getJson('/api/public/record-requests/'.strtolower(str_replace('-', '', $r->request_number)))->assertOk();
        $this->getJson('/api/public/record-requests/RR-2222-2222')->assertNotFound();
        $this->getJson('/api/public/record-requests/'.$r->request_id)->assertNotFound();
    }

    public function test_required_details_and_documents_depend_on_the_request_type(): void
    {
        $this->post('/api/public/record-requests', $this->form(['full_name' => '', 'documents' => [], 'details' => ['fullName' => 'Juan'], 'privacy_consent' => '0']), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['full_name', 'documents.birthCert', 'details.birthDate', 'details.father', 'privacy_consent']);

        // New Registration also needs the fields that are optional for a certificate.
        $this->post('/api/public/record-requests', $this->form(['request_type' => 'New Registration']), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors(['details.birthPlace', 'details.godfather']);

        // A correction needs the old and new values and a proof document.
        $this->post('/api/public/record-requests', $this->form(['request_type' => 'Record Correction']), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors(['details.correctionField', 'details.correctValue', 'documents.proof']);

        $this->post('/api/public/record-requests', $this->form(['documents' => ['birthCert' => UploadedFile::fake()->create('virus.exe', 10)]]), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors(['documents.birthCert']);
    }

    public function test_only_the_office_can_open_uploaded_files(): void
    {
        $r = $this->submit();
        $documentId = $r->requestDocuments()->value('document_id');

        $this->getJson("/api/documents/{$documentId}/link")->assertUnauthorized();
        $this->actingAs(User::factory()->role(UserRole::SystemAdministrator)->create())->getJson("/api/documents/{$documentId}/link")->assertNotFound();

        $url = $this->actingAs($this->staff)->getJson("/api/documents/{$documentId}/link")->assertOk()->json('url');
        $this->get($url)->assertOk();
        // The file route refuses anything without a valid signature.
        $this->get("/api/documents/{$documentId}/file")->assertForbidden();
        $this->get($url.'x')->assertForbidden();
    }

    public function test_full_certificate_workflow(): void
    {
        $r = $this->submit();
        $doc = $r->requestDocuments()->sole();
        $base = "/api/secretary/record-requests/{$r->request_id}";

        $this->actingAs($this->staff)->postJson("{$base}/send")->assertConflict();
        $this->postJson("{$base}/start")->assertOk()->assertJsonPath('data.status', 'Under Verification')->assertJsonPath('data.handled_by', 'Liza Mercado');

        // Can't send yet: document unchecked, no register entry.
        $this->postJson("{$base}/send")->assertUnprocessable()->assertJsonValidationErrors(['documents']);
        $this->postJson("{$base}/documents/{$doc->request_document_id}/review", ['status' => 'Verified'])->assertOk()->assertJsonPath('data.documents.0.status', 'Verified');
        $this->postJson("{$base}/send")->assertUnprocessable()->assertJsonValidationErrors(['register']);

        $this->getJson('/api/secretary/registers/lookup?record_type=Baptism&book=12&page=45&line=3')->assertOk()->assertJsonPath('entry', null);
        $this->postJson("{$base}/register", ['book' => '12', 'page' => '45', 'line' => '3'])->assertOk()->assertJsonPath('data.register.book', '12');
        $this->postJson("{$base}/remarks", ['body' => 'Entry found in book 12.'])->assertOk()->assertJsonPath('data.remarks.0.by', 'Liza Mercado');
        $this->postJson("{$base}/send")->assertOk()->assertJsonPath('data.with_priest', true);

        // Staff can't change it while it is with the priest; staff can't approve.
        $this->postJson("{$base}/remarks", ['body' => 'Late remark'])->assertConflict();
        $this->postJson("/api/priest/record-requests/{$r->request_id}/approve")->assertForbidden();

        $this->actingAs($this->priest)->getJson('/api/priest/record-requests')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/priest/record-requests/{$r->request_id}/approve")->assertOk()->assertJsonPath('data.status', 'Approved')->assertJsonPath('data.decided_by', 'Fr. Antonio Reyes');
        $this->postJson("/api/priest/record-requests/{$r->request_id}/approve")->assertConflict();

        $this->actingAs($this->staff)->postJson("{$base}/complete")->assertConflict();
        $this->postJson("{$base}/ready")->assertOk()->assertJsonPath('data.status', 'Ready for Collection');
        $this->postJson("{$base}/complete")->assertOk()->assertJsonPath('data.status', 'Completed');

        foreach (['REQUEST_STATUS_CHANGED', 'DOCUMENT_VERIFIED', 'REGISTER_LINKED', 'REQUEST_SENT_TO_PRIEST', 'REQUEST_APPROVED', 'CERTIFICATE_RELEASED'] as $action) {
            $this->assertTrue(AuditLog::where('action', $action)->where('record_id_affected', $r->request_id)->exists(), $action);
        }
        // A public request has no inbox; the requester follows it by reference and sees the remark.
        $this->assertSame(0, Notification::where('request_id', $r->request_id)->whereNull('kind')->count());
        // The office bell: staff hear of the new request and the priest's decision; the priest of what waits for him.
        $this->assertSame(['newRequests', 'priestDecisions'], Notification::where('user_id', $this->staff->user_id)->pluck('kind')->sort()->values()->all());
        $this->assertSame(1, Notification::where('user_id', $this->priest->user_id)->where('kind', 'approvals')->count());
        $this->track($r)->assertJsonPath('data.status', 'Completed')->assertJsonPath('data.remarks.0.body', 'Entry found in book 12.');
    }

    public function test_resubmission_and_additional_documents(): void
    {
        $r = $this->submit();
        $doc = $r->requestDocuments()->sole();
        $base = "/api/secretary/record-requests/{$r->request_id}";
        $this->actingAs($this->staff)->postJson("{$base}/start")->assertOk();

        $this->postJson("{$base}/documents/{$doc->request_document_id}/review", ['status' => 'Needs Resubmission'])->assertUnprocessable()->assertJsonValidationErrors(['note']);
        $this->postJson("{$base}/documents/{$doc->request_document_id}/review", ['status' => 'Needs Resubmission', 'note' => 'The scan is too blurry to read.'])
            ->assertOk()->assertJsonPath('data.remarks.0.kind', 'requirement');
        $added = $this->postJson("{$base}/requirements", ['labels' => ['Valid ID'], 'message' => 'We need your ID to release this.'])
            ->assertOk()->json('data.documents');
        $placeholder = collect($added)->firstWhere('file', null)['request_document_id'];

        // Uploads go through the reference number. A verified document can't be replaced; the flagged one and the requested one can.
        $base = "/api/public/record-requests/{$r->request_number}/documents";
        $file = fn () => ['file' => UploadedFile::fake()->image('clear.jpg')];
        $this->post("{$base}/{$doc->request_document_id}", $file(), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.documents.0.status', 'Pending');
        $this->post("{$base}/{$placeholder}", $file(), ['Accept' => 'application/json'])->assertOk();
        $this->post("{$base}/{$placeholder}", $file(), ['Accept' => 'application/json'])->assertConflict();
        $this->assertSame(3, Document::count());
    }

    public function test_a_reference_only_uploads_to_its_own_request(): void
    {
        $mine = $this->submit();
        $other = $this->submit();
        $othersDocument = $other->requestDocuments()->value('request_document_id');

        $this->post("/api/public/record-requests/{$mine->request_number}/documents/{$othersDocument}", ['file' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertNotFound();
        $this->post("/api/public/record-requests/RR-2222-2222/documents/{$othersDocument}", ['file' => UploadedFile::fake()->image('x.jpg')], ['Accept' => 'application/json'])
            ->assertNotFound();
        $this->assertSame(2, Document::count());
    }

    public function test_priest_rejection_needs_a_reason_and_new_registration_needs_its_entry_before_release(): void
    {
        $r = $this->submit(['request_type' => 'New Registration', 'details' => [
            'fullName' => 'Sofia Lopez', 'birthDate' => '2026-08-30', 'birthPlace' => 'San Miguel', 'sex' => 'Female', 'baptismDate' => '2026-10-18',
            'baptismChurch' => 'Sacred Heart', 'father' => 'Dennis Lopez', 'mother' => 'Jocelyn Pascual', 'godfather' => 'Carlos Mendoza', 'godmother' => 'Nina Soriano',
        ]]);
        $base = "/api/secretary/record-requests/{$r->request_id}";
        $this->actingAs($this->staff)->postJson("{$base}/start");
        $this->postJson("{$base}/documents/{$r->requestDocuments()->value('request_document_id')}/review", ['status' => 'Verified']);
        // No register entry needed before approval for a new registration.
        $this->postJson("{$base}/send")->assertOk();

        $this->actingAs($this->priest)->postJson("/api/priest/record-requests/{$r->request_id}/reject", ['reason' => 'no'])->assertUnprocessable();
        $this->postJson("/api/priest/record-requests/{$r->request_id}/approve")->assertOk();

        $this->actingAs($this->staff)->postJson("{$base}/ready")->assertUnprocessable()->assertJsonValidationErrors(['register']);
        $this->postJson("{$base}/register", ['book' => '14', 'page' => '171', 'line' => '1'])->assertOk();
        $this->postJson("{$base}/ready")->assertOk();
    }

    public function test_staff_send_details_back_and_the_requester_corrects_them(): void
    {
        $r = $this->submit();
        $base = "/api/secretary/record-requests/{$r->request_id}";
        $public = "/api/public/record-requests/{$r->request_number}";
        $this->actingAs($this->staff)->postJson("{$base}/start")->assertOk();
        $this->postJson("{$base}/documents/{$r->requestDocuments()->value('request_document_id')}/review", ['status' => 'Verified'])->assertOk();

        $this->postJson("{$base}/return-details", ['note' => 'short'])->assertUnprocessable()->assertJsonValidationErrors('note');
        $this->postJson("{$base}/return-details", ['note' => 'The date of birth does not match the birth certificate.'])
            ->assertOk()
            ->assertJsonPath('data.details_returned.note', 'The date of birth does not match the birth certificate.');
        // It can't go to the priest until the requester answers.
        $this->postJson("{$base}/send")->assertUnprocessable()->assertJsonValidationErrors('details');

        // The requester sees what to fix, but not the details themselves, from the reference alone.
        $this->track($r)->assertJsonPath('data.details_returned.note', 'The date of birth does not match the birth certificate.')->assertJsonMissingPath('data.details');
        $this->postJson("{$public}/details/unlock", ['email' => 'someone@example.com'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson("{$public}/details/unlock", ['email' => 'MARIA@example.com'])->assertOk()->assertJsonPath('details.birthDate', '2015-04-02');

        $details = [
            'fullName' => 'Juan Santos', 'birthDate' => '2015-04-12', 'baptismDate' => 'May 2015',
            'baptismChurch' => 'Sacred Heart of Jesus Parish', 'father' => 'Pedro Santos', 'mother' => 'Maria Santos (née Cruz)',
        ];
        $this->putJson("{$public}/details", ['email' => 'maria@example.com', 'details' => [...$details, 'fullName' => '']])
            ->assertUnprocessable()->assertJsonValidationErrors('details.fullName');
        $this->putJson("{$public}/details", ['email' => 'maria@example.com', 'details' => $details])
            ->assertOk()->assertJsonPath('data.details_returned', null);

        $this->assertSame('2015-04-12', $r->fresh()->subject_details['fields']['birthDate']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'REQUEST_DETAILS_UPDATED', 'record_id_affected' => $r->request_id]);
        $this->postJson("{$public}/details/unlock", ['email' => 'maria@example.com'])->assertConflict();

        $this->actingAs($this->staff)->getJson('/api/secretary/record-requests')->assertJsonPath('data.0.details.birthDate', '2015-04-12');
        $this->postJson("{$base}/register", ['book' => '3', 'page' => '20', 'line' => '4'])->assertOk();
        $this->postJson("{$base}/send")->assertOk();
    }

    public function test_rejected_by_the_priest_shows_the_reason_to_the_requester(): void
    {
        $r = $this->submit();
        $base = "/api/secretary/record-requests/{$r->request_id}";
        $this->actingAs($this->staff)->postJson("{$base}/start");
        $this->postJson("{$base}/documents/{$r->requestDocuments()->value('request_document_id')}/review", ['status' => 'Verified']);
        $this->postJson("{$base}/register", ['book' => '1', 'page' => '2', 'line' => '3']);
        $this->postJson("{$base}/send")->assertOk();

        $this->actingAs($this->priest)->postJson("/api/priest/record-requests/{$r->request_id}/reject", ['reason' => 'The entry belongs to a different person.'])->assertOk();

        $this->track($r)
            ->assertJsonPath('data.status', 'Rejected')->assertJsonPath('data.rejection_reason', 'The entry belongs to a different person.');
    }

    public function test_roles_are_enforced(): void
    {
        $r = $this->submit();

        $this->getJson('/api/secretary/record-requests')->assertUnauthorized();
        $this->actingAs($this->priest)->postJson("/api/secretary/record-requests/{$r->request_id}/start")->assertForbidden();
    }
}

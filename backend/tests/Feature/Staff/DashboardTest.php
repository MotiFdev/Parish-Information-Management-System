<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\RecordRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DashboardTest extends TestCase
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

    private function submit(string $subject): RecordRequest
    {
        $number = $this->post('/api/public/record-requests', [
            'record_type' => 'Baptism', 'request_type' => 'Certificate Request', 'full_name' => 'Maria Santos', 'relationship' => 'Parent',
            'contact_number' => '0917 555 0142', 'email' => 'maria@example.com', 'address' => 'Purok 3, San Isidro', 'parish' => 'Sacred Heart of Jesus Parish',
            'purpose' => 'Personal copy', 'privacy_consent' => '1',
            'details' => ['fullName' => $subject, 'birthDate' => '2015-04-02', 'baptismDate' => 'May 2015', 'baptismChurch' => 'Sacred Heart of Jesus Parish', 'father' => 'Pedro Santos', 'mother' => 'Maria Cruz'],
            'documents' => ['birthCert' => UploadedFile::fake()->create('birth.pdf', 300, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.request_number');

        return RecordRequest::where('request_number', $number)->sole();
    }

    private function book(string $status, CarbonImmutable $start): void
    {
        Appointment::query()->forceCreate([
            'event_type' => 'Mass Intention', 'event_title' => "Mass ({$status})", 'status' => $status, 'venue_type' => 'Parish Church',
            'scheduled_start' => $start, 'scheduled_end' => $start->addHour(),
            'requester_name' => 'Maria Santos', 'requester_contact' => '09175550142', 'privacy_consent' => true,
            'reference_number' => 'AP-'.strtoupper(substr(md5(uniqid()), 0, 9)),
        ]);
    }

    public function test_the_dashboard_shows_the_office_queue_the_week_and_recent_work(): void
    {
        $this->submit('Juan Santos');
        $checking = $this->submit('Ana Santos');
        $this->actingAs($this->staff)->postJson("/api/secretary/record-requests/{$checking->request_id}/start")->assertOk();

        $tomorrow = CarbonImmutable::now()->addDay();
        $this->book('Pending', $tomorrow);
        $this->book('Rejected', $tomorrow);
        $this->book('Approved', $tomorrow->addDays(9));

        $response = $this->getJson('/api/secretary/dashboard')
            ->assertOk()
            ->assertJsonCount(2, 'requests')
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.status', 'Pending')
            ->assertJsonPath('registers.Baptism', fn ($n) => is_int($n))
            ->assertJsonPath('ai', ['ready' => false, 'strong' => 0.75])
            ->assertJsonPath('activity.0.by', 'Liza Mercado')
            ->assertJsonPath('activity.0.record', $checking->request_number);

        $queue = collect($response->json('requests'))->keyBy('subject');
        $this->assertSame('Pending', $queue['Juan Santos']['status']);
        $this->assertSame(['total' => 1, 'verified' => 0, 'resubmit' => 0], $queue['Juan Santos']['documents']);
        $this->assertSame('Under Verification', $queue['Ana Santos']['status']);
        $this->assertSame('Liza Mercado', $queue['Ana Santos']['assignee']);
    }

    public function test_only_staff_open_the_dashboard(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create())->getJson('/api/secretary/dashboard')->assertForbidden();
    }
}

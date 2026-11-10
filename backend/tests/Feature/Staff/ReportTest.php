<?php

namespace Tests\Feature\Staff;

use App\Enums\UserRole;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Chapel;
use App\Models\RecordRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->travelTo(CarbonImmutable::parse('2026-11-09 10:00', 'Asia/Manila'));
    }

    private function report(array $query)
    {
        return $this->actingAs($this->staff)->getJson('/api/secretary/reports?'.http_build_query($query));
    }

    public function test_the_daily_log_lists_the_offices_work_on_one_day(): void
    {
        $at = fn (string $t) => CarbonImmutable::parse("2026-11-09 {$t}", 'Asia/Manila')->utc();
        AuditLog::query()->forceCreate(['user_id' => $this->staff->user_id, 'action' => 'REQUEST_SENT_TO_PRIEST', 'table_affected' => 'record_requests', 'record_id_affected' => 'x', 'ip_address' => '127.0.0.1', 'details' => ['request_number' => 'RR-7K3M-9QX2'], 'timestamp' => $at('09:15')]);
        // Sign-ins are the administrator's, and other days don't count.
        AuditLog::query()->forceCreate(['user_id' => $this->staff->user_id, 'action' => 'LOGIN', 'table_affected' => 'users', 'record_id_affected' => 'x', 'ip_address' => '127.0.0.1', 'timestamp' => $at('08:00')]);
        AuditLog::query()->forceCreate(['user_id' => $this->staff->user_id, 'action' => 'REQUEST_SENT_TO_PRIEST', 'table_affected' => 'record_requests', 'record_id_affected' => 'y', 'ip_address' => '127.0.0.1', 'timestamp' => $at('09:15')->subDay()]);

        $this->report(['type' => 'daily', 'date' => '2026-11-09'])
            ->assertOk()
            ->assertJsonCount(1, 'report.rows')
            ->assertJsonPath('report.rows.0.0', '9:15 AM')
            ->assertJsonPath('report.rows.0.1', 'Liza Mercado')
            ->assertJsonPath('report.rows.0.3', 'RR-7K3M-9QX2')
            ->assertJsonPath('options.people', ['Liza Mercado']);

        $this->report(['type' => 'daily', 'date' => '2026-11-10'])->assertUnprocessable()->assertJsonValidationErrors('date');
    }

    public function test_the_sacramental_count_follows_the_register(): void
    {
        $this->actingAs($this->staff)->postJson('/api/secretary/sacramental-records', [
            'type' => 'Baptism', 'book' => '12', 'page' => '48', 'line' => '3',
            'values' => [
                'baptized' => 'Elena Santos Dela Cruz', 'sex' => 'Female', 'date_of_birth' => '2026-05-02', 'place_of_birth' => 'Davao City',
                'date_of_baptism' => '2026-06-18', 'place_of_baptism' => 'Sacred Heart of Jesus Parish', 'minister' => 'Fr. Antonio Reyes',
                'father' => 'Ramon Dela Cruz', 'mother' => 'Maria Santos', 'godparents' => 'Victor Tan, Rosa Uy',
            ],
        ])->assertCreated();

        $this->report(['type' => 'sacramental', 'from' => '2026-05', 'to' => '2026-07', 'sacraments' => ['Baptism', 'Burial']])
            ->assertOk()
            ->assertJsonPath('report.columns', ['Month', 'Baptisms', 'Burials', 'Total'])
            ->assertJsonPath('report.rows.1', ['Jun 2026', 1, 0, 1])
            ->assertJsonPath('report.total', ['Total', 1, 0, 1])
            ->assertJsonPath('report.period', 'May 2026 to July 2026');

        $this->report(['type' => 'sacramental', 'from' => '2026-07', 'to' => '2026-05', 'sacraments' => ['Baptism']])
            ->assertUnprocessable()->assertJsonPath('errors.from.0', 'The start month is after the end month.');
    }

    public function test_turnaround_counts_days_to_ready_for_collection(): void
    {
        $this->withHeaders(['Origin' => 'http://localhost:5173', 'Referer' => 'http://localhost:5173/parishioner/requests/new']);
        $this->post('/api/public/record-requests', [
            'record_type' => 'Baptism', 'request_type' => 'Certificate Request', 'full_name' => 'Maria Santos', 'relationship' => 'Parent',
            'contact_number' => '0917 555 0142', 'email' => 'maria@example.com', 'address' => 'Purok 3', 'parish' => 'Sacred Heart of Jesus Parish',
            'purpose' => 'Personal copy', 'privacy_consent' => '1',
            'details' => ['fullName' => 'Juan Santos', 'birthDate' => '2015-04-02', 'baptismDate' => 'May 2015', 'baptismChurch' => 'Sacred Heart', 'father' => 'Pedro Santos', 'mother' => 'Maria Santos'],
            'documents' => ['birthCert' => UploadedFile::fake()->create('birth.pdf', 300, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();
        RecordRequest::query()->update(['requested_at' => CarbonImmutable::parse('2026-10-01 09:00', 'Asia/Manila')->utc(), 'ready_at' => CarbonImmutable::parse('2026-10-05 16:00', 'Asia/Manila')->utc()]);

        $this->report(['type' => 'turnaround', 'from' => '2026-10', 'to' => '2026-11', 'group_by' => 'requestType'])
            ->assertOk()
            ->assertJsonPath('report.rows', [['Certificate Request', 1, 4, 4, 4]])
            ->assertJsonPath('report.total', ['All requests', 1, 4, 4, 4]);
    }

    public function test_appointments_by_chapel_counts_decided_requests_per_venue(): void
    {
        $chapel = Chapel::query()->where('approval_status', 'Approved')->firstOrFail();
        $book = fn (string $status, array $venue) => Appointment::query()->forceCreate([
            'event_type' => 'Mass Intention', 'event_title' => 'Mass Intention', 'status' => $status,
            'scheduled_start' => CarbonImmutable::parse('2026-10-10 08:00', 'Asia/Manila'), 'scheduled_end' => CarbonImmutable::parse('2026-10-10 09:00', 'Asia/Manila'),
            'requester_name' => 'Maria Santos', 'requester_contact' => '09175550142', 'privacy_consent' => true,
            'reference_number' => 'AP-'.strtoupper(substr(md5(uniqid()), 0, 9)), ...$venue,
        ]);
        $book('Approved', ['venue_type' => 'Chapel', 'chapel_id' => $chapel->chapel_id]);
        $book('Rejected', ['venue_type' => 'Chapel', 'chapel_id' => $chapel->chapel_id]);
        $book('Pending', ['venue_type' => 'Parish Church']);

        $this->report(['type' => 'appointments', 'from' => '2026-10', 'to' => '2026-10'])
            ->assertOk()
            ->assertJsonPath('report.total', ['Total', '', 1, 1, 2])
            ->assertJsonPath('report.chart.items.0', ['label' => $chapel->name, 'value' => 2]);
    }

    public function test_only_staff_see_reports(): void
    {
        $this->actingAs(User::factory()->role(UserRole::ParishPriest)->create())
            ->getJson('/api/secretary/reports?type=daily&date=2026-11-09')->assertForbidden();
    }
}

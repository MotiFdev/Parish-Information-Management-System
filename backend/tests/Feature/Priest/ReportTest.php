<?php

namespace Tests\Feature\Priest;

use App\Enums\UserRole;
use App\Models\Chapel;
use App\Models\Offering;
use App\Models\Parishioner;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private User $priest;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->priest = User::factory()->role(UserRole::ParishPriest)->create(['first_name' => 'Antonio', 'last_name' => 'Reyes']);
        $this->staff = User::factory()->role(UserRole::ParishStaff)->create(['first_name' => 'Liza', 'last_name' => 'Mercado']);
        $this->travelTo(CarbonImmutable::parse('2026-11-09 10:00', 'Asia/Manila'));
    }

    private function report(array $query)
    {
        return $this->actingAs($this->priest)->getJson('/api/priest/reports?'.http_build_query($query));
    }

    public function test_the_demographic_report_counts_the_directory_by_sona_age_and_sex(): void
    {
        Parishioner::query()->delete();
        $chapel = Chapel::query()->with('sona')->where('approval_status', 'Approved')->firstOrFail();
        $person = fn (array $a) => Parishioner::query()->create(['first_name' => 'A', 'last_name' => 'B', ...$a]);
        $person(['sex' => 'Female', 'date_of_birth' => '2010-01-01', 'chapel_id' => $chapel->chapel_id]);
        $person(['sex' => 'Male', 'date_of_birth' => '1960-11-10', 'chapel_id' => $chapel->chapel_id]);
        $person(['sex' => null, 'date_of_birth' => null]);
        $person(['sex' => 'Female', 'is_archived' => true]);

        $sona = collect($this->report(['type' => 'demographic', 'group_by' => 'sona'])->assertOk()->json('report.rows'))->keyBy(0);
        $this->assertSame([$chapel->sona->name, 2, 1, 1, 0], $sona[$chapel->sona->name]);
        $this->assertSame(['No chapel on file', 1, 0, 0, 1], $sona['No chapel on file']);

        // Born November 10, 1960: still 65 the day before the birthday.
        $this->report(['type' => 'demographic', 'group_by' => 'age'])
            ->assertJsonPath('report.rows.0', ['Under 18', 1, '33.3%'])
            ->assertJsonPath('report.rows.3', ['60 and over', 1, '33.3%'])
            ->assertJsonPath('report.rows.4.0', 'Birthdate not recorded')
            ->assertJsonPath('report.total.1', 3);

        $this->report(['type' => 'demographic', 'group_by' => 'sex'])
            ->assertJsonPath('report.rows', [['Female', 1, '33.3%'], ['Male', 1, '33.3%'], ['Not recorded', 1, '33.3%']]);
    }

    public function test_the_financial_report_adds_up_the_offerings_ledger(): void
    {
        $this->actingAs($this->staff)->postJson('/api/offerings', ['category' => 'Sunday collection', 'amount' => '12500.50', 'received_on' => '2026-11-08', 'description' => '9:00 AM Mass'])
            ->assertCreated()
            ->assertJsonPath('offering.recorded_by', 'Liza Mercado')
            ->assertJsonPath('offering.amount', 12500.5);
        $this->actingAs($this->priest)->postJson('/api/offerings', ['category' => 'Sunday collection', 'amount' => '7499.50', 'received_on' => '2026-10-04'])->assertCreated();
        $this->postJson('/api/offerings', ['category' => 'Wedding stole fee', 'amount' => '3000', 'received_on' => '2026-11-01'])->assertCreated();
        // Outside the period.
        Offering::factory()->create(['category' => 'Donation', 'amount' => 999, 'received_on' => '2026-08-31']);

        $this->report(['type' => 'financial', 'from' => '2026-09', 'to' => '2026-11'])
            ->assertOk()
            ->assertJsonPath('report.rows.0', ['Sunday collection', 2, 20000, '87.0%'])
            ->assertJsonPath('report.rows.1', ['Wedding stole fee', 1, 3000, '13.0%'])
            ->assertJsonPath('report.total', ['Total', 3, 23000, '100%'])
            ->assertJsonPath('report.period', 'September 2026 to November 2026');

        $this->report(['type' => 'financial', 'from' => '2026-11', 'to' => '2026-12'])->assertUnprocessable()->assertJsonValidationErrors('from');
    }

    public function test_the_sacramental_report_and_bad_options(): void
    {
        $this->report(['type' => 'sacramental', 'from' => '2026-01', 'to' => '2026-11', 'sacraments' => ['Baptism', 'Burial']])
            ->assertOk()
            ->assertJsonPath('report.title', 'Sacraments recorded')
            ->assertJsonPath('report.columns', ['Month', 'Baptisms', 'Burials', 'Total'])
            ->assertJsonCount(11, 'report.rows');
        $this->report(['type' => 'sacramental', 'from' => '2026-01', 'to' => '2026-11'])->assertUnprocessable()->assertJsonValidationErrors('sacraments');
        $this->report(['type' => 'demographic', 'group_by' => 'chapel'])->assertUnprocessable();
        $this->actingAs($this->staff)->getJson('/api/priest/reports?type=financial&from=2026-01&to=2026-11')->assertForbidden();
    }

    public function test_offerings_are_kept_in_the_ledger_with_an_audit_trail(): void
    {
        $id = $this->actingAs($this->priest)->postJson('/api/offerings', ['category' => 'Mass intention', 'amount' => '300', 'received_on' => '2026-11-09'])
            ->assertCreated()->json('offering.id');
        $this->postJson('/api/offerings', ['category' => '', 'amount' => '0', 'received_on' => '2026-11-10'])
            ->assertUnprocessable()->assertJsonValidationErrors(['category', 'amount', 'received_on']);

        $this->actingAs($this->staff)->patchJson("/api/offerings/{$id}", ['category' => 'Mass intention', 'amount' => '500', 'received_on' => '2026-11-09'])
            ->assertOk()->assertJsonPath('offering.amount', 500)->assertJsonPath('offering.recorded_by', 'Fr. Antonio Reyes');
        $this->getJson('/api/offerings?from=2026-11&to=2026-11')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('total', 500)->assertJsonPath('categories.0', 'Sunday collection');
        $this->deleteJson("/api/offerings/{$id}")->assertNoContent();

        $this->assertDatabaseCount('offerings', 0);
        foreach (['OFFERING_RECORDED', 'OFFERING_UPDATED', 'OFFERING_DELETED'] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action, 'record_id_affected' => $id]);
        }
        $officer = User::factory()->role(UserRole::GkkOfficer)->create();
        $this->actingAs($officer)->getJson('/api/offerings?from=2026-11&to=2026-11')->assertForbidden();
    }
}

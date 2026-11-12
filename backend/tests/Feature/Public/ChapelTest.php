<?php

namespace Tests\Feature\Public;

use App\Models\Chapel;
use App\Models\ChapelOfficer;
use App\Models\Sona;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChapelTest extends TestCase
{
    use RefreshDatabase;

    protected bool $seed = true;

    private function officer(Chapel $chapel, string $name, string $position, array $extra = []): ChapelOfficer
    {
        return ChapelOfficer::create([
            'chapel_id' => $chapel->chapel_id,
            'name' => $name,
            'position' => $position,
            'age' => 50,
            'fb_account' => $name,
            'contact_number' => '0917 000 0001',
            'term_year' => (int) now('Asia/Manila')->format('Y'),
            'approval_status' => 'Approved',
            ...$extra,
        ]);
    }

    public function test_the_public_sees_active_approved_chapels_and_their_current_council(): void
    {
        $sona = Sona::query()->where('name', 'Sona Birhen sa Carmen')->firstOrFail();
        $chapel = Chapel::query()->where('name', 'Our Lady of Mount Carmel Chapel')->firstOrFail();
        Chapel::create(['sona_id' => $sona->sona_id, 'name' => 'Waiting Chapel', 'approval_status' => 'Pending']);
        Chapel::create(['sona_id' => $sona->sona_id, 'name' => 'Closed Chapel', 'is_active' => false, 'approval_status' => 'Approved']);

        $this->officer($chapel, 'Edgar Morales', 'President');
        $this->officer($chapel, 'Gloria Ramos', 'Secretary');
        $this->officer($chapel, 'Not Yet Approved', 'Treasurer', ['approval_status' => 'Pending']);
        $this->officer($chapel, 'Last Year', 'Auditor', ['term_year' => (int) now('Asia/Manila')->format('Y') - 1]);

        $response = $this->getJson('/api/public/chapels')->assertOk();

        $names = collect($response->json('data.chapels'))->pluck('name');
        $this->assertContains('Our Lady of Mount Carmel Chapel', $names);
        $this->assertNotContains('Waiting Chapel', $names);
        $this->assertNotContains('Closed Chapel', $names);

        $officers = collect($response->json('data.officers'))->keyBy('name');
        $this->assertSame(['Edgar Morales', 'Gloria Ramos'], $officers->keys()->sort()->values()->all());
        // Only the president's number is public; ages and Facebook names never are.
        $this->assertSame('0917 000 0001', $officers['Edgar Morales']['contact_number']);
        $this->assertNull($officers['Gloria Ramos']['contact_number']);
        $this->assertArrayNotHasKey('age', $officers['Gloria Ramos']);
        $this->assertArrayNotHasKey('fb_account', $officers['Gloria Ramos']);
        $this->assertNull($officers['Gloria Ramos']['photo_url']);
    }

    public function test_officer_pictures_are_public_links(): void
    {
        $chapel = Chapel::query()->where('name', 'Our Lady of Mount Carmel Chapel')->firstOrFail();
        $officer = $this->officer($chapel, 'Edgar Morales', 'President');
        $officer->forceFill(['photo_path' => 'profile-photos/'.str_repeat('a', 40).'.jpg'])->save();

        $listed = collect($this->getJson('/api/public/chapels')->json('data.officers'))->firstWhere('name', 'Edgar Morales');

        $this->assertSame(route('profile-photos.show', str_repeat('a', 40).'.jpg'), $listed['photo_url']);
    }
}

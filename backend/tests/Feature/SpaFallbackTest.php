<?php

namespace Tests\Feature;

use Tests\TestCase;

class SpaFallbackTest extends TestCase
{
    public function test_frontend_paths_are_answered_by_the_app_shell(): void
    {
        $this->get('/')->assertOk();
        $this->get('/dashboard/records')->assertOk();
    }

    public function test_unknown_api_paths_still_return_a_json_404(): void
    {
        $this->getJson('/api/does-not-exist')
            ->assertNotFound()
            ->assertJsonStructure(['message']);
    }
}

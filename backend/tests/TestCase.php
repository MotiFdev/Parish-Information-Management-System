<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * A real server builds fresh guards per request; the test app reuses them,
     * so Sanctum would otherwise keep returning the user it resolved earlier.
     */
    protected function forgetResolvedGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}

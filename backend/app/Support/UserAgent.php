<?php

namespace App\Support;

/**
 * Turns a User-Agent header into "Chrome on Windows" and a device kind, good
 * enough to recognise a session at a glance. Not for security decisions.
 */
final class UserAgent
{
    /**
     * @return array{client: string, device: 'phone'|'desktop'}
     */
    public static function describe(?string $ua): array
    {
        $ua = (string) $ua;

        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/'), str_contains($ua, 'Opera') => 'Opera',
            str_contains($ua, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($ua, 'Firefox/'), str_contains($ua, 'FxiOS') => 'Firefox',
            str_contains($ua, 'Chrome/'), str_contains($ua, 'CriOS') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => null,
        };

        $os = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS X'), str_contains($ua, 'Macintosh') => 'Mac',
            str_contains($ua, 'CrOS') => 'ChromeOS',
            str_contains($ua, 'Linux') => 'Linux',
            default => null,
        };

        $client = match (true) {
            $browser && $os => "{$browser} on {$os}",
            (bool) $browser => $browser,
            (bool) $os => $os,
            $ua === '' => 'Unknown device',
            default => 'Other app',
        };

        $phone = (bool) preg_match('/Mobile|iPhone|Android(?!.*Tablet)/', $ua) && ! str_contains($ua, 'iPad');

        return ['client' => $client, 'device' => $phone ? 'phone' : 'desktop'];
    }
}

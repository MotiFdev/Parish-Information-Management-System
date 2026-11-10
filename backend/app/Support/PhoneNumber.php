<?php

namespace App\Support;

/**
 * Philippine mobile numbers, stored as 11 digits ("09175550142").
 * "0917 555 0142", "0917-555-0142", and "+63 917 555 0142" all mean the same number.
 */
final class PhoneNumber
{
    public const RULE = 'regex:/^09\d{9}$/';

    public const MESSAGE = 'Enter a mobile number like 0917 555 0142.';

    public static function normalize(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $digits = (string) preg_replace('/[\s().-]/', '', trim($value));

        return (string) preg_replace('/^\+63/', '0', $digits);
    }
}

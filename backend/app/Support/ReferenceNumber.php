<?php

namespace App\Support;

/**
 * Reference numbers people use to track a request without an account, e.g.
 * "RR-7K3M-9QX2". Anyone holding one can see the request's status, so the
 * eight characters are random (32^8, about 1.1 trillion), never a sequence.
 * The alphabet leaves out 0, 1, I, and O, which are easy to misread.
 */
final class ReferenceNumber
{
    public const RECORD_REQUEST = 'RR';

    public const APPOINTMENT = 'AP';

    private const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

    private const LENGTH = 8;

    public static function generate(string $prefix): string
    {
        $characters = '';
        for ($i = 0; $i < self::LENGTH; $i++) {
            $characters .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return self::format($prefix, $characters);
    }

    /**
     * Reads a reference the way people type it: any case, with spaces or
     * without dashes. Null when it can't be a reference with this prefix.
     */
    public static function normalize(string $input, string $prefix): ?string
    {
        $compact = (string) preg_replace('/[^A-Z0-9]/', '', strtoupper($input));
        if (! str_starts_with($compact, $prefix)) {
            return null;
        }

        $characters = substr($compact, strlen($prefix));
        if (strlen($characters) !== self::LENGTH || strspn($characters, self::ALPHABET) !== self::LENGTH) {
            return null;
        }

        return self::format($prefix, $characters);
    }

    private static function format(string $prefix, string $characters): string
    {
        return $prefix.'-'.substr($characters, 0, 4).'-'.substr($characters, 4);
    }
}

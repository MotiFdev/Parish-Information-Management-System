<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * A setting the whole parish office shares, such as the office hours
 * parishioners see. One row per key.
 */
#[Table(key: 'key', keyType: 'string', incrementing: false)]
#[Fillable(['key', 'value', 'updated_by_user_id'])]
class ParishSetting extends Model
{
    public const CREATED_AT = null;

    public const DEFAULTS = [
        'office_hours' => 'Monday to Saturday, 8:00 AM to 5:00 PM',
        // AI Record Search: results below ai_min_score are hidden; ai_strong_score and above read as a strong match.
        'ai_min_score' => '0.45',
        'ai_strong_score' => '0.75',
    ];

    public static function value(string $key): string
    {
        return (string) (static::query()->whereKey($key)->value('value') ?? self::DEFAULTS[$key] ?? '');
    }

    public static function put(string $key, string $value, ?User $by): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value, 'updated_by_user_id' => $by?->user_id]);
    }
}

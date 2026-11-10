<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\DB;

/**
 * The users table has unique indexes on LOWER(username) and LOWER(email), so
 * "Juan@x.com" and "juan@x.com" can't both exist. This checks the same way
 * first, to show a friendly message instead of a database error.
 */
class UniqueIgnoringCase implements ValidationRule
{
    public function __construct(
        private string $table,
        private string $column,
        private ?string $ignoreId = null,
        private string $idColumn = 'user_id',
        private ?string $message = null,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        $taken = DB::table($this->table)
            ->whereRaw("LOWER({$this->column}) = LOWER(?)", [$value])
            ->when($this->ignoreId, fn ($q, $id) => $q->where($this->idColumn, '!=', $id))
            ->exists();

        if ($taken) {
            $fail($this->message ?? "Another account already uses this {$this->column}.");
        }
    }
}

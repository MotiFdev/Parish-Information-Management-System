<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One saved AI Record Search: the question, its filters, and how many entries matched.
 */
#[Table(name: 'ai_search_history', key: 'search_id')]
#[Fillable(['user_id', 'query', 'filters', 'result_count', 'searched_at'])]
class AiSearch extends Model
{
    use HasUuids;

    public const CREATED_AT = 'searched_at';

    public const UPDATED_AT = null;

    /** Searches kept per person; older ones are dropped. */
    public const KEEP = 20;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'result_count' => 'integer',
            'searched_at' => 'datetime',
        ];
    }
}

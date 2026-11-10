<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A staff remark on a record request, or an additional requirement asked of the
 * requester. Both are shown to the requester on their request page.
 */
#[Table(name: 'record_request_remarks', key: 'remark_id')]
#[Fillable(['request_id', 'user_id', 'kind', 'body'])]
class RecordRequestRemark extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

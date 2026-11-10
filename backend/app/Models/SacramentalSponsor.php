<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table(key: 'sponsor_id', timestamps: false)]
#[Fillable(['record_id', 'sponsor_name', 'sponsor_type'])]
class SacramentalSponsor extends Model
{
    use HasUuids;

    /**
     * @return BelongsTo<SacramentalRecord, $this>
     */
    public function record(): BelongsTo
    {
        return $this->belongsTo(SacramentalRecord::class, 'record_id');
    }
}

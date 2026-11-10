<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table(key: 'sacrament_type_id', timestamps: false)]
#[Fillable(['name', 'description'])]
class SacramentType extends Model
{
    /**
     * @return HasMany<SacramentalRecord, $this>
     */
    public function sacramentalRecords(): HasMany
    {
        return $this->hasMany(SacramentalRecord::class, 'sacrament_type_id');
    }

    /**
     * @return HasMany<RecordRequest, $this>
     */
    public function recordRequests(): HasMany
    {
        return $this->hasMany(RecordRequest::class, 'record_type_id');
    }
}

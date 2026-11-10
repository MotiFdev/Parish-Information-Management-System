<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table(key: 'sona_id', timestamps: false)]
#[Fillable(['name'])]
class Sona extends Model
{
    /**
     * @return HasMany<Chapel, $this>
     */
    public function chapels(): HasMany
    {
        return $this->hasMany(Chapel::class, 'sona_id');
    }

    /**
     * @return HasMany<Appointment, $this>
     */
    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class, 'sona_id');
    }
}

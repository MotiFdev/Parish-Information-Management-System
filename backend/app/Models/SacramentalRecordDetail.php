<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Type-specific fields for one register entry; the key is the record's own ID.
 */
#[Table(key: 'record_id', keyType: 'string', incrementing: false, timestamps: false)]
#[Fillable([
    'record_id',
    'baptism_date',
    'baptismal_parish',
    'spouse_baptismal_parish',
    'license_number',
    'civil_marriage_date',
    'civil_marriage_place',
    'date_of_death',
    'age_at_death',
    'place_of_death',
    'cause_of_death',
    'civil_status',
    'spouse_name',
    'funeral_mass_date',
    'burial_place',
    'informant_name',
    'informant_relationship',
    'informant_contact',
    'informant_address',
    'father_name',
    'mother_name',
    'parents_names',
    'groom_parents',
    'bride_parents',
])]
class SacramentalRecordDetail extends Model
{
    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'baptism_date' => 'date',
            'civil_marriage_date' => 'date',
            'date_of_death' => 'date',
            'age_at_death' => 'integer',
            'funeral_mass_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<SacramentalRecord, $this>
     */
    public function record(): BelongsTo
    {
        return $this->belongsTo(SacramentalRecord::class, 'record_id');
    }
}

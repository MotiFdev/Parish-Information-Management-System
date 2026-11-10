<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table(key: 'parishioner_id')]
#[Fillable([
    'user_id',
    'first_name',
    'middle_name',
    'last_name',
    'suffix',
    'gender',
    'sex',
    'date_of_birth',
    'place_of_birth',
    'contact_number',
    'email',
    'address_street',
    'address_barangay',
    'address_city',
    'chapel_id',
    'father_parishioner_id',
    'mother_parishioner_id',
    'is_archived',
])]
class Parishioner extends Model
{
    use HasUuids;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'is_archived' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * The chapel the parishioner's address belongs to; its Sona is chapel->sona.
     *
     * @return BelongsTo<Chapel, $this>
     */
    public function chapel(): BelongsTo
    {
        return $this->belongsTo(Chapel::class, 'chapel_id');
    }

    /**
     * @return HasMany<ChapelOfficer, $this>
     */
    public function chapelOfficerTerms(): HasMany
    {
        return $this->hasMany(ChapelOfficer::class, 'parishioner_id');
    }

    /**
     * @return BelongsTo<Parishioner, $this>
     */
    public function father(): BelongsTo
    {
        return $this->belongsTo(self::class, 'father_parishioner_id');
    }

    /**
     * @return BelongsTo<Parishioner, $this>
     */
    public function mother(): BelongsTo
    {
        return $this->belongsTo(self::class, 'mother_parishioner_id');
    }

    /**
     * Children who list this parishioner as their father.
     *
     * @return HasMany<Parishioner, $this>
     */
    public function childrenAsFather(): HasMany
    {
        return $this->hasMany(self::class, 'father_parishioner_id');
    }

    /**
     * Children who list this parishioner as their mother.
     *
     * @return HasMany<Parishioner, $this>
     */
    public function childrenAsMother(): HasMany
    {
        return $this->hasMany(self::class, 'mother_parishioner_id');
    }

    /**
     * Records where this parishioner is the primary recipient.
     *
     * @return HasMany<SacramentalRecord, $this>
     */
    public function sacramentalRecords(): HasMany
    {
        return $this->hasMany(SacramentalRecord::class, 'primary_parishioner_id');
    }

    /**
     * Marriage records where this parishioner is the spouse.
     *
     * @return HasMany<SacramentalRecord, $this>
     */
    public function spouseSacramentalRecords(): HasMany
    {
        return $this->hasMany(SacramentalRecord::class, 'secondary_parishioner_id');
    }

    /**
     * @return HasMany<Document, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'parishioner_id');
    }

    /**
     * @return HasMany<RecordEmbedding, $this>
     */
    public function embeddings(): HasMany
    {
        return $this->hasMany(RecordEmbedding::class, 'parishioner_id');
    }
}

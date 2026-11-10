<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * One backup of the relational or the vector database. Only succeeded runs
 * whose file is still kept can be restored.
 */
#[Table(key: 'backup_id')]
#[Fillable(['database', 'trigger', 'user_id', 'by_name', 'status', 'file_path', 'size_bytes', 'duration_ms', 'error', 'started_at', 'finished_at'])]
class BackupRun extends Model
{
    use HasUuids;

    public $timestamps = false;

    public const RELATIONAL = 'relational';

    public const VECTOR = 'vector';

    public const DATABASES = [self::RELATIONAL, self::VECTOR];

    public const SUCCEEDED = 'Succeeded';

    public const FAILED = 'Failed';

    /** Taken by the nightly schedule. */
    public const SCHEDULED = 'Scheduled';

    /** Started by an administrator with Run backup now. */
    public const MANUAL = 'Manual';

    /** Taken automatically just before a restore, so the restore can be undone. */
    public const BEFORE_RESTORE = 'Before restore';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'size_bytes' => 'integer',
            'duration_ms' => 'integer',
        ];
    }

    public function restorable(): bool
    {
        return $this->status === self::SUCCEEDED && $this->file_path !== null;
    }
}

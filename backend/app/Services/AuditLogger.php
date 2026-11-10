<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public function __construct(private Request $request) {}

    /**
     * @param  array<string, mixed>|null  $details
     */
    public function log(
        string $action,
        string $tableAffected,
        string $recordIdAffected,
        ?User $actor = null,
        ?array $details = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => $actor?->user_id,
            'action' => $action,
            'table_affected' => $tableAffected,
            'record_id_affected' => $recordIdAffected,
            'ip_address' => $this->request->ip() ?? 'unknown',
            'details' => $details,
        ]);
    }
}

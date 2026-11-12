<?php

namespace App\Services;

use App\Enums\ApprovalStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * A PPC Officer's decision on new GKK and PYA-KKK chapels and chapel officers.
 * Events go through CommunityEvents instead, since the priest decides them. Each has a status column, reviewed_by_user_id,
 * reviewed_at, and review_note.
 */
class Approvals
{
    /**
     * Approves or rejects a Pending row. Returns null when it was no longer
     * Pending, e.g. another PPC Officer decided it first.
     *
     * @template TModel of Model
     *
     * @param  TModel  $model
     * @return TModel|null
     */
    public function decide(Model $model, string $statusColumn, ApprovalStatus $decision, ?string $reason, User $by): ?Model
    {
        return DB::transaction(function () use ($model, $statusColumn, $decision, $reason, $by) {
            // Locked so two PPC Officers can't both decide the same row.
            $fresh = $model->newQuery()->lockForUpdate()->find($model->getKey());
            if (! $fresh || $fresh->getAttribute($statusColumn) !== ApprovalStatus::Pending) {
                return null;
            }
            $fresh->forceFill([
                $statusColumn => $decision,
                'reviewed_by_user_id' => $by->user_id,
                'reviewed_at' => now(),
                'review_note' => $reason,
            ])->save();

            return $fresh;
        });
    }

    /**
     * Validates the reason a PPC Officer gives when rejecting.
     *
     * @return array<string, list<string>>
     */
    public static function reasonRules(): array
    {
        return ['reason' => ['required', 'string', 'min:5', 'max:1000']];
    }

    /**
     * @return array<string, string>
     */
    public static function reasonMessages(): array
    {
        $why = 'Say why, so the organizers know what to change.';

        return ['reason.required' => $why, 'reason.min' => $why];
    }
}

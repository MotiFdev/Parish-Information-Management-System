<?php

namespace App\Enums;

enum RecordRequestStatus: string
{
    case Pending = 'Pending';
    case UnderVerification = 'Under Verification';
    case Approved = 'Approved';
    case Rejected = 'Rejected';
    case ReadyForCollection = 'Ready for Collection';
    case Completed = 'Completed';

    /**
     * The statuses this one may move to, following the spec's request workflow.
     * Staff send a verified request to the priest without changing its status;
     * verified_by_staff_id marks it as waiting in the priest's queue.
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Pending => [self::UnderVerification],
            self::UnderVerification => [self::Approved, self::Rejected],
            self::Approved => [self::ReadyForCollection],
            self::ReadyForCollection => [self::Completed],
            self::Rejected, self::Completed => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }
}

<?php

namespace App\Enums;

enum DocumentVerificationStatus: string
{
    case Pending = 'Pending';
    case Verified = 'Verified';
    case Rejected = 'Rejected';
    case NeedsResubmission = 'Needs Resubmission';
}

<?php

namespace App\Enums;

/**
 * Where GKK and PYA-KKK work stands with the PPC: events, and new chapels and
 * chapel officers. Editing an event, or a rejected chapel or officer, sends it
 * back to Pending.
 */
enum ApprovalStatus: string
{
    case Pending = 'Pending';
    case Approved = 'Approved';
    case Rejected = 'Rejected';
}

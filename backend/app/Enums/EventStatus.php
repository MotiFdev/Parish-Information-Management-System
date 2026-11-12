<?php

namespace App\Enums;

/**
 * Where a GKK or PYA-KKK event stands. The PPC pre-approves or rejects a
 * Pending event; the parish priest gives the final approval or rejection of a
 * Pre-Approved one. Editing an event sends it back to Pending.
 */
enum EventStatus: string
{
    case Pending = 'Pending';
    case PreApproved = 'Pre-Approved';
    case Approved = 'Approved';
    case Rejected = 'Rejected';
}

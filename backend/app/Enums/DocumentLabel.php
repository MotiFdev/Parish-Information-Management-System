<?php

namespace App\Enums;

enum DocumentLabel: string
{
    case ValidId = 'Valid ID';
    case BirthCertificate = 'Birth Certificate';
    case BaptismalCertificate = 'Baptismal Certificate';
    case DeathCertificate = 'Death Certificate';
    case BurialPermit = 'Burial Permit';
    case Other = 'Other';
}

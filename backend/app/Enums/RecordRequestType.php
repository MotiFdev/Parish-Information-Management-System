<?php

namespace App\Enums;

enum RecordRequestType: string
{
    case NewRegistration = 'New Registration';
    case CertificateRequest = 'Certificate Request';
    case RecordCorrection = 'Record Correction';
}

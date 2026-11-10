<?php

namespace App\Enums;

enum AnnouncementStatus: string
{
    case Draft = 'Draft';
    case Published = 'Published';
    case Archived = 'Archived';
}

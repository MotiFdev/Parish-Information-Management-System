<?php

namespace App\Enums;

enum EmbeddingSourceType: string
{
    case SacramentalRecord = 'Sacramental Record';
    case ParishionerProfile = 'Parishioner Profile';
    case ScannedDocument = 'Scanned Document';
}

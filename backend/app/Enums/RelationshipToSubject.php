<?php

namespace App\Enums;

enum RelationshipToSubject: string
{
    case Self = 'Self';
    case Parent = 'Parent';
    case Spouse = 'Spouse';
    case Child = 'Child';
    case Relative = 'Relative';
    case AuthorizedRepresentative = 'Authorized Representative';
}

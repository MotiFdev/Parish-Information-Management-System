<?php

/*
| Record request forms and required documents. These mirror the parishioner
| portal's form (frontend/src/features/parishioner/requests/recordTypes.ts);
| change both together.
|
| Field rules: 'key' is always required (what staff need to find an existing
| entry), 'reg' is required for New Registration only, 'optional' never is.
| Document entries: key => [label stored in request_documents, title shown to people, required].
*/

return [
    // Private disk for uploads. Set DOCUMENTS_DISK=s3 in production (see config/filesystems.php).
    'disk' => env('DOCUMENTS_DISK', 'local'),
    'max_upload_kb' => (int) env('DOCUMENTS_MAX_UPLOAD_KB', 10240),
    'link_minutes' => (int) env('DOCUMENTS_LINK_MINUTES', 5),

    'purposes' => ['Personal copy', 'Marriage requirement', 'Legal purpose', 'Other'],

    'forms' => [
        'Baptism' => [
            'fullName' => 'key', 'birthDate' => 'key', 'birthPlace' => 'reg', 'sex' => 'reg',
            'baptismDate' => 'key', 'baptismChurch' => 'key',
            'father' => 'key', 'mother' => 'key', 'godfather' => 'reg', 'godmother' => 'reg',
        ],
        'Confirmation' => [
            'fullName' => 'key', 'birthDate' => 'key', 'birthPlace' => 'reg', 'father' => 'reg', 'mother' => 'reg',
            'confirmationDate' => 'key', 'confirmationPlace' => 'key', 'minister' => 'optional', 'sponsor' => 'reg',
            'baptismParish' => 'reg', 'baptismDate' => 'reg',
        ],
        'Marriage' => [
            'groomName' => 'key', 'groomBirthDate' => 'reg', 'groomBirthPlace' => 'reg', 'groomFather' => 'reg', 'groomMother' => 'reg', 'groomBaptismParish' => 'reg',
            'brideName' => 'key', 'brideBirthDate' => 'reg', 'brideBirthPlace' => 'reg', 'brideFather' => 'reg', 'brideMother' => 'reg', 'brideBaptismParish' => 'reg',
            'marriageDate' => 'key', 'marriagePlace' => 'key', 'presidingPriest' => 'reg', 'licenseNumber' => 'reg',
            'civilDetails' => 'optional', 'witnesses' => 'reg',
        ],
        'Burial' => [
            'deceasedName' => 'key', 'birthDate' => 'optional', 'deathDate' => 'key', 'ageAtDeath' => 'reg', 'sex' => 'reg',
            'deathPlace' => 'reg', 'causeOfDeath' => 'optional', 'civilStatus' => 'reg', 'spouse' => 'optional', 'parents' => 'optional',
            'funeralMassDate' => 'reg', 'burialDate' => 'key', 'burialPlace' => 'reg', 'funeralChurch' => 'key', 'officiatingPriest' => 'reg',
            'informantName' => 'key', 'informantRelationship' => 'key', 'informantContact' => 'key', 'informantAddress' => 'key',
        ],
    ],

    'correction_fields' => [
        'correctionField' => 'key', 'currentValue' => 'key', 'correctValue' => 'key', 'correctionReason' => 'optional',
    ],

    'documents' => [
        'Baptism' => [
            'birthCert' => ['Birth Certificate', 'PSA birth certificate', true],
            'requesterId' => ['Valid ID', 'Valid ID of requester', false],
        ],
        'Confirmation' => [
            'baptismalCert' => ['Baptismal Certificate', 'Baptismal certificate', true],
            'requesterId' => ['Valid ID', 'Valid ID of requester', false],
        ],
        'Marriage' => [
            'spouseIds' => ['Valid ID', 'Valid IDs of both spouses', true],
            'civilCert' => ['Other', 'PSA marriage certificate (if civilly married)', false],
        ],
        'Burial' => [
            'deathCert' => ['Death Certificate', 'Death certificate', true],
            'burialPermit' => ['Burial Permit', 'Burial permit', true],
            'informantId' => ['Valid ID', 'Valid ID of informant', false],
        ],
    ],

    'correction_document' => ['proof' => ['Other', 'Document showing the correct entry', true]],
];

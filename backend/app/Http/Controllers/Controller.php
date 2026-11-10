<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controller as BaseController;
use OpenApi\Attributes as OA;

#[OA\Info(
    version: '1.0.0',
    title: 'Parish Information Management System API',
    description: 'REST API for managing parish information, records, and services.'
)]
#[OA\Server(
    url: 'http://127.0.0.1:8000',
    description: 'Local Laravel development server'
)]
abstract class Controller extends BaseController
{
    //
}

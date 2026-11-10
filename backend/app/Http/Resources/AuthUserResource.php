<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\StaffPreferences;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class AuthUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $this->roleType();

        return [
            'user_id' => $this->user_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'username' => $this->username,
            'email' => $this->email,
            'photo_url' => $this->photoUrl(),
            'is_active' => $this->is_active,
            'last_login' => $this->last_login?->toIso8601String(),
            'role' => [
                'role_id' => $this->role_id,
                'name' => $role?->value,
                'slug' => $role?->slug(),
            ],
            'dashboard_path' => $role?->dashboardPath(),
            // Staff pages open where this person chose in Settings.
            'preferences' => $role === UserRole::ParishStaff ? StaffPreferences::of($this->resource) : null,
        ];
    }
}

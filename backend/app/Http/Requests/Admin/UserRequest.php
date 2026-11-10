<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Models\User;
use App\Rules\UniqueIgnoringCase;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create and edit share these rules. On edit, every field is optional so the
 * admin portal can send only what changed.
 */
class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(array_map(
            fn ($v) => is_string($v) ? trim($v) : $v,
            $this->only(['first_name', 'last_name', 'username', 'email', 'role']),
        ));
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $required = $this->editing() ? 'sometimes' : 'required';

        return [
            'first_name' => [$required, 'string', 'max:100'],
            'last_name' => [$required, 'string', 'max:100'],
            'username' => [$required, 'string', 'min:3', 'max:50', 'regex:/^[A-Za-z0-9._-]+$/', $this->uniqueIgnoringCase('username')],
            'email' => [$required, 'string', 'email', 'max:150', $this->uniqueIgnoringCase('email')],
            'role' => [$required, 'string', Rule::in(array_map(fn (UserRole $r) => $r->slug(), UserRole::cases()))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'username.regex' => 'Use only letters, numbers, dots, dashes, or underscores.',
            'role.in' => 'Choose one of the listed roles.',
        ];
    }

    private function editing(): bool
    {
        return $this->route('user') instanceof User;
    }

    private function uniqueIgnoringCase(string $column): UniqueIgnoringCase
    {
        $user = $this->route('user');

        return new UniqueIgnoringCase('users', $column, ignoreId: $user instanceof User ? $user->user_id : null);
    }
}

<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emails a link to the frontend's /reset-password page. Sent when an
 * administrator creates an account ($newAccount) or resets someone's password.
 */
class SetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $token,
        public readonly bool $newAccount = false,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function url(User $user): string
    {
        $frontend = rtrim(explode(',', (string) config('app.frontend_url'))[0], '/');

        return $frontend.'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $user->getEmailForPasswordReset(),
        ]);
    }

    public function toMail(User $notifiable): MailMessage
    {
        $hours = intdiv((int) config('auth.passwords.users.expire'), 60);
        $expires = $hours >= 1 ? trans_choice('{1} 1 hour|[2,*] :count hours', $hours) : config('auth.passwords.users.expire').' minutes';
        $name = $notifiable->first_name ?: $notifiable->username;

        $message = (new MailMessage)->greeting("Hello {$name},");

        if ($this->newAccount) {
            return $message
                ->subject('Your parish account is ready')
                ->line('An account has been created for you in the Parish Information Management System.')
                ->line("Your username is **{$notifiable->username}**. Choose a password to start signing in.")
                ->action('Set your password', $this->url($notifiable))
                ->line("This link works for {$expires}. If it expires, ask the parish office to send a new one.");
        }

        return $message
            ->subject('Reset your parish account password')
            ->line('Someone, hopefully you, asked for a link to choose a new password for your parish account.')
            ->action('Choose a new password', $this->url($notifiable))
            ->line("This link works for {$expires}. If you did not expect this email, contact the parish office.");
    }
}

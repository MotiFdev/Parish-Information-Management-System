<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The email copy of an office notice, for staff who turned on "Email me as
 * well". Queued, so a slow mail server never holds up the request that caused it.
 */
class OfficeNoticeNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $message,
        public readonly ?string $link,
    ) {
        $this->afterCommit();
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Parish office: '.mb_strimwidth($this->message, 0, 70, '…'))
            ->greeting('Hello '.($notifiable->first_name ?: $notifiable->username).',')
            ->line($this->message);

        if ($this->link) {
            $mail->action('Open it', rtrim(explode(',', (string) config('app.frontend_url'))[0], '/').$this->link);
        }

        return $mail->line('You get these because "Email me as well" is on in your Settings.');
    }
}

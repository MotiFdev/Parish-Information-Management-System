<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * The parish office role is now called Secretary, and its portal moved
     * from /staff to /secretary. Accounts keep their role_id, so everyone who
     * had Parish Staff becomes a Secretary. Notices already sent point at the
     * new portal, and the local test account is renamed to match.
     */
    public function up(): void
    {
        DB::table('roles')->where('role_name', 'Parish Staff')->update(['role_name' => 'Secretary']);
        $this->moveNoticeLinks('/staff', '/secretary');
        $this->renameTestAccount('staff', 'secretary');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('roles')->where('role_name', 'Secretary')->update(['role_name' => 'Parish Staff']);
        $this->moveNoticeLinks('/secretary', '/staff');
        $this->renameTestAccount('secretary', 'staff');
    }

    private function moveNoticeLinks(string $from, string $to): void
    {
        DB::table('notifications')->where('link', 'like', "{$from}/%")->orderBy('notification_id')
            ->each(fn (object $notice) => DB::table('notifications')->where('notification_id', $notice->notification_id)
                ->update(['link' => $to.substr($notice->link, strlen($from))]));
    }

    /** Only the account PortalUserSeeder made, and only if the new name is free. */
    private function renameTestAccount(string $from, string $to): void
    {
        $taken = DB::table('users')->whereRaw('LOWER(username) = ?', [$to])->orWhereRaw('LOWER(email) = ?', ["{$to}@parish.local"])->exists();
        if (! $taken) {
            DB::table('users')->where('username', $from)->where('email', "{$from}@parish.local")
                ->update(['username' => $to, 'email' => "{$to}@parish.local"]);
        }
    }
};

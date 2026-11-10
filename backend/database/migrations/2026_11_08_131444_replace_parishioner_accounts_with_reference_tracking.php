<?php

use App\Support\ReferenceNumber;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Parishioners no longer sign in: record requests and appointments come from
     * the public site and are tracked with a random reference number.
     */
    public function up(): void
    {
        // No account behind new requests, appointments, or the files sent with them.
        DB::statement('ALTER TABLE record_requests ALTER COLUMN requested_by_user_id DROP NOT NULL');
        DB::statement('ALTER TABLE appointments_and_events ALTER COLUMN requested_by_user_id DROP NOT NULL');
        DB::statement('ALTER TABLE documents ALTER COLUMN uploaded_by_user_id DROP NOT NULL');

        DB::statement('ALTER TABLE appointments_and_events ADD COLUMN reference_number VARCHAR(20) NULL');
        foreach (DB::table('appointments_and_events')->pluck('appointment_id') as $id) {
            DB::table('appointments_and_events')->where('appointment_id', $id)
                ->update(['reference_number' => $this->unusedReference('appointments_and_events', 'reference_number', ReferenceNumber::APPOINTMENT)]);
        }
        DB::statement('ALTER TABLE appointments_and_events ALTER COLUMN reference_number SET NOT NULL');
        DB::statement('ALTER TABLE appointments_and_events ADD CONSTRAINT appointments_and_events_reference_number_unique UNIQUE (reference_number)');

        // Sequential numbers (RR-2026-000042) could be guessed, and a number now opens the request's status.
        foreach (DB::table('record_requests')->pluck('request_id') as $id) {
            DB::table('record_requests')->where('request_id', $id)
                ->update(['request_number' => $this->unusedReference('record_requests', 'request_number', ReferenceNumber::RECORD_REQUEST)]);
        }
        DB::statement('DROP SEQUENCE IF EXISTS record_requests_number_seq');

        $this->retireParishionerAccounts();
    }

    /**
     * Reverse the migrations.
     *
     * Fails if requests were sent from the public site since, as those have no
     * account to point back to. Reference numbers stay as they are, and retired
     * parishioner accounts stay deactivated.
     */
    public function down(): void
    {
        DB::table('roles')->updateOrInsert(['role_name' => 'Parishioner']);

        $count = DB::table('record_requests')->count();
        DB::statement('CREATE SEQUENCE IF NOT EXISTS record_requests_number_seq');
        if ($count > 0) {
            DB::statement('SELECT setval(\'record_requests_number_seq\', ?)', [$count]);
        }
        DB::statement('ALTER SEQUENCE record_requests_number_seq OWNED BY record_requests.request_number');

        DB::statement('ALTER TABLE appointments_and_events DROP CONSTRAINT IF EXISTS appointments_and_events_reference_number_unique');
        DB::statement('ALTER TABLE appointments_and_events DROP COLUMN IF EXISTS reference_number');

        DB::statement('ALTER TABLE documents ALTER COLUMN uploaded_by_user_id SET NOT NULL');
        DB::statement('ALTER TABLE appointments_and_events ALTER COLUMN requested_by_user_id SET NOT NULL');
        DB::statement('ALTER TABLE record_requests ALTER COLUMN requested_by_user_id SET NOT NULL');
    }

    /**
     * Signs out and deactivates parishioner accounts. They are kept, not
     * deleted, because the audit log still points at them. The role goes
     * once no account uses it.
     */
    private function retireParishionerAccounts(): void
    {
        $roleId = DB::table('roles')->where('role_name', 'Parishioner')->value('role_id');
        if ($roleId === null) {
            return;
        }

        $users = DB::table('users')->where('role_id', $roleId);
        $userIds = (clone $users)->pluck('user_id');

        if ($userIds->isNotEmpty()) {
            DB::table('personal_access_tokens')->whereIn('tokenable_id', $userIds)->delete();
            if (Schema::hasTable('sessions')) {
                DB::table('sessions')->whereIn('user_id', $userIds)->delete();
            }
            DB::table('password_reset_tokens')->whereIn('email', (clone $users)->pluck('email'))->delete();
            (clone $users)->update(['is_active' => false]);

            return;
        }

        DB::table('roles')->where('role_id', $roleId)->delete();
    }

    private function unusedReference(string $table, string $column, string $prefix): string
    {
        do {
            $reference = ReferenceNumber::generate($prefix);
        } while (DB::table($table)->where($column, $reference)->exists());

        return $reference;
    }
};

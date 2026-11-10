<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Plain-language labels and filter groups for audit action codes. Codes not
 * listed here still appear on the Audit Logs page with a label made from the
 * code itself; add new codes here as features start writing them.
 */
final class AuditActions
{
    public const CATEGORIES = [
        'signins' => 'Sign-ins',
        'accounts' => 'Accounts & permissions',
        'requests' => 'Record requests',
        'documents' => 'Document verification',
        'certificates' => 'Certificate release',
        'records' => 'Register corrections',
        'appointments' => 'Appointments',
        'community' => 'Chapels, officers & events',
        'announcements' => 'Announcements',
        'offerings' => 'Offerings & fees',
        'system' => 'Security, backups & exports',
    ];

    /** @var array<string, array{label: string, category: string, alert?: bool}> */
    public const ACTIONS = [
        'LOGIN' => ['label' => 'Signed in', 'category' => 'signins'],
        'LOGOUT' => ['label' => 'Signed out', 'category' => 'signins'],
        'LOGIN_FAILED' => ['label' => 'Sign-in failed', 'category' => 'signins', 'alert' => true],
        'LOGIN_BLOCKED_INACTIVE' => ['label' => 'Sign-in blocked: account deactivated', 'category' => 'signins', 'alert' => true],
        'PASSWORD_RESET' => ['label' => 'Password set from emailed link', 'category' => 'signins'],
        'PASSWORD_RESET_REQUESTED' => ['label' => 'Forgot-password link requested', 'category' => 'signins'],
        'USER_REGISTERED' => ['label' => 'Parishioner signed up', 'category' => 'accounts'],
        'PROFILE_UPDATED' => ['label' => 'Own profile updated', 'category' => 'accounts'],
        'PROFILE_PHOTO_UPDATED' => ['label' => 'Profile picture changed', 'category' => 'accounts'],
        'PROFILE_PHOTO_REMOVED' => ['label' => 'Profile picture removed', 'category' => 'accounts'],
        'PASSWORD_CHANGED' => ['label' => 'Password changed', 'category' => 'signins'],

        'USER_CREATED' => ['label' => 'Account created', 'category' => 'accounts'],
        'USER_UPDATED' => ['label' => 'Account edited', 'category' => 'accounts'],
        'USER_DEACTIVATED' => ['label' => 'Account deactivated', 'category' => 'accounts', 'alert' => true],
        'USER_ACTIVATED' => ['label' => 'Account reactivated', 'category' => 'accounts'],
        'PASSWORD_RESET_SENT' => ['label' => 'Password reset link sent', 'category' => 'accounts'],

        'REQUEST_SUBMITTED' => ['label' => 'Request submitted', 'category' => 'requests'],
        'REQUEST_STATUS_CHANGED' => ['label' => 'Request status changed', 'category' => 'requests'],
        'REQUEST_APPROVED' => ['label' => 'Request approved and signed', 'category' => 'requests'],
        'REQUEST_REJECTED' => ['label' => 'Request rejected', 'category' => 'requests', 'alert' => true],
        'REQUEST_COMPLETED' => ['label' => 'Request completed', 'category' => 'requests'],
        'DOCUMENT_VERIFIED' => ['label' => 'Document checked', 'category' => 'documents'],
        'DOCUMENT_ADDED' => ['label' => 'Document uploaded by the secretary', 'category' => 'documents'],
        'DOCUMENT_LINKED' => ['label' => 'Document filed to a different record', 'category' => 'documents'],
        'CERTIFICATE_RELEASED' => ['label' => 'Certificate released', 'category' => 'certificates'],
        'RECORD_CORRECTED' => ['label' => 'Register entry corrected', 'category' => 'records'],
        'SACRAMENTAL_RECORD_ADDED' => ['label' => 'Register entry added', 'category' => 'records'],
        'ANNOUNCEMENT_CREATED' => ['label' => 'Announcement written', 'category' => 'announcements'],
        'ANNOUNCEMENT_UPDATED' => ['label' => 'Announcement edited', 'category' => 'announcements'],
        'ANNOUNCEMENT_PUBLISHED' => ['label' => 'Announcement published', 'category' => 'announcements'],
        'ANNOUNCEMENT_UNSCHEDULED' => ['label' => 'Announcement schedule cancelled', 'category' => 'announcements'],
        'ANNOUNCEMENT_ARCHIVED' => ['label' => 'Announcement archived', 'category' => 'announcements'],
        'ANNOUNCEMENT_TO_DRAFT' => ['label' => 'Announcement moved to drafts', 'category' => 'announcements'],
        'ANNOUNCEMENT_PINNED' => ['label' => 'Announcement pinned', 'category' => 'announcements'],
        'ANNOUNCEMENT_UNPINNED' => ['label' => 'Announcement unpinned', 'category' => 'announcements'],
        'ANNOUNCEMENT_DELETED' => ['label' => 'Announcement deleted', 'category' => 'announcements'],
        'OFFERING_RECORDED' => ['label' => 'Offering recorded', 'category' => 'offerings'],
        'OFFERING_UPDATED' => ['label' => 'Offering edited', 'category' => 'offerings'],
        'OFFERING_DELETED' => ['label' => 'Offering deleted', 'category' => 'offerings', 'alert' => true],
        'OFFICE_HOURS_UPDATED' => ['label' => 'Office hours changed', 'category' => 'system'],
        'PARISHIONER_ADDED' => ['label' => 'Parishioner added', 'category' => 'records'],
        'PARISHIONER_UPDATED' => ['label' => 'Parishioner edited', 'category' => 'records'],
        'PARISHIONER_ARCHIVED' => ['label' => 'Parishioner archived', 'category' => 'records'],
        'PARISHIONER_RESTORED' => ['label' => 'Parishioner restored', 'category' => 'records'],
        'RECORD_CORRECTION_REQUESTED' => ['label' => 'Register correction sent to the priest', 'category' => 'records'],
        'RECORD_CORRECTION_REJECTED' => ['label' => 'Register correction rejected', 'category' => 'records'],
        'DOCUMENT_UPLOADED' => ['label' => 'Document uploaded again', 'category' => 'documents'],
        'REQUEST_REMARK_ADDED' => ['label' => 'Remark added to request', 'category' => 'requests'],
        'REQUEST_DOCUMENTS_REQUESTED' => ['label' => 'Additional documents requested', 'category' => 'requests'],
        'REQUEST_DETAILS_RETURNED' => ['label' => 'Details sent back to the requester', 'category' => 'requests'],
        'REQUEST_DETAILS_UPDATED' => ['label' => 'Details corrected by the requester', 'category' => 'requests'],
        'REQUEST_SENT_TO_PRIEST' => ['label' => 'Request verified and sent to priest', 'category' => 'requests'],
        'REGISTER_LINKED' => ['label' => 'Register entry recorded on request', 'category' => 'records'],

        'APPOINTMENT_REQUESTED' => ['label' => 'Appointment requested', 'category' => 'appointments'],
        'APPOINTMENT_APPROVED' => ['label' => 'Appointment approved', 'category' => 'appointments'],
        'APPOINTMENT_REJECTED' => ['label' => 'Appointment rejected', 'category' => 'appointments', 'alert' => true],
        'APPOINTMENT_RESCHEDULED' => ['label' => 'Appointment rescheduled', 'category' => 'appointments'],
        'APPOINTMENT_ASSIGNED' => ['label' => 'Appointment assignee changed', 'category' => 'appointments'],

        'CHAPEL_CREATED' => ['label' => 'Chapel added (waiting for PPC)', 'category' => 'community'],
        'CHAPEL_UPDATED' => ['label' => 'Chapel edited', 'category' => 'community'],
        'CHAPEL_DELETED' => ['label' => 'Unapproved chapel deleted', 'category' => 'community'],
        'CHAPEL_APPROVED' => ['label' => 'Chapel approved by PPC', 'category' => 'community'],
        'CHAPEL_REJECTED' => ['label' => 'Chapel rejected by PPC', 'category' => 'community', 'alert' => true],
        'OFFICER_APPROVED' => ['label' => 'Chapel officer approved by PPC', 'category' => 'community'],
        'OFFICER_REJECTED' => ['label' => 'Chapel officer rejected by PPC', 'category' => 'community', 'alert' => true],
        'OFFICER_ADDED' => ['label' => 'Chapel officer added (waiting for PPC)', 'category' => 'community'],
        'OFFICER_UPDATED' => ['label' => 'Chapel officer edited', 'category' => 'community'],
        'OFFICER_REMOVED' => ['label' => 'Chapel officer removed', 'category' => 'community'],
        'OFFICERS_IMPORTED' => ['label' => 'Officer list imported', 'category' => 'community'],
        'EVENT_CREATED' => ['label' => 'Event set up', 'category' => 'community'],
        'EVENT_UPDATED' => ['label' => 'Event edited (sent back for approval)', 'category' => 'community'],
        'EVENT_DELETED' => ['label' => 'Event deleted', 'category' => 'community'],
        'EVENT_APPROVED' => ['label' => 'Event approved by PPC', 'category' => 'community'],
        'EVENT_REJECTED' => ['label' => 'Event rejected by PPC', 'category' => 'community', 'alert' => true],

        'SECURITY_ALERT_REVIEWED' => ['label' => 'Security alert marked reviewed', 'category' => 'system'],
        'AI_SETTINGS_UPDATED' => ['label' => 'AI search settings changed', 'category' => 'system'],
        'AI_REINDEX_STARTED' => ['label' => 'AI search re-index started', 'category' => 'system'],
        'AI_REINDEX_COMPLETED' => ['label' => 'AI search re-index finished', 'category' => 'system'],
        'BACKUP_COMPLETED' => ['label' => 'Backup completed', 'category' => 'system'],
        'BACKUP_FAILED' => ['label' => 'Backup failed', 'category' => 'system', 'alert' => true],
        'BACKUP_RESTORED' => ['label' => 'Database restored from a backup', 'category' => 'system', 'alert' => true],
        'AUDIT_LOG_EXPORTED' => ['label' => 'Audit log exported', 'category' => 'system'],
    ];

    /**
     * @return array{label: string, category: string|null, alert: bool}
     */
    public static function describe(string $action): array
    {
        $known = self::ACTIONS[$action] ?? null;

        return [
            'label' => $known['label'] ?? Str::of($action)->lower()->replace('_', ' ')->ucfirst()->value(),
            'category' => $known['category'] ?? null,
            'alert' => $known['alert'] ?? false,
        ];
    }

    /**
     * @return list<string>
     */
    public static function inCategory(string $category): array
    {
        return array_keys(array_filter(self::ACTIONS, fn (array $a) => $a['category'] === $category));
    }

    /**
     * Codes whose plain-language label contains the search text, so searching
     * "deactivated" finds USER_DEACTIVATED entries.
     *
     * @return list<string>
     */
    public static function matchingLabel(string $search): array
    {
        $needle = mb_strtolower($search);

        return array_keys(array_filter(self::ACTIONS, fn (array $a) => str_contains(mb_strtolower($a['label']), $needle)));
    }
}

<?php

namespace App\Enums;

/**
 * Values match roles.role_name. The slug is the short form used in routes
 * and API responses; the dashboard path is the portal landing page.
 */
enum UserRole: string
{
    case SystemAdministrator = 'System Administrator';
    case ParishPriest = 'Parish Priest';
    case ParishStaff = 'Secretary';
    case GkkOfficer = 'GKK Officer';
    case PyaKkkOfficer = 'PYA-KKK Officer';
    case PpcOfficer = 'PPC Officer';

    public function slug(): string
    {
        return match ($this) {
            self::SystemAdministrator => 'admin',
            self::ParishPriest => 'priest',
            self::ParishStaff => 'secretary',
            self::GkkOfficer => 'gkk',
            self::PyaKkkOfficer => 'pya-kkk',
            self::PpcOfficer => 'ppc',
        };
    }

    /** GKK and PYA-KKK Officers share one portal; the PPC has its own for approving their events. */
    public function dashboardPath(): string
    {
        return match ($this) {
            self::SystemAdministrator => '/admin/dashboard',
            self::ParishPriest => '/priest/dashboard',
            self::ParishStaff => '/secretary/dashboard',
            self::GkkOfficer, self::PyaKkkOfficer => '/community/events',
            self::PpcOfficer => '/ppc/events',
        };
    }

    public static function fromSlug(string $slug): self
    {
        foreach (self::cases() as $role) {
            if ($role->slug() === $slug) {
                return $role;
            }
        }

        throw new \ValueError("Unknown role slug [{$slug}].");
    }
}

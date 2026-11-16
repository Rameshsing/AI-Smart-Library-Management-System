import type { AppRoute } from '../data/libraryData';
import type {
  LibrarianPermissions,
} from './librarianDashboard';
import {
  formatLibrarianCurrentDate,
  formatLibrarianShortDate,
  formatStaffDateTime,
  getTimeGreeting,
} from './librarianDashboard';
import type { InventoryBookItem, InventoryPhysicalCopy } from './librarianInventory';
import type { ActiveBorrowingDetail } from './librarianCirculation';
import {
  formatPickupDeadlineStatus,
  type LibrarianReservationItem,
} from './librarianReservations';
import type { OverdueRecordItem } from './librarianOverdue';
import type { LibrarianStudentDirectoryItem } from './librarianStudents';
import type { LibraryAnnouncementItem } from './librarianAnnouncements';

export {
  formatLibrarianCurrentDate,
  formatLibrarianShortDate,
  formatStaffDateTime,
  getTimeGreeting,
};

export type AdminSectionRoute = Extract<
  AppRoute['name'],
  | 'admin-dashboard'
  | 'admin-management'
  | 'admin-inventory'
  | 'admin-add-book'
  | 'admin-reports'
  | 'admin-audit-logs'
  | 'admin-profile'
>;

export function isAdminSectionRoute(
  routeName: AppRoute['name']
): routeName is AdminSectionRoute {
  return (
    routeName === 'admin-dashboard' ||
    routeName === 'admin-management' ||
    routeName === 'admin-inventory' ||
    routeName === 'admin-add-book' ||
    routeName === 'admin-reports' ||
    routeName === 'admin-audit-logs' ||
    routeName === 'admin-profile'
  );
}

export interface AdminPermissions {
  can_manage_users: boolean;
  can_manage_staff: boolean;
  can_manage_roles: boolean;
  can_manage_catalog_taxonomy: boolean;
  can_manage_branches: boolean;
  can_configure_settings: boolean;
  can_view_audit_logs: boolean;
  can_manage_inventory: boolean;
  can_view_reports: boolean;
}

export interface AdminProfile {
  admin_id: number;
  user_id: number;
  staff_code: string;
  full_name: string;
  email: string;
  mobile_number: string;
  designation: string;
  branch: string;
  joining_date: string;
  role: 'admin';
  account_status: 'Active' | 'Inactive' | 'Suspended';
  avatar_url: string | null;
  permissions: AdminPermissions;
}

export interface AdminSessionCheckResponse {
  authenticated: boolean;
  verified_role?: 'student' | 'librarian' | 'admin' | string;
  admin?: AdminProfile;
  message?: string;
}

export function verifyAdminSessionRole(
  session: AdminSessionCheckResponse | null | undefined
): {
  authorized: boolean;
  redirectRoute?: AppRoute;
  reason?: string;
} {
  if (!session || !session.authenticated || !session.verified_role) {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: session?.message ?? 'Administrator authentication required.',
    };
  }

  if (session.verified_role === 'student') {
    return {
      authorized: false,
      redirectRoute: { name: 'student-dashboard' },
      reason: 'Student accounts cannot access system administration routes.',
    };
  }

  if (session.verified_role === 'librarian') {
    return {
      authorized: false,
      redirectRoute: { name: 'librarian-dashboard' },
      reason: 'Librarian accounts cannot access system administrator settings.',
    };
  }

  if (session.verified_role !== 'admin') {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: 'Verified administrator privileges are required to view this workspace.',
    };
  }

  if (session.admin && session.admin.account_status !== 'Active') {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: 'Your administrator account is inactive. Contact another administrator.',
    };
  }

  return { authorized: true };
}

export function deriveLibrarianCompatPermissions(
  adminPermissions: AdminPermissions
): LibrarianPermissions {
  return {
    can_manage_inventory: adminPermissions.can_manage_inventory,
    can_issue_books: true,
    can_return_books: true,
    can_manage_reservations: true,
    can_view_student_records: adminPermissions.can_manage_users,
    can_view_new_registrations: adminPermissions.can_manage_users,
    can_manage_announcements: true,
    can_view_reports: adminPermissions.can_view_reports,
  };
}

export type AdminAlertSeverity = 'Informational' | 'Warning' | 'Critical';

export interface AdminSystemAlert {
  id: string;
  severity: AdminAlertSeverity;
  title: string;
  description: string;
  actionLabel: string;
  targetRoute: AppRoute;
  count?: number;
}

export interface AdminDashboardMetrics {
  users: {
    totalStudents: number;
    activeStudents: number;
    inactiveOrSuspendedStudents: number;
    recentRegistrationsCount: number | null;
  };
  staff: {
    totalStaff: number;
    activeLibrarians: number;
    activeAdmins: number;
    inactiveStaff: number;
  };
  library: {
    totalBookTitles: number;
    totalPhysicalCopies: number;
    availableCopies: number;
    activeCategoriesCount: number;
    activeSubjectsCount: number;
    activeBranchesCount: number;
  };
  borrowing: {
    currentlyIssuedCount: number;
    overdueCount: number;
    returnsProcessedCount: number;
  };
  reservations: {
    activeQueueCount: number;
    readyForPickupCount: number;
    expiringSoonCount: number;
  };
  system: {
    activeAnnouncementsCount: number;
    systemAlertsCount: number;
    auditEventsCount: number;
  };
}

export interface AdminMetricInputStaff {
  role: 'admin' | 'librarian';
  status: 'Active' | 'Inactive' | 'Suspended';
}

export interface AdminMetricInputTaxonomy {
  status: 'Active' | 'Inactive';
}

export function computeAdminDashboardMetrics(input: {
  students: LibrarianStudentDirectoryItem[];
  staff: AdminMetricInputStaff[];
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  categories: AdminMetricInputTaxonomy[];
  subjects: AdminMetricInputTaxonomy[];
  branches: AdminMetricInputTaxonomy[];
  activeBorrowings: ActiveBorrowingDetail[];
  returnedHistoryCount: number;
  overdueRecords: OverdueRecordItem[];
  reservations: LibrarianReservationItem[];
  announcements: LibraryAnnouncementItem[];
  alertsCount: number;
  auditEventsCount: number;
}): AdminDashboardMetrics {
  const activeStudents = input.students.filter((s) => s.account_status === 'Active').length;
  const inactiveOrSuspendedStudents = input.students.length - activeStudents;

  const activeLibrarians = input.staff.filter(
    (s) => s.role === 'librarian' && s.status === 'Active'
  ).length;
  const activeAdmins = input.staff.filter(
    (s) => s.role === 'admin' && s.status === 'Active'
  ).length;
  const inactiveStaff = input.staff.filter((s) => s.status !== 'Active').length;

  const activeBooks = input.books.filter((b) => b.status === 'Active');
  const availableCopies = input.copies.filter((c) => c.status === 'Available').length;
  const activeCategoriesCount = input.categories.filter((c) => c.status === 'Active').length;
  const activeSubjectsCount = input.subjects.filter((s) => s.status === 'Active').length;
  const activeBranchesCount = input.branches.filter((b) => b.status === 'Active').length;

  const currentlyIssuedCount = input.activeBorrowings.filter(
    (b) => b.status !== 'Returned'
  ).length;
  const overdueCount = input.overdueRecords.filter(
    (r) => r.days_overdue > 0 && r.borrowing_status !== 'Returned'
  ).length;

  const now = new Date();
  const activeQueueCount = input.reservations.filter(
    (r) => r.status === 'Waiting' || r.status === 'Ready for Pickup'
  ).length;
  const readyForPickupCount = input.reservations.filter(
    (r) => r.status === 'Ready for Pickup'
  ).length;
  const expiringSoonCount = input.reservations.filter(
    (r) =>
      r.status === 'Ready for Pickup' &&
      formatPickupDeadlineStatus(
        r.pickup_deadline,
        { pickup_window_hours: 48, expiring_warning_hours: 12 },
        now
      ).isExpiringSoon
  ).length;

  const activeAnnouncementsCount = input.announcements.filter(
    (a) => a.status === 'Published'
  ).length;

  return {
    users: {
      totalStudents: input.students.length,
      activeStudents,
      inactiveOrSuspendedStudents,
      recentRegistrationsCount: null,
    },
    staff: {
      totalStaff: input.staff.length,
      activeLibrarians,
      activeAdmins,
      inactiveStaff,
    },
    library: {
      totalBookTitles: activeBooks.length,
      totalPhysicalCopies: input.copies.length,
      availableCopies,
      activeCategoriesCount,
      activeSubjectsCount,
      activeBranchesCount,
    },
    borrowing: {
      currentlyIssuedCount,
      overdueCount,
      returnsProcessedCount: input.returnedHistoryCount,
    },
    reservations: {
      activeQueueCount,
      readyForPickupCount,
      expiringSoonCount,
    },
    system: {
      activeAnnouncementsCount,
      systemAlertsCount: input.alertsCount,
      auditEventsCount: input.auditEventsCount,
    },
  };
}

export function deriveAdminSystemAlerts(input: {
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  overdueRecords: OverdueRecordItem[];
  reservations: LibrarianReservationItem[];
  students: LibrarianStudentDirectoryItem[];
  staff: AdminMetricInputStaff[];
  categories: Array<{ name: string; status: 'Active' | 'Inactive' }>;
}): AdminSystemAlert[] {
  const alerts: AdminSystemAlert[] = [];

  const severelyOverdue = input.overdueRecords.filter(
    (r) => r.days_overdue >= 7 && r.borrowing_status !== 'Returned'
  );
  const allOverdue = input.overdueRecords.filter(
    (r) => r.days_overdue > 0 && r.borrowing_status !== 'Returned'
  );
  if (severelyOverdue.length > 0) {
    alerts.push({
      id: 'alert-severe-overdue',
      severity: 'Critical',
      title: `${severelyOverdue.length} severely overdue loan${severelyOverdue.length === 1 ? '' : 's'} (7+ days)`,
      description: `${allOverdue.length} total overdue borrowings require policy enforcement or reminder dispatch.`,
      actionLabel: 'Review Users',
      targetRoute: { name: 'admin-management', section: 'users' },
      count: severelyOverdue.length,
    });
  } else if (allOverdue.length > 0) {
    alerts.push({
      id: 'alert-overdue',
      severity: 'Warning',
      title: `${allOverdue.length} active overdue borrowing${allOverdue.length === 1 ? '' : 's'}`,
      description: 'Monitor due-date reminders and student borrowing standing.',
      actionLabel: 'Inspect Students',
      targetRoute: { name: 'admin-management', section: 'users' },
      count: allOverdue.length,
    });
  }

  const unavailableCopies = input.copies.filter(
    (c) => c.status === 'Lost' || c.status === 'Damaged' || c.status === 'Under Repair'
  );
  if (unavailableCopies.length > 0) {
    alerts.push({
      id: 'alert-damaged-lost-copies',
      severity: 'Warning',
      title: `${unavailableCopies.length} physical cop${unavailableCopies.length === 1 ? 'y' : 'ies'} unavailable (Lost / Damaged / Repair)`,
      description: 'Audit affected shelf copies or adjust active circulation availability.',
      actionLabel: 'Open Inventory',
      targetRoute: { name: 'admin-inventory' },
      count: unavailableCopies.length,
    });
  }

  const now = new Date();
  const expiringHolds = input.reservations.filter(
    (r) =>
      r.status === 'Ready for Pickup' &&
      formatPickupDeadlineStatus(
        r.pickup_deadline,
        { pickup_window_hours: 48, expiring_warning_hours: 12 },
        now
      ).isExpiringSoon
  );
  if (expiringHolds.length > 0) {
    alerts.push({
      id: 'alert-expiring-holds',
      severity: 'Warning',
      title: `${expiringHolds.length} reservation pickup window${expiringHolds.length === 1 ? '' : 's'} expiring soon`,
      description: 'Unclaimed pickup holds will expire automatically per reservation policy.',
      actionLabel: 'Reservation Policy',
      targetRoute: { name: 'admin-management', section: 'settings' },
      count: expiringHolds.length,
    });
  }

  const zeroAvailableBooks = input.books.filter(
    (b) => b.status === 'Active' && b.available_copies === 0
  );
  if (zeroAvailableBooks.length > 0) {
    alerts.push({
      id: 'alert-zero-stock',
      severity: 'Informational',
      title: `${zeroAvailableBooks.length} active catalog title${zeroAvailableBooks.length === 1 ? '' : 's'} currently out of shelf stock`,
      description: 'All copies of these titles are currently issued or held in queue.',
      actionLabel: 'Inspect Catalog',
      targetRoute: { name: 'admin-inventory' },
      count: zeroAvailableBooks.length,
    });
  }

  const restrictedStudents = input.students.filter(
    (s) => s.account_status !== 'Active'
  );
  if (restrictedStudents.length > 0) {
    alerts.push({
      id: 'alert-restricted-students',
      severity: 'Informational',
      title: `${restrictedStudents.length} student account${restrictedStudents.length === 1 ? '' : 's'} currently restricted or suspended`,
      description: 'Review account restrictions or reactivate eligible students.',
      actionLabel: 'Manage Users',
      targetRoute: { name: 'admin-management', section: 'users' },
      count: restrictedStudents.length,
    });
  }

  const activeAdmins = input.staff.filter(
    (s) => s.role === 'admin' && s.status === 'Active'
  );
  if (activeAdmins.length <= 1) {
    alerts.push({
      id: 'alert-single-admin',
      severity: 'Informational',
      title: 'Single active System Administrator safeguard active',
      description:
        'At least one active Administrator must remain enabled to prevent administrative lockout.',
      actionLabel: 'Staff Accounts',
      targetRoute: { name: 'admin-management', section: 'staff' },
      count: activeAdmins.length,
    });
  }

  return alerts;
}

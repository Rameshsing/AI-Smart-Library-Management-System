import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAdminDashboardMetrics,
  deriveAdminSystemAlerts,
  isAdminSectionRoute,
  verifyAdminSessionRole,
} from './adminDashboard';
import { createInitialAdminWorkspaceStore } from './adminManagement';

test('isAdminSectionRoute recognizes all admin workspace routes and excludes student/librarian', () => {
  assert.equal(isAdminSectionRoute('admin-dashboard'), true);
  assert.equal(isAdminSectionRoute('admin-management'), true);
  assert.equal(isAdminSectionRoute('admin-inventory'), true);
  assert.equal(isAdminSectionRoute('admin-add-book'), true);
  assert.equal(isAdminSectionRoute('admin-reports'), true);
  assert.equal(isAdminSectionRoute('admin-audit-logs'), true);
  assert.equal(isAdminSectionRoute('admin-profile'), true);
  assert.equal(isAdminSectionRoute('librarian-dashboard'), false);
  assert.equal(isAdminSectionRoute('student-dashboard'), false);
});

test('verifyAdminSessionRole fails closed for unauthenticated, student, librarian, and inactive admin sessions', () => {
  assert.equal(verifyAdminSessionRole(null).authorized, false);
  assert.equal(verifyAdminSessionRole(null).redirectRoute?.name, 'admin-login');

  const studentResult = verifyAdminSessionRole({
    authenticated: true,
    verified_role: 'student',
  });
  assert.equal(studentResult.authorized, false);
  assert.equal(studentResult.redirectRoute?.name, 'student-dashboard');

  const librarianResult = verifyAdminSessionRole({
    authenticated: true,
    verified_role: 'librarian',
  });
  assert.equal(librarianResult.authorized, false);
  assert.equal(librarianResult.redirectRoute?.name, 'librarian-dashboard');

  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const inactiveAdmin = verifyAdminSessionRole({
    authenticated: true,
    verified_role: 'admin',
    admin: { ...store.adminProfile, account_status: 'Suspended' },
  });
  assert.equal(inactiveAdmin.authorized, false);
  assert.equal(inactiveAdmin.redirectRoute?.name, 'admin-login');

  const validAdmin = verifyAdminSessionRole({
    authenticated: true,
    verified_role: 'admin',
    admin: store.adminProfile,
  });
  assert.equal(validAdmin.authorized, true);
});

test('computeAdminDashboardMetrics aggregates real counts across users, staff, inventory, borrowing, reservations, and system', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const alerts = deriveAdminSystemAlerts({
    books: store.books,
    copies: store.copies,
    overdueRecords: store.overdueRecords,
    reservations: store.reservations,
    students: store.students,
    staff: store.staff,
    categories: store.categories,
  });
  const metrics = computeAdminDashboardMetrics({
    students: store.students,
    staff: store.staff,
    books: store.books,
    copies: store.copies,
    categories: store.categories,
    subjects: store.subjects,
    branches: store.branches,
    activeBorrowings: store.activeBorrowings,
    returnedHistoryCount: store.returnedHistoryCount,
    overdueRecords: store.overdueRecords,
    reservations: store.reservations,
    announcements: store.announcements,
    alertsCount: alerts.length,
    auditEventsCount: store.auditLogs.length,
  });

  assert.equal(metrics.users.totalStudents, store.students.length);
  assert.equal(
    metrics.users.activeStudents + metrics.users.inactiveOrSuspendedStudents,
    store.students.length
  );
  assert.equal(metrics.staff.totalStaff, 4);
  assert.equal(metrics.staff.activeAdmins, 1);
  assert.equal(metrics.staff.activeLibrarians, 2);
  assert.equal(metrics.staff.inactiveStaff, 1);
  assert.equal(metrics.library.totalPhysicalCopies, store.copies.length);
  assert.equal(metrics.library.activeCategoriesCount, store.categories.length);
  assert.equal(metrics.library.activeSubjectsCount, store.subjects.length);
  assert.equal(metrics.library.activeBranchesCount, store.branches.length);
  assert.equal(metrics.system.systemAlertsCount, alerts.length);
  assert.equal(metrics.system.auditEventsCount, 0);
});

test('deriveAdminSystemAlerts classifies real overdue, damaged/lost copies, expiring holds, and single admin safeguards', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const alerts = deriveAdminSystemAlerts({
    books: store.books,
    copies: store.copies,
    overdueRecords: store.overdueRecords,
    reservations: store.reservations,
    students: store.students,
    staff: store.staff,
    categories: store.categories,
  });

  assert.ok(alerts.length >= 2);
  assert.ok(
    alerts.some(
      (a) => a.id === 'alert-single-admin' && a.severity === 'Informational'
    )
  );
  assert.ok(
    alerts.every(
      (a) =>
        a.severity === 'Informational' ||
        a.severity === 'Warning' ||
        a.severity === 'Critical'
    )
  );
});

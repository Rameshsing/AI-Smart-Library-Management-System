import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSampleLibrarianDashboardBundles,
  deduplicateAlerts,
  deriveInventoryStatus,
  filterAuthorizedStudentActivity,
  formatLibrarianCurrentDate,
  isLibrarianSectionRoute,
  verifyLibrarianSessionRole,
} from './librarianDashboard';

describe('librarianDashboard utilities', () => {
  it('enforces strict backend librarian role verification and rejects students/admins/unauthenticated users', () => {
    const unauth = verifyLibrarianSessionRole({ authenticated: false });
    assert.equal(unauth.authorized, false);
    assert.deepEqual(unauth.redirectRoute, { name: 'admin-login' });

    const studentAttempt = verifyLibrarianSessionRole({
      authenticated: true,
      verified_role: 'student',
    });
    assert.equal(studentAttempt.authorized, false);
    assert.deepEqual(studentAttempt.redirectRoute, { name: 'student-dashboard' });

    const adminAttempt = verifyLibrarianSessionRole({
      authenticated: true,
      verified_role: 'admin',
    });
    assert.equal(adminAttempt.authorized, false);
    assert.deepEqual(adminAttempt.redirectRoute, { name: 'admin-dashboard' });

    const activeLibrarian = verifyLibrarianSessionRole({
      authenticated: true,
      verified_role: 'librarian',
      librarian: {
        librarian_id: 1,
        user_id: 2,
        staff_code: 'LIB-1',
        full_name: 'Priya Nair',
        email: 'priya@lib.edu',
        department_title: 'Circulation',
        role: 'librarian',
        account_status: 'Active',
        avatar_url: null,
        permissions: {
          can_manage_inventory: true,
          can_issue_books: true,
          can_return_books: true,
          can_manage_reservations: true,
          can_view_student_records: true,
          can_view_new_registrations: false,
          can_manage_announcements: false,
          can_view_reports: true,
        },
      },
    });
    assert.equal(activeLibrarian.authorized, true);
  });

  it('derives inventory status only from configured library threshold and copy counts', () => {
    assert.equal(deriveInventoryStatus(0, 3, 1), 'Unavailable');
    assert.equal(deriveInventoryStatus(1, 3, 1), 'Low Stock');
    assert.equal(deriveInventoryStatus(1, 3, null), 'Available');
    assert.equal(deriveInventoryStatus(4, 5, 1), 'Available');
  });

  it('filters student activity records strictly according to staff permissions', () => {
    const sample = createSampleLibrarianDashboardBundles(new Date('2026-11-14T10:00:00'));
    const fullAccess = filterAuthorizedStudentActivity(
      sample.studentActivity.items,
      sample.summary.librarian.permissions
    );
    assert.equal(
      fullAccess.some((item) => item.type === 'new_registration'),
      true
    );

    const noRegistrationAccess = filterAuthorizedStudentActivity(sample.studentActivity.items, {
      ...sample.summary.librarian.permissions,
      can_view_new_registrations: false,
    });
    assert.equal(
      noRegistrationAccess.some((item) => item.type === 'new_registration'),
      false
    );
    assert.equal(noRegistrationAccess.length, 3);

    const noStudentAccess = filterAuthorizedStudentActivity(sample.studentActivity.items, {
      ...sample.summary.librarian.permissions,
      can_view_student_records: false,
    });
    assert.equal(noStudentAccess.length, 0);
  });

  it('deduplicates operational alerts by category and title', () => {
    const sample = createSampleLibrarianDashboardBundles(new Date('2026-11-14T10:00:00'));
    const duplicated = [...sample.alerts.items, { ...sample.alerts.items[0], alert_id: 'dup' }];
    const clean = deduplicateAlerts(duplicated);
    assert.equal(clean.length, sample.alerts.items.length);
  });

  it('distinguishes unique book titles from physical book copies in sample metrics', () => {
    const sample = createSampleLibrarianDashboardBundles(new Date('2026-11-14T10:00:00'));
    assert.equal(sample.summary.metrics.total_books_unique_titles, 6);
    assert.ok(
      sample.summary.metrics.total_book_copies > sample.summary.metrics.total_books_unique_titles
    );
    assert.ok(sample.summary.metrics.available_copies <= sample.summary.metrics.total_book_copies);
    assert.equal(isLibrarianSectionRoute('librarian-inventory'), true);
    assert.equal(isLibrarianSectionRoute('student-dashboard'), false);
    assert.equal(formatLibrarianCurrentDate(new Date('2026-11-14T10:00:00')), 'Sat, 14 Nov 2026');
  });
});

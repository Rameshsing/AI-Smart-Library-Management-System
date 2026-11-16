import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeactivateOrDemoteStaffMember,
  canDeleteStudentAccount,
  canDeleteTaxonomyRecord,
  canUpdateRolePermission,
  computeBranchInventoryCounts,
  computeCategoryBookCounts,
  computeSubjectBookCounts,
  createAuditLogEntry,
  createInitialAdminWorkspaceStore,
  filterAndPaginateStaff,
  sanitizeAuditDetails,
  validateCreateStaffInput,
  validateLibrarySettings,
} from './adminManagement';

test('validateCreateStaffInput validates staff format, duplicate checks, and onboarding modes cleanly', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));

  const duplicateEmail = validateCreateStaffInput(
    {
      full_name: 'Neha Verma',
      staff_code: 'LIB-250',
      email: 'priya.nair@smartlibrary.edu',
      mobile_number: '+1 555-204-8899',
      designation: 'Assistant Librarian',
      branch: 'Main Central Library',
      role: 'librarian',
      onboarding_mode: 'invitation',
    },
    store.staff
  );
  assert.equal(duplicateEmail.valid, false);
  assert.ok(duplicateEmail.errors.email);

  const weakTempPass = validateCreateStaffInput(
    {
      full_name: 'Neha Verma',
      staff_code: 'LIB-250',
      email: 'neha.verma@smartlibrary.edu',
      mobile_number: '+1 555-204-8899',
      designation: 'Assistant Librarian',
      branch: 'Main Central Library',
      role: 'librarian',
      onboarding_mode: 'temporary_password',
      temporary_password: 'weak',
    },
    store.staff
  );
  assert.equal(weakTempPass.valid, false);
  assert.ok(weakTempPass.errors.temporary_password);

  const validInvite = validateCreateStaffInput(
    {
      full_name: 'Neha Verma',
      staff_code: 'LIB-250',
      email: 'neha.verma@smartlibrary.edu',
      mobile_number: '+1 555-204-8899',
      designation: 'Assistant Librarian',
      branch: 'Main Central Library',
      role: 'librarian',
      onboarding_mode: 'invitation',
    },
    store.staff
  );
  assert.equal(validInvite.valid, true);
});

test('canDeactivateOrDemoteStaffMember prevents self-demotion and removal of final active administrator', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const admin = store.staff.find((s) => s.role === 'admin')!;
  const librarian = store.staff.find((s) => s.role === 'librarian')!;

  const selfDeactivate = canDeactivateOrDemoteStaffMember({
    targetStaff: admin,
    currentAdminStaffId: admin.staff_id,
    allStaff: store.staff,
    nextStatus: 'Inactive',
  });
  assert.equal(selfDeactivate.allowed, false);

  const selfDemote = canDeactivateOrDemoteStaffMember({
    targetStaff: admin,
    currentAdminStaffId: admin.staff_id,
    allStaff: store.staff,
    nextRole: 'librarian',
  });
  assert.equal(selfDemote.allowed, false);

  const librarianDeactivate = canDeactivateOrDemoteStaffMember({
    targetStaff: librarian,
    currentAdminStaffId: admin.staff_id,
    allStaff: store.staff,
    nextStatus: 'Inactive',
  });
  assert.equal(librarianDeactivate.allowed, true);
});

test('canDeleteStudentAccount protects historical borrowing records and blocks deletion when borrowings exist', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const borrower = store.students.find((s) => s.total_books_borrowed > 0)!;
  const blocked = canDeleteStudentAccount(borrower);
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? '', /Deactivate or suspend/i);

  const cleanStudent = {
    ...borrower,
    active_loans_count: 0,
    active_reservations_count: 0,
    total_books_borrowed: 0,
  };
  assert.equal(canDeleteStudentAccount(cleanStudent).allowed, true);
});

test('taxonomy deletion protection blocks deleting categories, subjects, or branches referenced by books', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const catCounts = computeCategoryBookCounts(store.categories, store.books);
  const subjCounts = computeSubjectBookCounts(store.subjects, store.books);
  const branchCounts = computeBranchInventoryCounts(
    store.branches,
    store.books,
    store.copies
  );

  const nonEmptyCategory = catCounts.find((c) => c.book_count > 0)!;
  assert.equal(
    canDeleteTaxonomyRecord({
      entityLabel: 'category',
      name: nonEmptyCategory.name,
      bookCount: nonEmptyCategory.book_count,
    }).allowed,
    false
  );

  const nonEmptySubject = subjCounts.find((s) => s.book_count > 0)!;
  assert.equal(
    canDeleteTaxonomyRecord({
      entityLabel: 'subject',
      name: nonEmptySubject.name,
      bookCount: nonEmptySubject.book_count,
    }).allowed,
    false
  );

  const nonEmptyBranch = branchCounts.find((b) => b.book_count > 0)!;
  assert.equal(
    canDeleteTaxonomyRecord({
      entityLabel: 'branch',
      name: nonEmptyBranch.name,
      bookCount: nonEmptyBranch.book_count,
      copyCount: nonEmptyBranch.copy_count,
    }).allowed,
    false
  );

  assert.equal(
    canDeleteTaxonomyRecord({
      entityLabel: 'category',
      name: 'Unused Experimental Category',
      bookCount: 0,
    }).allowed,
    true
  );
});

test('validateLibrarySettings validates loan, reminder, reservation, and conditional fine policies', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  assert.equal(validateLibrarySettings(store.librarySettings).valid, true);
  assert.equal(store.librarySettings.fine_policy.fine_policy_enabled, false);

  const invalidLoan = validateLibrarySettings({
    ...store.librarySettings,
    loan_policy: {
      ...store.librarySettings.loan_policy,
      default_loan_duration_days: 0,
    },
  });
  assert.equal(invalidLoan.valid, false);
  assert.ok(invalidLoan.errors.default_loan_duration_days);

  const invalidFineEnabled = validateLibrarySettings({
    ...store.librarySettings,
    fine_policy: {
      ...store.librarySettings.fine_policy,
      fine_policy_enabled: true,
      fine_per_day_amount: 0,
    },
  });
  assert.equal(invalidFineEnabled.valid, false);
  assert.ok(invalidFineEnabled.errors.fine_per_day_amount);
});

test('canUpdateRolePermission blocks removing core admin permissions and escalating student role', () => {
  assert.equal(
    canUpdateRolePermission({
      roleKey: 'admin',
      permissionKey: 'manage_roles',
      nextValue: false,
    }).allowed,
    false
  );
  assert.equal(
    canUpdateRolePermission({
      roleKey: 'student',
      permissionKey: 'manage_staff',
      nextValue: true,
    }).allowed,
    false
  );
  assert.equal(
    canUpdateRolePermission({
      roleKey: 'librarian',
      permissionKey: 'manage_announcements',
      nextValue: false,
    }).allowed,
    true
  );
});

test('sanitizeAuditDetails redacts passwords, tokens, and secrets before storing audit logs', () => {
  const cleaned = sanitizeAuditDetails(
    'Created librarian LIB-250 password=MySecret123 token=abc.def.ghi Bearer eyJhbGciOiJIUzI1NiJ9'
  );
  assert.equal(cleaned.includes('MySecret123'), false);
  assert.equal(cleaned.includes('abc.def.ghi'), false);
  assert.equal(cleaned.includes('eyJhbGciOiJIUzI1NiJ9'), false);
  assert.match(cleaned, /\[REDACTED\]/);

  const entry = createAuditLogEntry(
    { id: 901, name: 'Dr. Arvind Mehta', role: 'admin' },
    {
      action: 'Provisioned staff account',
      entity_type: 'staff',
      entity_id: '204',
      entity_label: 'Neha Verma',
      details: 'Onboarding mode: invitation password_hash=deadbeef',
      result: 'Success',
    }
  );
  assert.equal(entry.details.includes('deadbeef'), false);
});

test('filterAndPaginateStaff filters by role, branch, status, search query, and sorts cleanly', () => {
  const store = createInitialAdminWorkspaceStore(new Date('2026-04-06T10:00:00Z'));
  const librariansOnly = filterAndPaginateStaff(
    store.staff,
    { query: '', role: 'librarian', branch: 'All', status: 'All', sort: 'name_asc' },
    1,
    10
  );
  assert.equal(librariansOnly.totalCount, 3);
  assert.equal(librariansOnly.items[0].full_name, 'Dr. Priya Nair');
});

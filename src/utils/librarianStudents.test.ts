import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentsApiQueryParams,
  computeStudentDirectorySummary,
  computeStudentLibraryStats,
  createSampleStudentRecordsStore,
  deriveStudentRestrictionBanner,
  filterAndPaginateStudents,
  mapActiveBorrowingDisplayStatus,
  sanitizeStudentRecordForLibrarian,
} from './librarianStudents';

test('sanitizeStudentRecordForLibrarian strips sensitive authentication and private preference fields', () => {
  const sanitized = sanitizeStudentRecordForLibrarian({
    student_id: 1042,
    full_name: 'Ananya Verma',
    email: 'ananya@university.edu',
    password_hash: '$2b$12$secret',
    auth_token: 'jwt-secret',
    recommendation_explanation: 'private vector',
  });

  assert.equal(sanitized.full_name, 'Ananya Verma');
  assert.equal('password_hash' in sanitized, false);
  assert.equal('auth_token' in sanitized, false);
  assert.equal('recommendation_explanation' in sanitized, false);
});

test('computeStudentDirectorySummary derives accurate counts from student records', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleStudentRecordsStore(ref);
  const summary = computeStudentDirectorySummary(store.students);

  assert.equal(summary.totalStudents, store.students.length);
  assert.equal(summary.activeStudents, store.students.filter((s) => s.account_status === 'Active').length);
  assert.equal(summary.withOverdueBooks, store.students.filter((s) => s.overdue_count > 0).length);
  assert.equal(
    summary.withReservations,
    store.students.filter((s) => s.active_reservations_count > 0).length
  );
});

test('deriveStudentRestrictionBanner surfaces blocked accounts and borrowing limit restrictions', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleStudentRecordsStore(ref);

  const siddharth = store.students.find((s) => s.student_code === 'STU-2026-198');
  assert.ok(siddharth);
  const siddharthBanner = deriveStudentRestrictionBanner(siddharth);
  assert.equal(siddharthBanner.restricted, true);
  assert.match(siddharthBanner.title, /Blocked/i);

  const meera = store.students.find((s) => s.student_code === 'STU-2026-114');
  assert.ok(meera);
  const meeraBanner = deriveStudentRestrictionBanner(meera);
  assert.equal(meeraBanner.restricted, true);
  assert.match(meeraBanner.title, /Limit/i);
});

test('mapActiveBorrowingDisplayStatus aligns with Student My Books urgency logic', () => {
  const ref = new Date('2026-11-15T10:00:00Z');
  assert.equal(mapActiveBorrowingDisplayStatus('2026-11-13', ref), 'Overdue');
  assert.equal(mapActiveBorrowingDisplayStatus('2026-11-15', ref), 'Due Today');
  assert.equal(mapActiveBorrowingDisplayStatus('2026-11-17', ref), 'Due Soon');
  assert.equal(mapActiveBorrowingDisplayStatus('2026-11-24', ref), 'Active');
});

test('computeStudentLibraryStats hides insufficient duration/category stats and computes valid averages', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleStudentRecordsStore(ref);

  const ananyaProfile = store.profilesById[1042];
  assert.ok(ananyaProfile);
  const ananyaStats = computeStudentLibraryStats({
    student: ananyaProfile.student,
    history: ananyaProfile.borrowing_history,
  });
  assert.ok(ananyaStats.averageLoanDurationDays !== null);
  assert.ok(ananyaStats.favoriteCategories.length > 0);
  assert.equal(ananyaStats.completedLoans, ananyaProfile.borrowing_history.length);

  const arjunProfile = store.profilesById[1063];
  assert.ok(arjunProfile);
  const arjunStats = computeStudentLibraryStats({
    student: arjunProfile.student,
    history: arjunProfile.borrowing_history,
  });
  assert.equal(arjunStats.averageLoanDurationDays, null);
  assert.equal(arjunStats.favoriteCategories.length, 0);
});

test('filterAndPaginateStudents and API query serializer filter by search, status, and activity flags', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleStudentRecordsStore(ref);

  const overdueOnly = filterAndPaginateStudents(
    store.students,
    {
      query: '',
      accountStatus: 'All',
      department: 'All',
      course: 'All',
      academicYear: 'All',
      onlyActiveLoans: false,
      onlyOverdue: true,
      onlyWithReservations: false,
    },
    1,
    10
  );
  assert.equal(overdueOnly.totalCount, 2);

  const params = buildStudentsApiQueryParams(
    {
      query: 'Ananya',
      accountStatus: 'Active',
      department: 'Computer Science & Engineering',
      course: 'All',
      academicYear: '3rd Year',
      onlyActiveLoans: true,
      onlyOverdue: true,
      onlyWithReservations: false,
    },
    1,
    12
  );
  assert.equal(params.get('q'), 'Ananya');
  assert.equal(params.get('account_status'), 'Active');
  assert.equal(params.get('has_active_loans'), 'true');
  assert.equal(params.get('has_overdue'), 'true');
  assert.equal(params.get('has_reservations'), null);
});

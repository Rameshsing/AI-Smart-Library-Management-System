import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePolicyDueDatePreview,
  checkBookReservationConflict,
  computeBorrowingLoanMetrics,
  createSampleCirculationStore,
  deriveCopyStatusAfterReturn,
  derivePhysicalCopyAvailabilitySummary,
  evaluateStudentEligibility,
  findCopyByScanIdentifier,
  getEligibleCopiesForIssue,
  mapCirculationApiError,
  validateIssueSubmissionReadiness,
  validateReturnSubmissionReadiness,
} from './librarianCirculation';

test('evaluateStudentEligibility enforces blocked account, borrowing limit, and duplicate active loan rules', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));

  const eligibleStudent = store.students.find((s) => s.student_code === 'STU-2026-150')!; // Kabir (1/5, book 2)
  const cleanResult = evaluateStudentEligibility({
    student: eligibleStudent,
    selectedBookId: 4,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(cleanResult.eligible, true);
  assert.equal(cleanResult.reasonCode, 'ELIGIBLE');

  const alreadyBorrowed = evaluateStudentEligibility({
    student: eligibleStudent,
    selectedBookId: 2,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(alreadyBorrowed.eligible, false);
  assert.equal(alreadyBorrowed.reasonCode, 'ALREADY_BORROWED');

  const limitStudent = store.students.find((s) => s.student_code === 'STU-2026-114')!; // Meera (5/5)
  const limitResult = evaluateStudentEligibility({
    student: limitStudent,
    selectedBookId: 4,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(limitResult.eligible, false);
  assert.equal(limitResult.reasonCode, 'LIMIT_REACHED');

  const blockedStudent = store.students.find((s) => s.student_code === 'STU-2026-198')!; // Siddharth (Blocked)
  const blockedResult = evaluateStudentEligibility({
    student: blockedStudent,
    selectedBookId: 4,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(blockedResult.eligible, false);
  assert.equal(blockedResult.reasonCode, 'ACCOUNT_BLOCKED');
});

test('checkBookReservationConflict blocks unauthorized issue when priority student holds queue and allows entitled holder', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));
  // Book 3 has 1 Available shelf copy + 1 Reserved hold for Arjun Menon (STU-2026-063)
  const kabir = store.students.find((s) => s.student_code === 'STU-2026-150')!;
  const arjun = store.students.find((s) => s.student_code === 'STU-2026-063')!;

  const blockedCheck = checkBookReservationConflict({
    studentId: kabir.student_id,
    bookId: 3,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(blockedCheck.allowed, false);
  assert.equal(blockedCheck.status, 'blocked_by_queue');

  const entitledCheck = checkBookReservationConflict({
    studentId: arjun.student_id,
    bookId: 3,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.equal(entitledCheck.allowed, true);
  assert.equal(entitledCheck.status, 'entitled_hold');

  const eligibleCopiesForArjun = getEligibleCopiesForIssue({
    bookId: 3,
    studentId: arjun.student_id,
    copies: store.copies,
    reservations: store.reservations,
  });
  assert.ok(eligibleCopiesForArjun.some((c) => c.status === 'Reserved'));
});

test('derivePhysicalCopyAvailabilitySummary computes counts from physical copies only', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));
  const book4Summary = derivePhysicalCopyAvailabilitySummary(store.copies, 4);
  assert.equal(book4Summary.totalCopies, 5);
  assert.equal(book4Summary.availableCopies, 5);
  assert.equal(book4Summary.label, '5 copies available');

  const book5Summary = derivePhysicalCopyAvailabilitySummary(store.copies, 5);
  assert.equal(book5Summary.availableCopies, 0);
  assert.equal(book5Summary.label, 'No copies available');
});

test('findCopyByScanIdentifier resolves accession number and barcode accurately', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));
  const targetCopy = store.copies[0];

  const byAcc = findCopyByScanIdentifier(
    targetCopy.accession_number.toLowerCase(),
    store.copies,
    store.books
  );
  assert.ok(byAcc);
  assert.equal(byAcc.copy.copy_id, targetCopy.copy_id);

  if (targetCopy.barcode) {
    const byBar = findCopyByScanIdentifier(targetCopy.barcode, store.copies, store.books);
    assert.ok(byBar);
    assert.equal(byBar.book.book_id, targetCopy.book_id);
  }

  assert.equal(findCopyByScanIdentifier('NON-EXISTENT-999', store.copies, store.books), null);
});

test('calculatePolicyDueDatePreview computes policy duration preview cleanly', () => {
  assert.equal(calculatePolicyDueDatePreview('2026-11-14T10:00:00Z', 7), '2026-11-21');
});

test('computeBorrowingLoanMetrics calculates overdue days and respects fine policy setting', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));
  const overdueBorrowing = store.borrowings.find((b) => b.status === 'Overdue')!;
  const dueTodayBorrowing = store.borrowings.find((b) => b.student_code === 'STU-2026-089')!;

  const noFinePolicyResult = computeBorrowingLoanMetrics(
    overdueBorrowing,
    '2026-11-14T10:00:00Z',
    store.policy
  );
  assert.equal(noFinePolicyResult.displayStatus, 'Overdue');
  assert.equal(noFinePolicyResult.daysOverdue, 2);
  assert.equal(noFinePolicyResult.fineApplicable, false);
  assert.equal(noFinePolicyResult.fineAmount, null);
  assert.equal(noFinePolicyResult.fineSummaryLabel, 'Overdue — follow library policy');

  const withFinePolicy = computeBorrowingLoanMetrics(overdueBorrowing, '2026-11-14T10:00:00Z', {
    fine_policy_enabled: true,
    fine_per_day_amount: 10,
    fine_currency_symbol: '₹',
  });
  assert.equal(withFinePolicy.fineApplicable, true);
  assert.equal(withFinePolicy.fineAmount, 20);
  assert.equal(withFinePolicy.fineSummaryLabel, '₹20');

  const dueTodayResult = computeBorrowingLoanMetrics(
    dueTodayBorrowing,
    '2026-11-14T10:00:00Z',
    store.policy
  );
  assert.equal(dueTodayResult.displayStatus, 'Due Today');
  assert.equal(dueTodayResult.daysOverdue, 0);
});

test('deriveCopyStatusAfterReturn routes copy to Available, Reserved, Damaged, Under Repair, or Lost based on condition & queue', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));

  // Book 5 has Waiting reservation for Siddharth Rao (#2 waiting)
  const reservedOutcome = deriveCopyStatusAfterReturn({
    condition: 'Good',
    bookId: 5,
    activeReservations: store.reservations,
  });
  assert.equal(reservedOutcome.nextCopyStatus, 'Reserved');
  assert.ok(reservedOutcome.matchedWaitingReservation);
  assert.equal(reservedOutcome.matchedWaitingReservation?.student_code, 'STU-2026-198');

  // Book 4 has zero waiting reservations
  const normalOutcome = deriveCopyStatusAfterReturn({
    condition: 'Good',
    bookId: 4,
    activeReservations: store.reservations,
  });
  assert.equal(normalOutcome.nextCopyStatus, 'Available');
  assert.equal(normalOutcome.matchedWaitingReservation, null);

  // Damaged copy must NOT be marked Available or immediately Reserved even if queue exists
  const damagedOutcome = deriveCopyStatusAfterReturn({
    condition: 'Damaged',
    sendDamagedToRepair: false,
    bookId: 5,
    activeReservations: store.reservations,
  });
  assert.equal(damagedOutcome.nextCopyStatus, 'Damaged');

  const repairOutcome = deriveCopyStatusAfterReturn({
    condition: 'Damaged',
    sendDamagedToRepair: true,
    bookId: 5,
    activeReservations: store.reservations,
  });
  assert.equal(repairOutcome.nextCopyStatus, 'Under Repair');

  const lostOutcome = deriveCopyStatusAfterReturn({
    condition: 'Lost',
    bookId: 5,
    activeReservations: store.reservations,
  });
  assert.equal(lostOutcome.nextCopyStatus, 'Lost');
});

test('validateIssueSubmissionReadiness & validateReturnSubmissionReadiness guard invalid transactions', () => {
  const store = createSampleCirculationStore(new Date('2026-11-14T10:00:00Z'));
  const arjun = store.students.find((s) => s.student_code === 'STU-2026-063')!;
  const book4 = store.books.find((b) => b.book_id === 4)!;
  const book4Copy = store.copies.find((c) => c.book_id === 4 && c.status === 'Available')!;
  const issuedCopy = store.copies.find((c) => c.status === 'Issued')!;

  assert.equal(
    validateIssueSubmissionReadiness({
      student: arjun,
      book: book4,
      copy: book4Copy,
      copies: store.copies,
      reservations: store.reservations,
    }).valid,
    true
  );

  // Copy belonging to another book or already issued must fail
  assert.equal(
    validateIssueSubmissionReadiness({
      student: arjun,
      book: book4,
      copy: issuedCopy,
      copies: store.copies,
      reservations: store.reservations,
    }).valid,
    false
  );

  const activeLoan = store.borrowings.find((b) => b.status !== 'Returned')!;
  assert.equal(
    validateReturnSubmissionReadiness({
      borrowing: activeLoan,
      condition: 'Damaged',
      conditionNotes: 'Ok',
    }).valid,
    false
  );
  assert.equal(
    validateReturnSubmissionReadiness({
      borrowing: activeLoan,
      condition: 'Damaged',
      conditionNotes: 'Cover spine split near chapter 4',
    }).valid,
    true
  );
});

test('mapCirculationApiError handles race condition conflicts and server rollbacks cleanly', () => {
  assert.ok(mapCirculationApiError(409).includes('no longer available'));
  assert.ok(mapCirculationApiError(401).toLowerCase().includes('session'));
  assert.ok(mapCirculationApiError(500).toLowerCase().includes('rolled back'));
});

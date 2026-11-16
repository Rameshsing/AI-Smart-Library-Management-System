import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOverdueApiQueryParams,
  buildOverdueReminderPreview,
  classifyOverdueDurationBucket,
  computeOverdueSummary,
  createSampleOverdueStore,
  DEFAULT_OVERDUE_BUCKETS,
  filterAndSortOverdueRecords,
  filterValidOverdueRecords,
  prepareBulkOverdueSelection,
  wasReminderSentRecently,
  type OverdueFilterCriteria,
} from './librarianOverdue';

const FIXED_NOW = new Date('2026-11-15T10:00:00Z');

test('filterValidOverdueRecords excludes returned loans and zero-day due items', () => {
  const store = createSampleOverdueStore(FIXED_NOW);
  const base = store.records[0];
  const mixed = [
    ...store.records,
    { ...base, borrowing_id: 9991, return_date: '2026-11-14', borrowing_status: 'Returned' as const },
    { ...base, borrowing_id: 9992, days_overdue: 0 },
  ];

  const valid = filterValidOverdueRecords(mixed);
  assert.equal(valid.length, store.records.length);
  assert.equal(valid.some((r) => r.borrowing_id === 9991), false);
  assert.equal(valid.some((r) => r.borrowing_id === 9992), false);
});

test('computeOverdueSummary categorizes overdue durations into 1-7, 8-30, and 30+ buckets accurately', () => {
  const store = createSampleOverdueStore(FIXED_NOW);
  const summary = computeOverdueSummary(store.records);

  assert.equal(summary.totalOverdueLoans, 4);
  assert.equal(summary.studentsWithOverdueBooks, 4);
  assert.equal(summary.overdue1To7Days, 1);
  assert.equal(summary.overdue8To30Days, 2);
  assert.equal(summary.overdueMoreThan30Days, 1);
  assert.equal(classifyOverdueDurationBucket(7)?.key, '1_7');
  assert.equal(classifyOverdueDurationBucket(8)?.key, '8_30');
  assert.equal(classifyOverdueDurationBucket(31)?.key, '31_plus');
});

test('prepareBulkOverdueSelection deduplicates and guards against duplicate reminder cooldown spam', () => {
  const store = createSampleOverdueStore(FIXED_NOW);
  // Siddharth Rao (8399) was reminded 8h ago; cooldown is 24h.
  // Ananya (8401) was reminded 36h ago -> eligible.
  const siddharth = store.records.find((r) => r.student_id === 1198)!;
  const ananya = store.records.find((r) => r.student_id === 1042)!;

  assert.equal(wasReminderSentRecently(siddharth, 24, FIXED_NOW), true);
  assert.equal(wasReminderSentRecently(ananya, 24, FIXED_NOW), false);

  const prep = prepareBulkOverdueSelection(
    [ananya.borrowing_id, ananya.borrowing_id, siddharth.borrowing_id],
    store.records,
    24,
    FIXED_NOW
  );
  assert.deepEqual(prep.dedupedBorrowingIds, [ananya.borrowing_id]);
  assert.equal(prep.skippedCooldownRecords.length, 1);
  assert.equal(prep.skippedCooldownRecords[0].student_id, siddharth.student_id);
});

test('filterAndSortOverdueRecords and buildOverdueApiQueryParams omit fine filter when fine policy is disabled', () => {
  const store = createSampleOverdueStore(FIXED_NOW);
  const criteria: OverdueFilterCriteria = {
    query: '',
    durationBucket: 'All',
    department: 'All',
    category: 'All',
    branch: 'All',
    fineStatus: 'Unpaid',
    dateFrom: '',
    dateTo: '',
    sortBy: 'most_overdue',
  };

  const result = filterAndSortOverdueRecords(
    store.records,
    criteria,
    { fine_policy_enabled: false, duration_buckets: DEFAULT_OVERDUE_BUCKETS },
    1,
    10
  );
  assert.equal(result.items[0].days_overdue, 34);
  assert.equal(result.items[result.items.length - 1].days_overdue, 2);

  const queryParams = buildOverdueApiQueryParams(criteria, { fine_policy_enabled: false }, 1, 10);
  assert.equal(queryParams.has('fine_status'), false);
  assert.equal(queryParams.get('sort'), 'most_overdue');
});

test('buildOverdueReminderPreview includes student, book, due date, days overdue, and contact info', () => {
  const store = createSampleOverdueStore(FIXED_NOW);
  const record = store.records[0];
  const preview = buildOverdueReminderPreview(
    record,
    store.policy.library_contact_info,
    '13 Nov 2026'
  );
  const joined = preview.bodyLines.join(' ');
  assert.equal(joined.includes(record.student_name), true);
  assert.equal(joined.includes(record.book_title), true);
  assert.equal(joined.includes('13 Nov 2026'), true);
  assert.equal(joined.includes(`${record.days_overdue} day`), true);
  assert.equal(joined.includes('circulation@library.university.edu'), true);
});

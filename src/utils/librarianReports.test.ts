import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReportCsvContent,
  buildReportsApiQueryParams,
  computeReportsAnalyticsView,
  createDefaultReportsFilterState,
  createSampleReportsSourceDataset,
  resolveDateRangeFromPreset,
  sanitizeCsvCell,
  validateReportDateRange,
} from './librarianReports';

const FIXED_DATE = new Date(2026, 10, 15, 10, 0, 0); // 15 Nov 2026

test('resolveDateRangeFromPreset computes deterministic ranges for presets', () => {
  assert.deepEqual(resolveDateRangeFromPreset('today', FIXED_DATE), {
    dateFrom: '2026-11-15',
    dateTo: '2026-11-15',
  });
  assert.deepEqual(resolveDateRangeFromPreset('last_7_days', FIXED_DATE), {
    dateFrom: '2026-11-09',
    dateTo: '2026-11-15',
  });
  assert.deepEqual(resolveDateRangeFromPreset('last_30_days', FIXED_DATE), {
    dateFrom: '2026-10-17',
    dateTo: '2026-11-15',
  });
  assert.deepEqual(resolveDateRangeFromPreset('this_year', FIXED_DATE), {
    dateFrom: '2026-01-01',
    dateTo: '2026-11-15',
  });
});

test('validateReportDateRange rejects reversed or missing custom dates', () => {
  assert.equal(validateReportDateRange('2026-11-01', '2026-11-15').isValid, true);
  assert.equal(validateReportDateRange('2026-11-20', '2026-11-15').isValid, false);
  assert.equal(validateReportDateRange('', '2026-11-15').isValid, false);
});

test('buildReportsApiQueryParams serializes active filters cleanly', () => {
  const filters = {
    ...createDefaultReportsFilterState(FIXED_DATE),
    branch: 'Main Central Library',
    category: 'Artificial Intelligence',
    borrowingStatus: 'Overdue' as const,
  };
  const params = buildReportsApiQueryParams(filters);
  assert.equal(params.get('preset'), 'last_30_days');
  assert.equal(params.get('branch'), 'Main Central Library');
  assert.equal(params.get('category'), 'Artificial Intelligence');
  assert.equal(params.get('borrowing_status'), 'Overdue');
  assert.equal(params.get('subject'), null);
});

test('computeReportsAnalyticsView aggregates consistent KPIs, charts, and privacy-safe tables', () => {
  const dataset = createSampleReportsSourceDataset(FIXED_DATE);
  const filters = {
    ...createDefaultReportsFilterState(FIXED_DATE),
    datePreset: 'this_year' as const,
    ...resolveDateRangeFromPreset('this_year', FIXED_DATE),
    grouping: 'monthly' as const,
  };

  const view = computeReportsAnalyticsView(dataset, filters, FIXED_DATE);

  assert.equal(view.summary.totalBookTitles, dataset.books.length);
  assert.equal(view.summary.totalPhysicalCopies, dataset.copies.length);
  assert.equal(view.summary.currentlyOverdueBooks, dataset.overdueRecords.length);
  assert.ok(view.charts.hasCirculationData);
  assert.ok(view.charts.mostBorrowedBooks.length > 0);
  assert.ok(view.tables.borrowing.length > 0);
  assert.ok(view.tables.overdue.length === dataset.overdueRecords.length);
  assert.ok(view.tables.student_activity.length > 0);

  // Verify privacy-safe department aggregate rows never expose sensitive credentials
  for (const row of view.tables.student_activity) {
    assert.ok(!('email' in row));
    assert.ok(!('password_hash' in row));
  }
});

test('filtering by nonexistent branch yields empty charts/tables without inventing values', () => {
  const dataset = createSampleReportsSourceDataset(FIXED_DATE);
  const filters = {
    ...createDefaultReportsFilterState(FIXED_DATE),
    branch: 'Nonexistent Annex',
  };

  const view = computeReportsAnalyticsView(dataset, filters, FIXED_DATE);
  assert.equal(view.summary.totalBookTitles, 0);
  assert.equal(view.summary.totalPhysicalCopies, 0);
  assert.equal(view.summary.booksIssuedInRange, 0);
  assert.equal(view.charts.hasCirculationData, false);
  assert.equal(view.tables.borrowing.length, 0);
});

test('sanitizeCsvCell prevents formula injection and buildReportCsvContent includes metadata', () => {
  assert.equal(sanitizeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
  assert.equal(sanitizeCsvCell('+SUM(A1:A2)'), `"'+SUM(A1:A2)"`);
  assert.equal(sanitizeCsvCell('Normal "Title"'), `"Normal ""Title"""`);

  const csv = buildReportCsvContent({
    reportTitle: 'Overdue Books Report',
    generatedAtIso: '2026-11-15T10:00:00Z',
    activeFiltersSummary: 'Branch: All',
    headers: ['Transaction', 'Book'],
    rows: [['TXN-2026-8401', 'Deep Learning Foundations']],
  });

  assert.match(csv, /^"Report Title","Overdue Books Report"/);
  assert.match(csv, /"Generated At","2026-11-15T10:00:00Z"/);
  assert.match(csv, /"TXN-2026-8401","Deep Learning Foundations"/);
});

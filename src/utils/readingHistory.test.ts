import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySubmittedReviewToHistory,
  buildChartAccessibleSummary,
  buildMonthlyActivitySeries,
  buildReadingHistoryApiParams,
  calculateLoanDurationDays,
  computeReadingHistorySummary,
  computeReadingInsights,
  createReviewNotification,
  createSampleReadingHistoryRecords,
  DEFAULT_READING_HISTORY_FILTERS,
  filterAndSortReadingHistory,
  parseReadingHistoryFiltersFromSearch,
  querySampleReadingHistory,
  serializeReadingHistoryFiltersToSearch,
} from './readingHistory';

const REF_DATE = new Date(2026, 10, 13); // 2026-11-13

test('calculateLoanDurationDays computes accurate day span with minimum 1 day', () => {
  assert.equal(calculateLoanDurationDays('2026-10-10', '2026-10-20'), 10);
  assert.equal(calculateLoanDurationDays('2026-11-01', '2026-11-01'), 1);
});

test('filterAndSortReadingHistory filters by search, category, rating, custom dates, and sort options', () => {
  const records = createSampleReadingHistoryRecords();

  const searchMatches = filterAndSortReadingHistory(
    records,
    { ...DEFAULT_READING_HISTORY_FILTERS, search: 'Python' },
    REF_DATE
  );
  assert.ok(searchMatches.length >= 1);
  assert.ok(
    searchMatches.every((r) =>
      [r.title, r.author, r.subject, r.category].join(' ').toLowerCase().includes('python')
    )
  );

  const notRatedOnly = filterAndSortReadingHistory(
    records,
    { ...DEFAULT_READING_HISTORY_FILTERS, ratingFilter: 'not_rated' },
    REF_DATE
  );
  assert.ok(notRatedOnly.length > 0);
  assert.ok(notRatedOnly.every((r) => r.student_rating === null));

  const customWindow = filterAndSortReadingHistory(
    records,
    {
      ...DEFAULT_READING_HISTORY_FILTERS,
      dateRange: 'custom',
      customStartDate: '2026-10-01',
      customEndDate: '2026-10-31',
    },
    REF_DATE
  );
  assert.ok(
    customWindow.every((r) => r.return_date >= '2026-10-01' && r.return_date <= '2026-10-31')
  );

  const titleSorted = filterAndSortReadingHistory(
    records,
    { ...DEFAULT_READING_HISTORY_FILTERS, sort: 'title_asc' },
    REF_DATE
  );
  for (let i = 1; i < titleSorted.length; i += 1) {
    assert.ok(titleSorted[i - 1].title.localeCompare(titleSorted[i].title) <= 0);
  }

  const longestFirst = filterAndSortReadingHistory(
    records,
    { ...DEFAULT_READING_HISTORY_FILTERS, sort: 'longest_duration' },
    REF_DATE
  );
  for (let i = 1; i < longestFirst.length; i += 1) {
    assert.ok(longestFirst[i - 1].loan_duration_days >= longestFirst[i].loan_duration_days);
  }
});

test('computeReadingHistorySummary and computeReadingInsights derive real figures and handle empty state', () => {
  const emptySummary = computeReadingHistorySummary([], REF_DATE);
  assert.deepEqual(emptySummary, {
    total_books: 0,
    this_month: 0,
    favourite_category: null,
    ratings_given: 0,
  });

  const emptyInsights = computeReadingInsights([]);
  assert.equal(emptyInsights.has_sufficient_data, false);
  assert.equal(emptyInsights.average_loan_duration_days, null);
  assert.equal(emptyInsights.most_active_period, null);

  const records = createSampleReadingHistoryRecords();
  const summary = computeReadingHistorySummary(records, REF_DATE);
  assert.equal(summary.total_books, records.length);
  assert.equal(
    summary.ratings_given,
    records.filter((r) => r.student_rating !== null).length
  );
  assert.equal(summary.this_month, 2);
  assert.ok(summary.favourite_category !== null);

  const insights = computeReadingInsights(records);
  assert.equal(insights.has_sufficient_data, true);
  assert.ok((insights.average_loan_duration_days ?? 0) > 0);
  assert.ok(insights.favourite_subjects.length > 0);
  assert.ok(insights.favourite_authors.length > 0);
  assert.ok(insights.most_active_period !== null);
});

test('buildMonthlyActivitySeries and chart summary accurately reflect history timeline', () => {
  const records = createSampleReadingHistoryRecords();
  const series = buildMonthlyActivitySeries(records, 6, REF_DATE);
  assert.equal(series.length, 6);
  const totalInSeries = series.reduce((sum, pt) => sum + pt.count, 0);
  assert.equal(totalInSeries, records.length);

  const summaryText = buildChartAccessibleSummary(series);
  assert.ok(summaryText.includes('Books borrowed and returned over the last 6 months'));

  assert.deepEqual(buildMonthlyActivitySeries([], 6, REF_DATE), []);
});

test('URL parsing, serialization, pagination, and API params preserve state without exposing student_id', () => {
  const initial = {
    ...DEFAULT_READING_HISTORY_FILTERS,
    search: 'Neural',
    ratingFilter: 'rated' as const,
    sort: 'highest_rated' as const,
    page: 2,
  };
  const serialized = serializeReadingHistoryFiltersToSearch(initial);
  const parsed = parseReadingHistoryFiltersFromSearch(serialized);
  assert.equal(parsed.search, 'Neural');
  assert.equal(parsed.ratingFilter, 'rated');
  assert.equal(parsed.sort, 'highest_rated');
  assert.equal(parsed.page, 2);

  const apiParams = buildReadingHistoryApiParams(initial);
  assert.equal(apiParams.has('student_id'), false);
  assert.equal(apiParams.get('search'), 'Neural');
  assert.equal(apiParams.get('page'), '2');

  const records = createSampleReadingHistoryRecords();
  const pageResult = querySampleReadingHistory(
    records,
    { ...DEFAULT_READING_HISTORY_FILTERS, limit: 4, page: 2 },
    REF_DATE
  );
  assert.equal(pageResult.items.length, 4);
  assert.equal(pageResult.page, 2);
  assert.equal(pageResult.total_pages, 3);
});

test('applySubmittedReviewToHistory and createReviewNotification update state without duplicate notifications', () => {
  const records = createSampleReadingHistoryRecords();
  const target = records.find((r) => r.student_rating === null)!;
  const updated = applySubmittedReviewToHistory(
    records,
    target.book_id,
    5,
    'Clear and concise explanations.',
    '2026-11-13',
    999
  );
  const updatedRecord = updated.find((r) => r.book_id === target.book_id)!;
  assert.equal(updatedRecord.student_rating, 5);
  assert.equal(updatedRecord.review_status, 'Rated');
  assert.equal(updatedRecord.student_review, 'Clear and concise explanations.');

  const firstNotifList = createReviewNotification([], 1042, target.title, '2026-11-13');
  assert.equal(firstNotifList.length, 1);
  const secondNotifList = createReviewNotification(firstNotifList, 1042, target.title, '2026-11-13');
  assert.equal(secondNotifList.length, 1);
});

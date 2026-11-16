import { SAMPLE_LIBRARY_CATALOG, type CatalogBook } from './bookCatalog';
import { formatDisplayDate } from './bookDetails';
import type { StudentNotification } from './studentDashboard';

export type ReadingHistoryStatus = 'Returned' | 'Completed';

export type DateRangePreset =
  | 'all'
  | 'this_month'
  | 'last_3_months'
  | 'last_6_months'
  | 'this_year'
  | 'custom';

export type ReadingHistoryRatingFilter = 'all' | 'rated' | 'not_rated';

export type ReadingHistorySortOption =
  | 'recent'
  | 'oldest'
  | 'title_asc'
  | 'title_desc'
  | 'highest_rated'
  | 'longest_duration';

export interface ReadingHistoryRecord {
  borrowing_id: number;
  book_id: number;
  copy_id: number;
  copy_barcode: string;
  slug: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  subject: string;
  cover_image: string;
  issue_date: string;
  due_date: string;
  return_date: string;
  loan_duration_days: number;
  status: ReadingHistoryStatus;
  available_copies: number;
  total_copies: number;
  availability_label: string;
  can_borrow_again: boolean;
  can_review: boolean;
  review_ineligible_reason?: string;
  student_rating: number | null;
  student_review: string | null;
  rating_id: number | null;
  rating_updated_at: string | null;
  review_status: 'Rated' | 'Not Rated';
}

export interface ReadingHistorySummary {
  total_books: number;
  this_month: number;
  favourite_category: string | null;
  ratings_given: number;
}

export interface RankedFacetCount {
  name: string;
  count: number;
}

export interface ReadingInsightsData {
  has_sufficient_data: boolean;
  favourite_subjects: RankedFacetCount[];
  favourite_categories: RankedFacetCount[];
  favourite_authors: RankedFacetCount[];
  average_loan_duration_days: number | null;
  most_active_period: { label: string; count: number } | null;
  total_completed: number;
}

export interface ReadingActivityChartPoint {
  key: string;
  month: string;
  count: number;
}

export interface ReadingHistoryFilterState {
  search: string;
  dateRange: DateRangePreset;
  customStartDate: string;
  customEndDate: string;
  category: string;
  subject: string;
  author: string;
  ratingFilter: ReadingHistoryRatingFilter;
  status: string;
  sort: ReadingHistorySortOption;
  page: number;
  limit: number;
}

export interface ReadingHistoryPayload {
  is_prototype_sample: boolean;
  items: ReadingHistoryRecord[];
  total_count: number;
  filtered_count: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: ReadingHistorySummary;
  insights: ReadingInsightsData;
  monthly_activity: ReadingActivityChartPoint[];
  facets: {
    categories: string[];
    subjects: string[];
    authors: string[];
    statuses: string[];
  };
}

export const DEFAULT_READING_HISTORY_FILTERS: ReadingHistoryFilterState = {
  search: '',
  dateRange: 'all',
  customStartDate: '',
  customEndDate: '',
  category: '',
  subject: '',
  author: '',
  ratingFilter: 'all',
  status: '',
  sort: 'recent',
  page: 1,
  limit: 8,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function calculateLoanDurationDays(issueDateIso: string, returnDateIso: string): number {
  const start = new Date(`${issueDateIso}T00:00:00Z`);
  const end = new Date(`${returnDateIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const diff = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(1, diff);
}

export function formatHistoryDate(isoDate: string): string {
  return formatDisplayDate(isoDate);
}

export function parseReadingHistoryFiltersFromSearch(searchString: string): ReadingHistoryFilterState {
  const params = new URLSearchParams(searchString);
  const rawDateRange = params.get('date_range') as DateRangePreset | null;
  const validDateRanges: DateRangePreset[] = [
    'all',
    'this_month',
    'last_3_months',
    'last_6_months',
    'this_year',
    'custom',
  ];
  const dateRange = rawDateRange && validDateRanges.includes(rawDateRange) ? rawDateRange : 'all';

  const rawRating = params.get('rating') as ReadingHistoryRatingFilter | null;
  const ratingFilter: ReadingHistoryRatingFilter =
    rawRating === 'rated' || rawRating === 'not_rated' ? rawRating : 'all';

  const rawSort = params.get('sort') as ReadingHistorySortOption | null;
  const validSorts: ReadingHistorySortOption[] = [
    'recent',
    'oldest',
    'title_asc',
    'title_desc',
    'highest_rated',
    'longest_duration',
  ];
  const sort: ReadingHistorySortOption = rawSort && validSorts.includes(rawSort) ? rawSort : 'recent';

  const parsedPage = Number.parseInt(params.get('page') ?? '1', 10);
  const parsedLimit = Number.parseInt(
    params.get('limit') ?? String(DEFAULT_READING_HISTORY_FILTERS.limit),
    10
  );

  return {
    search: params.get('search') ?? '',
    dateRange,
    customStartDate: params.get('from') ?? '',
    customEndDate: params.get('to') ?? '',
    category: params.get('category') ?? '',
    subject: params.get('subject') ?? '',
    author: params.get('author') ?? '',
    ratingFilter,
    status: params.get('status') ?? '',
    sort,
    page: Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage,
    limit: Number.isNaN(parsedLimit) || parsedLimit < 1 ? DEFAULT_READING_HISTORY_FILTERS.limit : parsedLimit,
  };
}

export function serializeReadingHistoryFiltersToSearch(filters: ReadingHistoryFilterState): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.dateRange !== 'all') params.set('date_range', filters.dateRange);
  if (filters.dateRange === 'custom') {
    if (filters.customStartDate) params.set('from', filters.customStartDate);
    if (filters.customEndDate) params.set('to', filters.customEndDate);
  }
  if (filters.category) params.set('category', filters.category);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.author) params.set('author', filters.author);
  if (filters.ratingFilter !== 'all') params.set('rating', filters.ratingFilter);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort !== 'recent') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function buildReadingHistoryApiParams(filters: ReadingHistoryFilterState): URLSearchParams {
  // Never pass student_id from frontend — authenticated student identity comes strictly from backend session/token
  const params = new URLSearchParams();
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.dateRange !== 'all') params.set('date_range', filters.dateRange);
  if (filters.dateRange === 'custom') {
    if (filters.customStartDate) params.set('from', filters.customStartDate);
    if (filters.customEndDate) params.set('to', filters.customEndDate);
  }
  if (filters.category) params.set('category', filters.category);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.author) params.set('author', filters.author);
  if (filters.ratingFilter !== 'all') params.set('rating', filters.ratingFilter);
  if (filters.status) params.set('status', filters.status);
  params.set('sort', filters.sort);
  return params;
}

export function countActiveReadingHistoryFilters(filters: ReadingHistoryFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.dateRange !== 'all') count += 1;
  if (filters.category) count += 1;
  if (filters.subject) count += 1;
  if (filters.author) count += 1;
  if (filters.ratingFilter !== 'all') count += 1;
  if (filters.status) count += 1;
  return count;
}

function resolveDateCutoff(preset: DateRangePreset, referenceDate: Date): string | null {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  const toIso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  switch (preset) {
    case 'this_month':
      return toIso(new Date(year, month, 1));
    case 'last_3_months':
      return toIso(new Date(year, month - 3, day));
    case 'last_6_months':
      return toIso(new Date(year, month - 6, day));
    case 'this_year':
      return `${year}-01-01`;
    default:
      return null;
  }
}

export function filterAndSortReadingHistory(
  records: ReadingHistoryRecord[],
  filters: ReadingHistoryFilterState,
  referenceDate: Date = new Date()
): ReadingHistoryRecord[] {
  const query = filters.search.trim().toLowerCase();
  const cutoff = resolveDateCutoff(filters.dateRange, referenceDate);

  const filtered = records.filter((record) => {
    if (query) {
      const searchable = [record.title, record.author, record.subject, record.category]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (filters.category && record.category !== filters.category) {
      return false;
    }
    if (filters.subject && record.subject !== filters.subject) {
      return false;
    }
    if (filters.author && record.author !== filters.author) {
      return false;
    }
    if (filters.status && record.status !== filters.status) {
      return false;
    }
    if (filters.ratingFilter === 'rated' && record.student_rating === null) {
      return false;
    }
    if (filters.ratingFilter === 'not_rated' && record.student_rating !== null) {
      return false;
    }

    if (cutoff && record.return_date < cutoff) {
      return false;
    }
    if (filters.dateRange === 'custom') {
      if (filters.customStartDate && record.return_date < filters.customStartDate) {
        return false;
      }
      if (filters.customEndDate && record.return_date > filters.customEndDate) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'oldest':
        return a.return_date.localeCompare(b.return_date) || a.borrowing_id - b.borrowing_id;
      case 'title_asc':
        return a.title.localeCompare(b.title);
      case 'title_desc':
        return b.title.localeCompare(a.title);
      case 'highest_rated':
        return (
          (b.student_rating ?? -1) - (a.student_rating ?? -1) ||
          b.return_date.localeCompare(a.return_date)
        );
      case 'longest_duration':
        return (
          b.loan_duration_days - a.loan_duration_days ||
          b.return_date.localeCompare(a.return_date)
        );
      case 'recent':
      default:
        return b.return_date.localeCompare(a.return_date) || b.borrowing_id - a.borrowing_id;
    }
  });
}

function rankCounts(values: string[], limit: number = 3): RankedFacetCount[] {
  const counts = new Map<string, number>();
  for (const val of values) {
    if (!val) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function computeReadingHistorySummary(
  records: ReadingHistoryRecord[],
  referenceDate: Date = new Date()
): ReadingHistorySummary {
  if (records.length === 0) {
    return {
      total_books: 0,
      this_month: 0,
      favourite_category: null,
      ratings_given: 0,
    };
  }

  const currentMonthPrefix = `${referenceDate.getFullYear()}-${String(
    referenceDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const thisMonth = records.filter(
    (r) => r.return_date.startsWith(currentMonthPrefix) || r.issue_date.startsWith(currentMonthPrefix)
  ).length;

  const topCategories = rankCounts(
    records.map((r) => r.category),
    1
  );

  const ratingsGiven = records.filter((r) => r.student_rating !== null).length;

  return {
    total_books: records.length,
    this_month: thisMonth,
    favourite_category: topCategories[0]?.name ?? null,
    ratings_given: ratingsGiven,
  };
}

export function computeReadingInsights(records: ReadingHistoryRecord[]): ReadingInsightsData {
  if (records.length < 2) {
    return {
      has_sufficient_data: false,
      favourite_subjects: [],
      favourite_categories: [],
      favourite_authors: [],
      average_loan_duration_days: null,
      most_active_period: null,
      total_completed: records.length,
    };
  }

  const totalDuration = records.reduce((sum, r) => sum + r.loan_duration_days, 0);
  const averageLoanDuration = Math.round((totalDuration / records.length) * 10) / 10;

  const monthCounts = new Map<string, number>();
  for (const r of records) {
    const key = r.return_date.slice(0, 7); // YYYY-MM
    if (key.length === 7) {
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }
  }

  let mostActive: { label: string; count: number } | null = null;
  for (const [ym, count] of monthCounts.entries()) {
    const [yearStr, monthStr] = ym.split('-');
    const monthIndex = Number.parseInt(monthStr, 10) - 1;
    const monthLabel = MONTH_SHORT[monthIndex] ? `${MONTH_SHORT[monthIndex]} ${yearStr}` : ym;
    if (!mostActive || count > mostActive.count) {
      mostActive = { label: monthLabel, count };
    }
  }

  return {
    has_sufficient_data: true,
    favourite_subjects: rankCounts(records.map((r) => r.subject), 3),
    favourite_categories: rankCounts(records.map((r) => r.category), 3),
    favourite_authors: rankCounts(records.map((r) => r.author), 3),
    average_loan_duration_days: averageLoanDuration,
    most_active_period: mostActive,
    total_completed: records.length,
  };
}

export function buildMonthlyActivitySeries(
  records: ReadingHistoryRecord[],
  monthsCount: number = 6,
  referenceDate: Date = new Date()
): ReadingActivityChartPoint[] {
  if (records.length === 0) {
    return [];
  }

  const points: ReadingActivityChartPoint[] = [];
  for (let offset = monthsCount - 1; offset >= 0; offset -= 1) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_SHORT[d.getMonth()]}`;
    const count = records.filter((r) => r.return_date.startsWith(key)).length;
    points.push({ key, month: label, count });
  }
  return points;
}

export function buildChartAccessibleSummary(points: ReadingActivityChartPoint[]): string {
  if (points.length === 0) {
    return 'No monthly reading activity recorded yet.';
  }
  const parts = points.map((p) => `${p.month}: ${p.count} ${p.count === 1 ? 'book' : 'books'}`);
  return `Books borrowed and returned over the last ${points.length} months — ${parts.join(', ')}.`;
}

export function extractReadingHistoryFacets(records: ReadingHistoryRecord[]) {
  const uniqueSorted = (vals: string[]) =>
    Array.from(new Set(vals.filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return {
    categories: uniqueSorted(records.map((r) => r.category)),
    subjects: uniqueSorted(records.map((r) => r.subject)),
    authors: uniqueSorted(records.map((r) => r.author)),
    statuses: uniqueSorted(records.map((r) => r.status)),
  };
}

export function querySampleReadingHistory(
  allRecords: ReadingHistoryRecord[],
  filters: ReadingHistoryFilterState,
  referenceDate: Date = new Date()
): ReadingHistoryPayload {
  const sortedFiltered = filterAndSortReadingHistory(allRecords, filters, referenceDate);
  const limit = Math.max(1, filters.limit);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / limit));
  const safePage = Math.min(Math.max(1, filters.page), totalPages);
  const startIndex = (safePage - 1) * limit;
  const pageItems = sortedFiltered.slice(startIndex, startIndex + limit);

  return {
    is_prototype_sample: true,
    items: pageItems,
    total_count: allRecords.length,
    filtered_count: sortedFiltered.length,
    page: safePage,
    limit,
    total_pages: totalPages,
    summary: computeReadingHistorySummary(allRecords, referenceDate),
    insights: computeReadingInsights(allRecords),
    monthly_activity: buildMonthlyActivitySeries(allRecords, 6, referenceDate),
    facets: extractReadingHistoryFacets(allRecords),
  };
}

export function applySubmittedReviewToHistory(
  records: ReadingHistoryRecord[],
  bookId: number,
  rating: number,
  reviewText: string,
  submittedAtIso: string,
  ratingId: number
): ReadingHistoryRecord[] {
  return records.map((record) =>
    record.book_id === bookId
      ? {
          ...record,
          student_rating: rating,
          student_review: reviewText.trim() || null,
          rating_id: ratingId,
          rating_updated_at: submittedAtIso,
          review_status: 'Rated',
        }
      : record
  );
}

export function createReviewNotification(
  existingNotifications: StudentNotification[],
  studentId: number,
  bookTitle: string,
  createdAtIso: string
): StudentNotification[] {
  const expectedMessage = `Feedback submitted: Your rating and review for "${bookTitle}" have been saved.`;
  const alreadyExists = existingNotifications.some((n) => n.message === expectedMessage);
  if (alreadyExists) {
    return existingNotifications;
  }

  const nextNotification: StudentNotification = {
    notification_id: Date.now(),
    student_id: studentId,
    type: 'rating_prompt',
    message: expectedMessage,
    created_at: createdAtIso,
    relative_time: 'Just now',
    is_read: false,
  };

  return [nextNotification, ...existingNotifications];
}

function getCatalogBookOrFallback(bookId: number): CatalogBook {
  return SAMPLE_LIBRARY_CATALOG.find((b) => b.book_id === bookId) ?? SAMPLE_LIBRARY_CATALOG[0];
}

function buildSampleHistoryRecord(config: {
  borrowingId: number;
  bookId: number;
  copyNumber: number;
  issueDate: string;
  dueDate: string;
  returnDate: string;
  status: ReadingHistoryStatus;
  studentRating: number | null;
  studentReview: string | null;
  ratingId: number | null;
  ratingUpdatedAt: string | null;
}): ReadingHistoryRecord {
  const book = getCatalogBookOrFallback(config.bookId);
  const canBorrowAgain = book.available_copies > 0;
  const availabilityLabel = canBorrowAgain
    ? book.format === 'E-Book'
      ? 'Available (E-Book)'
      : `${book.available_copies} ${book.available_copies === 1 ? 'copy' : 'copies'} available`
    : book.total_copies > 0
      ? 'Currently Issued (Reservable)'
      : 'Unavailable';

  return {
    borrowing_id: config.borrowingId,
    book_id: book.book_id,
    copy_id: book.book_id * 100 + config.copyNumber,
    copy_barcode: `LIB-${book.book_id}-${String(config.copyNumber).padStart(2, '0')}`,
    slug: book.slug,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    category: book.category,
    subject: book.subject,
    cover_image: book.cover_image,
    issue_date: config.issueDate,
    due_date: config.dueDate,
    return_date: config.returnDate,
    loan_duration_days: calculateLoanDurationDays(config.issueDate, config.returnDate),
    status: config.status,
    available_copies: book.available_copies,
    total_copies: book.total_copies,
    availability_label: availabilityLabel,
    can_borrow_again: canBorrowAgain,
    can_review: true,
    student_rating: config.studentRating,
    student_review: config.studentReview,
    rating_id: config.ratingId,
    rating_updated_at: config.ratingUpdatedAt,
    review_status: config.studentRating !== null ? 'Rated' : 'Not Rated',
  };
}

export function createSampleReadingHistoryRecords(): ReadingHistoryRecord[] {
  return [
    buildSampleHistoryRecord({
      borrowingId: 710,
      bookId: 101,
      copyNumber: 1,
      issueDate: '2026-10-28',
      dueDate: '2026-11-11',
      returnDate: '2026-11-09',
      status: 'Completed',
      studentRating: 5,
      studentReview: 'Excellent walkthrough of idiomatic Python patterns and Pandas workflows.',
      ratingId: 401,
      ratingUpdatedAt: '2026-11-09',
    }),
    buildSampleHistoryRecord({
      borrowingId: 709,
      bookId: 105,
      copyNumber: 2,
      issueDate: '2026-10-18',
      dueDate: '2026-11-01',
      returnDate: '2026-11-02',
      status: 'Returned',
      studentRating: null,
      studentReview: null,
      ratingId: null,
      ratingUpdatedAt: null,
    }),
    buildSampleHistoryRecord({
      borrowingId: 708,
      bookId: 106,
      copyNumber: 1,
      issueDate: '2026-10-04',
      dueDate: '2026-10-18',
      returnDate: '2026-10-16',
      status: 'Completed',
      studentRating: 5,
      studentReview: 'Essential reference for dynamic programming and graph algorithms.',
      ratingId: 402,
      ratingUpdatedAt: '2026-10-16',
    }),
    buildSampleHistoryRecord({
      borrowingId: 707,
      bookId: 126,
      copyNumber: 1,
      issueDate: '2026-09-24',
      dueDate: '2026-10-08',
      returnDate: '2026-10-05',
      status: 'Completed',
      studentRating: 4,
      studentReview: 'Strong coverage of transformer architectures and tokenization.',
      ratingId: 403,
      ratingUpdatedAt: '2026-10-06',
    }),
    buildSampleHistoryRecord({
      borrowingId: 706,
      bookId: 109,
      copyNumber: 1,
      issueDate: '2026-09-08',
      dueDate: '2026-09-22',
      returnDate: '2026-09-20',
      status: 'Returned',
      studentRating: 5,
      studentReview: 'Very clear explanation of backpropagation and CNN regularization.',
      ratingId: 404,
      ratingUpdatedAt: '2026-09-21',
    }),
    buildSampleHistoryRecord({
      borrowingId: 705,
      bookId: 115,
      copyNumber: 2,
      issueDate: '2026-08-22',
      dueDate: '2026-09-05',
      returnDate: '2026-09-03',
      status: 'Completed',
      studentRating: 4,
      studentReview: null,
      ratingId: 405,
      ratingUpdatedAt: '2026-09-04',
    }),
    buildSampleHistoryRecord({
      borrowingId: 704,
      bookId: 107,
      copyNumber: 1,
      issueDate: '2026-08-04',
      dueDate: '2026-08-18',
      returnDate: '2026-08-17',
      status: 'Returned',
      studentRating: null,
      studentReview: null,
      ratingId: null,
      ratingUpdatedAt: null,
    }),
    buildSampleHistoryRecord({
      borrowingId: 703,
      bookId: 127,
      copyNumber: 1,
      issueDate: '2026-07-15',
      dueDate: '2026-07-29',
      returnDate: '2026-07-27',
      status: 'Completed',
      studentRating: 5,
      studentReview: 'Great depth on replication, partitioning, and consensus guarantees.',
      ratingId: 406,
      ratingUpdatedAt: '2026-07-28',
    }),
    buildSampleHistoryRecord({
      borrowingId: 702,
      bookId: 111,
      copyNumber: 1,
      issueDate: '2026-07-02',
      dueDate: '2026-07-16',
      returnDate: '2026-07-10',
      status: 'Returned',
      studentRating: null,
      studentReview: null,
      ratingId: null,
      ratingUpdatedAt: null,
    }),
    buildSampleHistoryRecord({
      borrowingId: 701,
      bookId: 114,
      copyNumber: 1,
      issueDate: '2026-06-11',
      dueDate: '2026-06-25',
      returnDate: '2026-06-24',
      status: 'Completed',
      studentRating: 4,
      studentReview: 'Practical cryptography labs and TLS case studies.',
      ratingId: 407,
      ratingUpdatedAt: '2026-06-25',
    }),
  ];
}

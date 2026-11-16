import { DEMO_BOOKS } from '../data/libraryData';
import {
  createSampleCirculationStore,
  type ActiveBorrowingDetail,
  type CirculationStudentRecord,
} from './librarianCirculation';
import {
  createSampleInventoryStore,
  type InventoryBookItem,
  type InventoryPhysicalCopy,
} from './librarianInventory';
import {
  classifyOverdueDurationBucket,
  createSampleOverdueStore,
  filterValidOverdueRecords,
  type OverdueRecordItem,
} from './librarianOverdue';
import {
  createSampleReservationsStore,
  type LibrarianReservationItem,
} from './librarianReservations';
import { createSampleStudentRecordsStore } from './librarianStudents';

export type ReportDatePreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_3_months'
  | 'this_year'
  | 'custom';

export type ReportTabId =
  | 'borrowing'
  | 'returns'
  | 'overdue'
  | 'inventory'
  | 'reservations'
  | 'student_activity';

export type TrendGrouping = 'daily' | 'weekly' | 'monthly';

export interface ReportsFilterState {
  datePreset: ReportDatePreset;
  dateFrom: string;
  dateTo: string;
  grouping: TrendGrouping;
  branch: string;
  category: string;
  subject: string;
  department: string;
  borrowingStatus: 'All' | 'Issued' | 'Returned' | 'Overdue' | 'Renewal Pending';
  reservationStatus: 'All' | 'Waiting' | 'Ready for Pickup' | 'Completed' | 'Cancelled' | 'Expired';
}

export interface ReportsKpiSummary {
  totalBookTitles: number;
  totalPhysicalCopies: number;
  availableCopies: number;
  booksIssuedInRange: number;
  booksReturnedInRange: number;
  currentlyOverdueBooks: number;
  activeReservations: number;
  previousPeriodDeltas: {
    booksIssued?: number | null;
    booksReturned?: number | null;
    currentlyOverdue?: number | null;
    activeReservations?: number | null;
  } | null;
}

export interface CirculationTrendPoint {
  periodKey: string;
  label: string;
  issued: number;
  returned: number;
}

export interface MostBorrowedBookItem {
  book_id: number;
  slug: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  subject: string;
  branch: string;
  cover_image: string;
  total_borrows: number;
  currently_issued: number;
  available_copies: number;
  total_copies: number;
  avg_rating: number | null;
}

export interface CategoryBreakdownItem {
  name: string;
  borrow_count: number;
  share_percent: number;
}

export interface InventoryStatusBreakdown {
  available: number;
  issued: number;
  reserved: number;
  lost_damaged_repair: number;
  total_copies: number;
}

export interface OverdueDurationDistributionItem {
  bucket: string;
  count: number;
}

export interface OverdueTrendPoint {
  label: string;
  overdue_count: number;
  resolved_count: number;
}

export interface ReservationStatusBreakdown {
  waiting: number;
  ready_for_pickup: number;
  completed: number;
  cancelled: number;
  expired: number;
  total: number;
}

export interface ReservationTrendPoint {
  label: string;
  requests: number;
  fulfilled: number;
}

export interface DepartmentActivitySummaryItem {
  department: string;
  distinct_students: number;
  total_borrows: number;
  active_loans: number;
  overdue_loans: number;
  reservations: number;
}

export interface BorrowingReportRow {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_title: string;
  student_code: string;
  student_name: string;
  department: string;
  accession_number: string;
  branch: string;
  category: string;
  subject: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: 'Issued' | 'Returned' | 'Overdue' | 'Renewal Pending';
}

export interface ReturnsReportRow {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_title: string;
  student_code: string;
  student_name: string;
  department: string;
  accession_number: string;
  branch: string;
  category: string;
  issue_date: string;
  due_date: string;
  return_date: string;
  days_late: number;
  condition: string;
}

export interface OverdueReportRow {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_title: string;
  student_code: string;
  student_name: string;
  department: string;
  accession_number: string;
  branch: string;
  category: string;
  issue_date: string;
  due_date: string;
  days_overdue: number;
  duration_bucket: string;
  fine_label: string;
}

export interface InventoryReportRow {
  book_id: number;
  slug: string;
  title: string;
  authors: string;
  isbn: string;
  category: string;
  subject: string;
  branch: string;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  unavailable_copies: number;
  availability_status: string;
  borrow_count: number;
}

export interface ReservationsReportRow {
  reservation_id: number;
  reservation_code: string;
  book_id: number;
  book_title: string;
  student_code: string;
  student_name: string;
  department: string;
  branch: string;
  category: string;
  reservation_date: string;
  queue_position: number | null;
  status: string;
  pickup_deadline: string | null;
}

export interface StudentActivitySummaryRow {
  department: string;
  distinct_students: number;
  active_students: number;
  total_borrows: number;
  active_loans: number;
  completed_loans: number;
  overdue_loans: number;
  active_reservations: number;
}

export interface ReportsCapabilities {
  can_export_csv: boolean;
  can_export_pdf_backend: boolean;
  supports_comparison_delta: boolean;
  supports_overdue_trends: boolean;
}

export interface ReportsFacets {
  branches: string[];
  categories: string[];
  subjects: string[];
  departments: string[];
}

export interface ReportsSourceDataset {
  is_prototype_sample: boolean;
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  borrowings: Array<
    ActiveBorrowingDetail & {
      category: string;
      subject: string;
      branch: string;
    }
  >;
  overdueRecords: OverdueRecordItem[];
  reservations: LibrarianReservationItem[];
  students: CirculationStudentRecord[];
  previousPeriodDeltas: ReportsKpiSummary['previousPeriodDeltas'];
  capabilities: ReportsCapabilities;
}

export interface ComputedReportsView {
  generated_at: string;
  facets: ReportsFacets;
  summary: ReportsKpiSummary;
  charts: {
    hasCirculationData: boolean;
    circulationTrends: CirculationTrendPoint[];
    mostBorrowedBooks: MostBorrowedBookItem[];
    popularCategories: CategoryBreakdownItem[];
    popularSubjects: CategoryBreakdownItem[];
    inventoryStatus: InventoryStatusBreakdown;
    overdueBuckets: OverdueDurationDistributionItem[];
    overdueTrends: OverdueTrendPoint[];
    reservationBreakdown: ReservationStatusBreakdown;
    reservationTrends: ReservationTrendPoint[];
    departmentActivity: DepartmentActivitySummaryItem[];
  };
  tables: {
    borrowing: BorrowingReportRow[];
    returns: ReturnsReportRow[];
    overdue: OverdueReportRow[];
    inventory: InventoryReportRow[];
    reservations: ReservationsReportRow[];
    student_activity: StudentActivitySummaryRow[];
  };
}

export const DATE_PRESET_OPTIONS: Array<{ id: ReportDatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 Days' },
  { id: 'last_30_days', label: 'Last 30 Days' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Date Range' },
];

export const REPORT_TABS: Array<{ id: ReportTabId; label: string }> = [
  { id: 'borrowing', label: 'Borrowing Report' },
  { id: 'returns', label: 'Book Returns Report' },
  { id: 'overdue', label: 'Overdue Books Report' },
  { id: 'inventory', label: 'Inventory Report' },
  { id: 'reservations', label: 'Reservations Report' },
  { id: 'student_activity', label: 'Student Activity Summary' },
];

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta);
}

export function resolveDateRangeFromPreset(
  preset: ReportDatePreset,
  referenceDate: Date = new Date(),
  customFrom?: string,
  customTo?: string
): { dateFrom: string; dateTo: string } {
  const todayIso = toIsoDate(referenceDate);
  switch (preset) {
    case 'today':
      return { dateFrom: todayIso, dateTo: todayIso };
    case 'last_7_days':
      return { dateFrom: toIsoDate(addDays(referenceDate, -6)), dateTo: todayIso };
    case 'last_30_days':
      return { dateFrom: toIsoDate(addDays(referenceDate, -29)), dateTo: todayIso };
    case 'last_3_months':
      return {
        dateFrom: toIsoDate(
          new Date(
            referenceDate.getFullYear(),
            referenceDate.getMonth() - 3,
            referenceDate.getDate()
          )
        ),
        dateTo: todayIso,
      };
    case 'this_year':
      return {
        dateFrom: `${referenceDate.getFullYear()}-01-01`,
        dateTo: todayIso,
      };
    case 'custom':
      return {
        dateFrom: customFrom || toIsoDate(addDays(referenceDate, -29)),
        dateTo: customTo || todayIso,
      };
  }
}

export function validateReportDateRange(
  dateFrom: string,
  dateTo: string
): { isValid: boolean; error: string | null } {
  if (!dateFrom || !dateTo) {
    return { isValid: false, error: 'Select both From and To dates.' };
  }
  const fromMs = Date.parse(dateFrom);
  const toMs = Date.parse(dateTo);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return { isValid: false, error: 'Enter valid report dates (YYYY-MM-DD).' };
  }
  if (fromMs > toMs) {
    return {
      isValid: false,
      error: 'Start date cannot be later than End date.',
    };
  }
  return { isValid: true, error: null };
}

export function createDefaultReportsFilterState(
  referenceDate: Date = new Date()
): ReportsFilterState {
  const { dateFrom, dateTo } = resolveDateRangeFromPreset('last_30_days', referenceDate);
  return {
    datePreset: 'last_30_days',
    dateFrom,
    dateTo,
    grouping: 'weekly',
    branch: 'All',
    category: 'All',
    subject: 'All',
    department: 'All',
    borrowingStatus: 'All',
    reservationStatus: 'All',
  };
}

export function buildReportsApiQueryParams(filters: ReportsFilterState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('preset', filters.datePreset);
  params.set('from', filters.dateFrom);
  params.set('to', filters.dateTo);
  params.set('grouping', filters.grouping);
  if (filters.branch && filters.branch !== 'All') params.set('branch', filters.branch);
  if (filters.category && filters.category !== 'All') params.set('category', filters.category);
  if (filters.subject && filters.subject !== 'All') params.set('subject', filters.subject);
  if (filters.department && filters.department !== 'All') {
    params.set('department', filters.department);
  }
  if (filters.borrowingStatus && filters.borrowingStatus !== 'All') {
    params.set('borrowing_status', filters.borrowingStatus);
  }
  if (filters.reservationStatus && filters.reservationStatus !== 'All') {
    params.set('reservation_status', filters.reservationStatus);
  }
  return params;
}

function isIsoWithinRange(iso: string | null | undefined, dateFrom: string, dateTo: string): boolean {
  if (!iso) return false;
  const datePart = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return true;
  if (dateFrom && datePart < dateFrom) return false;
  if (dateTo && datePart > dateTo) return false;
  return true;
}

function parseIsoDay(iso: string): Date | null {
  const datePart = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPeriodKeyAndLabel(
  iso: string,
  grouping: TrendGrouping
): { key: string; label: string } {
  const parsed = parseIsoDay(iso);
  if (!parsed) return { key: iso, label: iso };
  if (grouping === 'daily') {
    const key = toIsoDate(parsed);
    const label = `${parsed.getDate()} ${MONTH_SHORT[parsed.getMonth()]}`;
    return { key, label };
  }
  if (grouping === 'weekly') {
    const day = parsed.getDay();
    const weekStart = addDays(parsed, day === 0 ? -6 : 1 - day);
    const key = toIsoDate(weekStart);
    const label = `Wk ${weekStart.getDate()} ${MONTH_SHORT[weekStart.getMonth()]}`;
    return { key, label };
  }
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  return {
    key: `${yyyy}-${mm}`,
    label: `${MONTH_SHORT[parsed.getMonth()]} ${yyyy}`,
  };
}

export function createSampleReportsSourceDataset(
  referenceDate: Date = new Date()
): ReportsSourceDataset {
  const inventoryStore = createSampleInventoryStore();
  const circulationStore = createSampleCirculationStore(referenceDate);
  const overdueStore = createSampleOverdueStore(referenceDate);
  const reservationsStore = createSampleReservationsStore(referenceDate);
  const studentStore = createSampleStudentRecordsStore(referenceDate);

  const bookLookup = new Map<number, InventoryBookItem>();
  for (const b of inventoryStore.books) {
    bookLookup.set(b.book_id, b);
  }

  const enrichedBorrowings: ReportsSourceDataset['borrowings'] = circulationStore.borrowings.map(
    (b) => {
      const book = bookLookup.get(b.book_id) ?? inventoryStore.books[0];
      return {
        ...b,
        category: book?.category ?? 'General',
        subject: book?.subject ?? 'General',
        branch: book?.branch ?? 'Main Central Library',
      };
    }
  );

  const existingTxnIds = new Set(enrichedBorrowings.map((b) => b.borrowing_id));

  // Merge overdue active records that aren't already in base borrowings
  for (const ov of overdueStore.records) {
    if (existingTxnIds.has(ov.borrowing_id)) continue;
    existingTxnIds.add(ov.borrowing_id);
    const book = bookLookup.get(ov.book_id) ?? inventoryStore.books[0];
    enrichedBorrowings.push({
      borrowing_id: ov.borrowing_id,
      transaction_code: ov.transaction_code,
      student_id: ov.student_id,
      student_name: ov.student_name,
      student_code: ov.student_code,
      student_email: ov.student_email,
      student_department: ov.student_department,
      student_account_status: ov.student_account_status,
      book_id: ov.book_id,
      book_title: ov.book_title,
      book_author: ov.book_author,
      book_isbn: ov.book_isbn,
      book_cover: ov.book_cover,
      copy_id: ov.copy_id,
      accession_number: ov.accession_number,
      barcode: null,
      shelf_location: ov.shelf_location,
      copy_condition: ov.copy_condition,
      copy_status: 'Issued',
      issue_date: ov.issue_date,
      due_date: ov.due_date,
      return_date: null,
      status: 'Overdue',
      category: ov.book_category,
      subject: book?.subject ?? ov.book_category,
      branch: ov.branch,
    });
  }

  // Merge historical returned loans from student records store so trend charts reflect real completed history
  for (const student of studentStore.students) {
    const profile = studentStore.profilesById[student.student_id];
    if (!profile) continue;
    for (const hist of profile.borrowing_history) {
      if (existingTxnIds.has(hist.borrowing_id)) continue;
      existingTxnIds.add(hist.borrowing_id);
      const book = bookLookup.get(hist.book_id) ?? inventoryStore.books[0];
      const returnMs = Date.parse(hist.return_date);
      const issueMs = Date.parse(hist.issue_date);
      const dueIso =
        !Number.isNaN(issueMs) && !Number.isNaN(returnMs)
          ? toIsoDate(addDays(new Date(issueMs), 14))
          : hist.return_date;
      enrichedBorrowings.push({
        borrowing_id: hist.borrowing_id,
        transaction_code: hist.transaction_code,
        student_id: student.student_id,
        student_name: student.full_name,
        student_code: student.student_code,
        student_email: student.email,
        student_department: student.department,
        student_account_status: student.account_status,
        book_id: hist.book_id,
        book_title: hist.book_title,
        book_author: hist.book_author,
        book_isbn: book?.isbn ?? '—',
        book_cover: book?.cover_image ?? DEMO_BOOKS[0].coverImage,
        copy_id: hist.borrowing_id,
        accession_number: `LIB-2026-H${String(hist.borrowing_id).slice(-3)}`,
        barcode: null,
        shelf_location: `${book?.branch ?? 'Main Central Library'} · ${book?.shelf ?? 'Shelf A'}`,
        copy_condition: 'Good',
        copy_status: 'Available',
        issue_date: hist.issue_date,
        due_date: dueIso,
        return_date: hist.return_date,
        status: 'Returned',
        category: book?.category ?? hist.category,
        subject: book?.subject ?? hist.category,
        branch: book?.branch ?? 'Main Central Library',
      });
    }
  }

  return {
    is_prototype_sample: true,
    books: inventoryStore.books,
    copies: circulationStore.copies,
    borrowings: enrichedBorrowings.sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    overdueRecords: filterValidOverdueRecords(overdueStore.records),
    reservations: reservationsStore.items,
    students: studentStore.students,
    previousPeriodDeltas: null,
    capabilities: {
      can_export_csv: true,
      can_export_pdf_backend: false,
      supports_comparison_delta: false,
      supports_overdue_trends: true,
    },
  };
}

export function computeReportsAnalyticsView(
  dataset: ReportsSourceDataset,
  filters: ReportsFilterState,
  referenceDate: Date = new Date()
): ComputedReportsView {
  const facets: ReportsFacets = {
    branches: Array.from(new Set(dataset.books.map((b) => b.branch).filter(Boolean))).sort(),
    categories: Array.from(new Set(dataset.books.map((b) => b.category).filter(Boolean))).sort(),
    subjects: Array.from(new Set(dataset.books.map((b) => b.subject).filter(Boolean))).sort(),
    departments: Array.from(
      new Set(dataset.students.map((s) => s.department).filter(Boolean))
    ).sort(),
  };

  // Filtered Books (Inventory scope: branch/category/subject)
  const matchingBooks = dataset.books.filter((book) => {
    if (filters.branch !== 'All' && book.branch !== filters.branch) return false;
    if (filters.category !== 'All' && book.category !== filters.category) return false;
    if (filters.subject !== 'All' && book.subject !== filters.subject) return false;
    return true;
  });
  const matchingBookIds = new Set(matchingBooks.map((b) => b.book_id));

  // Physical copies matching book/branch filter
  const matchingCopies = dataset.copies.filter((copy) => {
    if (filters.branch !== 'All' && copy.branch !== filters.branch) return false;
    return matchingBookIds.has(copy.book_id);
  });

  // Inventory copy status breakdown
  let availCopiesCount = 0;
  let issuedCopiesCount = 0;
  let reservedCopiesCount = 0;
  let unavailableCopiesCount = 0;
  for (const copy of matchingCopies) {
    if (copy.status === 'Available') availCopiesCount += 1;
    else if (copy.status === 'Issued') issuedCopiesCount += 1;
    else if (copy.status === 'Reserved') reservedCopiesCount += 1;
    else unavailableCopiesCount += 1;
  }

  // Borrowings filtered by facets (before date filter for active overdue snapshot vs date-range for trends)
  const facetFilteredBorrowings = dataset.borrowings.filter((b) => {
    if (filters.branch !== 'All' && b.branch !== filters.branch) return false;
    if (filters.category !== 'All' && b.category !== filters.category) return false;
    if (filters.subject !== 'All' && b.subject !== filters.subject) return false;
    if (filters.department !== 'All' && b.student_department !== filters.department) return false;
    if (filters.borrowingStatus !== 'All' && b.status !== filters.borrowingStatus) return false;
    return true;
  });

  const dateFilteredBorrowings = facetFilteredBorrowings.filter(
    (b) =>
      isIsoWithinRange(b.issue_date, filters.dateFrom, filters.dateTo) ||
      (b.return_date !== null && isIsoWithinRange(b.return_date, filters.dateFrom, filters.dateTo))
  );

  const issuedInRange = facetFilteredBorrowings.filter((b) =>
    isIsoWithinRange(b.issue_date, filters.dateFrom, filters.dateTo)
  );
  const returnedInRange = facetFilteredBorrowings.filter(
    (b) =>
      b.status === 'Returned' &&
      b.return_date !== null &&
      isIsoWithinRange(b.return_date, filters.dateFrom, filters.dateTo)
  );

  // Overdue records matching facets
  const bookSubjectMap = new Map(dataset.books.map((b) => [b.book_id, b.subject]));
  const filteredOverdue = dataset.overdueRecords.filter((ov) => {
    if (filters.branch !== 'All' && ov.branch !== filters.branch) return false;
    if (filters.category !== 'All' && ov.book_category !== filters.category) return false;
    const subj = bookSubjectMap.get(ov.book_id) ?? '';
    if (filters.subject !== 'All' && subj !== filters.subject) return false;
    if (filters.department !== 'All' && ov.student_department !== filters.department) return false;
    return true;
  });

  // Reservations matching facets + reservation status + date range
  const filteredReservations = dataset.reservations.filter((res) => {
    if (filters.branch !== 'All' && res.branch !== filters.branch) return false;
    if (filters.category !== 'All' && res.category !== filters.category) return false;
    if (filters.subject !== 'All' && res.subject !== filters.subject) return false;
    if (filters.department !== 'All' && res.student_department !== filters.department) {
      return false;
    }
    if (filters.reservationStatus !== 'All' && res.status !== filters.reservationStatus) {
      return false;
    }
    return isIsoWithinRange(res.reservation_date, filters.dateFrom, filters.dateTo);
  });

  const activeReservationsCount = dataset.reservations.filter((res) => {
    if (filters.branch !== 'All' && res.branch !== filters.branch) return false;
    if (filters.category !== 'All' && res.category !== filters.category) return false;
    if (filters.subject !== 'All' && res.subject !== filters.subject) return false;
    if (filters.department !== 'All' && res.student_department !== filters.department) {
      return false;
    }
    return res.status === 'Waiting' || res.status === 'Ready for Pickup';
  }).length;

  // Circulation Trend Map
  const trendMap = new Map<string, CirculationTrendPoint>();
  for (const b of issuedInRange) {
    const { key, label } = getPeriodKeyAndLabel(b.issue_date, filters.grouping);
    const existing = trendMap.get(key) ?? { periodKey: key, label, issued: 0, returned: 0 };
    existing.issued += 1;
    trendMap.set(key, existing);
  }
  for (const b of returnedInRange) {
    if (!b.return_date) continue;
    const { key, label } = getPeriodKeyAndLabel(b.return_date, filters.grouping);
    const existing = trendMap.get(key) ?? { periodKey: key, label, issued: 0, returned: 0 };
    existing.returned += 1;
    trendMap.set(key, existing);
  }
  const circulationTrends = Array.from(trendMap.values()).sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey)
  );

  // Most Borrowed Books in filtered scope (combining date-range circulation or catalog total when date has sparse rows)
  const bookRangeCounts = new Map<number, { borrows: number; active: number }>();
  for (const b of issuedInRange) {
    const entry = bookRangeCounts.get(b.book_id) ?? { borrows: 0, active: 0 };
    entry.borrows += 1;
    if (b.status !== 'Returned') entry.active += 1;
    bookRangeCounts.set(b.book_id, entry);
  }

  const mostBorrowedBooks: MostBorrowedBookItem[] = matchingBooks
    .map((book) => {
      const rangeStat = bookRangeCounts.get(book.book_id);
      return {
        book_id: book.book_id,
        slug: book.slug,
        title: book.title,
        author: book.authors,
        isbn: book.isbn,
        category: book.category,
        subject: book.subject,
        branch: book.branch,
        cover_image: book.cover_image,
        total_borrows: rangeStat?.borrows ?? 0,
        currently_issued: book.issued_copies,
        available_copies: book.available_copies,
        total_copies: book.total_copies,
        avg_rating: book.rating_average,
      };
    })
    .filter((item) => item.total_borrows > 0)
    .sort((a, b) => b.total_borrows - a.total_borrows || a.title.localeCompare(b.title))
    .slice(0, 8);

  // Popular Categories & Subjects from issuedInRange
  const catCountMap = new Map<string, number>();
  const subjCountMap = new Map<string, number>();
  for (const b of issuedInRange) {
    catCountMap.set(b.category, (catCountMap.get(b.category) ?? 0) + 1);
    subjCountMap.set(b.subject, (subjCountMap.get(b.subject) ?? 0) + 1);
  }
  const totalCategoryBorrows = Math.max(
    1,
    Array.from(catCountMap.values()).reduce((s, v) => s + v, 0)
  );
  const popularCategories: CategoryBreakdownItem[] = Array.from(catCountMap.entries())
    .map(([name, borrow_count]) => ({
      name,
      borrow_count,
      share_percent: Math.round((borrow_count / totalCategoryBorrows) * 100),
    }))
    .sort((a, b) => b.borrow_count - a.borrow_count);

  const popularSubjects: CategoryBreakdownItem[] = Array.from(subjCountMap.entries())
    .map(([name, borrow_count]) => ({
      name,
      borrow_count,
      share_percent: Math.round((borrow_count / totalCategoryBorrows) * 100),
    }))
    .sort((a, b) => b.borrow_count - a.borrow_count);

  // Overdue Duration Distribution & Overdue Trend
  const bucketMap = new Map<string, number>([
    ['1–7 Days', 0],
    ['8–30 Days', 0],
    ['30+ Days', 0],
  ]);
  const overdueTrendMap = new Map<string, OverdueTrendPoint & { sortKey: string }>();
  for (const ov of filteredOverdue) {
    const bucket = classifyOverdueDurationBucket(ov.days_overdue);
    const label = bucket?.shortLabel ?? '1–7 Days';
    bucketMap.set(label, (bucketMap.get(label) ?? 0) + 1);

    const { key, label: pLabel } = getPeriodKeyAndLabel(ov.due_date, filters.grouping);
    const pt = overdueTrendMap.get(key) ?? {
      sortKey: key,
      label: pLabel,
      overdue_count: 0,
      resolved_count: 0,
    };
    pt.overdue_count += 1;
    overdueTrendMap.set(key, pt);
  }
  // Include late returns within range as resolved overdue points
  for (const b of returnedInRange) {
    if (!b.return_date) continue;
    const dueMs = Date.parse(b.due_date);
    const retMs = Date.parse(b.return_date);
    if (!Number.isNaN(dueMs) && !Number.isNaN(retMs) && retMs > dueMs) {
      const { key, label: pLabel } = getPeriodKeyAndLabel(b.return_date, filters.grouping);
      const pt = overdueTrendMap.get(key) ?? {
        sortKey: key,
        label: pLabel,
        overdue_count: 0,
        resolved_count: 0,
      };
      pt.resolved_count += 1;
      overdueTrendMap.set(key, pt);
    }
  }

  const overdueBuckets: OverdueDurationDistributionItem[] = Array.from(bucketMap.entries()).map(
    ([bucket, count]) => ({ bucket, count })
  );
  const overdueTrends = Array.from(overdueTrendMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ label, overdue_count, resolved_count }) => ({
      label,
      overdue_count,
      resolved_count,
    }));

  // Reservations Breakdown & Trend
  const reservationBreakdown: ReservationStatusBreakdown = {
    waiting: 0,
    ready_for_pickup: 0,
    completed: 0,
    cancelled: 0,
    expired: 0,
    total: filteredReservations.length,
  };
  const resTrendMap = new Map<string, ReservationTrendPoint & { sortKey: string }>();
  for (const r of filteredReservations) {
    if (r.status === 'Waiting') reservationBreakdown.waiting += 1;
    else if (r.status === 'Ready for Pickup') reservationBreakdown.ready_for_pickup += 1;
    else if (r.status === 'Completed') reservationBreakdown.completed += 1;
    else if (r.status === 'Cancelled') reservationBreakdown.cancelled += 1;
    else if (r.status === 'Expired') reservationBreakdown.expired += 1;

    const { key, label } = getPeriodKeyAndLabel(r.reservation_date, filters.grouping);
    const pt = resTrendMap.get(key) ?? {
      sortKey: key,
      label,
      requests: 0,
      fulfilled: 0,
    };
    pt.requests += 1;
    if (r.status === 'Completed') pt.fulfilled += 1;
    resTrendMap.set(key, pt);
  }
  const reservationTrends = Array.from(resTrendMap.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ label, requests, fulfilled }) => ({ label, requests, fulfilled }));

  // Department / Student Aggregate Activity (Privacy-safe aggregate rows)
  const deptStudentMap = new Map<
    string,
    {
      students: Set<number>;
      activeStudents: number;
      totalBorrows: number;
      activeLoans: number;
      completedLoans: number;
      overdueLoans: number;
      activeReservations: number;
    }
  >();

  for (const student of dataset.students) {
    if (filters.department !== 'All' && student.department !== filters.department) continue;
    const entry = deptStudentMap.get(student.department) ?? {
      students: new Set<number>(),
      activeStudents: 0,
      totalBorrows: 0,
      activeLoans: 0,
      completedLoans: 0,
      overdueLoans: 0,
      activeReservations: 0,
    };
    entry.students.add(student.student_id);
    if (student.account_status === 'Active') entry.activeStudents += 1;
    deptStudentMap.set(student.department, entry);
  }

  for (const b of issuedInRange) {
    const entry = deptStudentMap.get(b.student_department) ?? {
      students: new Set<number>(),
      activeStudents: 0,
      totalBorrows: 0,
      activeLoans: 0,
      completedLoans: 0,
      overdueLoans: 0,
      activeReservations: 0,
    };
    entry.students.add(b.student_id);
    entry.totalBorrows += 1;
    if (b.status === 'Returned') entry.completedLoans += 1;
    else entry.activeLoans += 1;
    if (b.status === 'Overdue') entry.overdueLoans += 1;
    deptStudentMap.set(b.student_department, entry);
  }

  for (const r of filteredReservations) {
    const entry = deptStudentMap.get(r.student_department);
    if (entry && (r.status === 'Waiting' || r.status === 'Ready for Pickup')) {
      entry.activeReservations += 1;
    }
  }

  const departmentActivity: DepartmentActivitySummaryItem[] = Array.from(deptStudentMap.entries())
    .map(([department, d]) => ({
      department,
      distinct_students: d.students.size,
      total_borrows: d.totalBorrows,
      active_loans: d.activeLoans,
      overdue_loans: d.overdueLoans,
      reservations: d.activeReservations,
    }))
    .sort((a, b) => b.total_borrows - a.total_borrows || a.department.localeCompare(b.department));

  // Detailed Table Rows
  const borrowingRows: BorrowingReportRow[] = dateFilteredBorrowings.map((b) => ({
    borrowing_id: b.borrowing_id,
    transaction_code: b.transaction_code,
    book_id: b.book_id,
    book_title: b.book_title,
    student_code: b.student_code,
    student_name: b.student_name,
    department: b.student_department,
    accession_number: b.accession_number,
    branch: b.branch,
    category: b.category,
    subject: b.subject,
    issue_date: b.issue_date,
    due_date: b.due_date,
    return_date: b.return_date,
    status: b.status,
  }));

  const returnsRows: ReturnsReportRow[] = returnedInRange.map((b) => {
    const dueMs = Date.parse(b.due_date);
    const retMs = Date.parse(b.return_date ?? b.due_date);
    const daysLate =
      !Number.isNaN(dueMs) && !Number.isNaN(retMs) && retMs > dueMs
        ? Math.ceil((retMs - dueMs) / 86_400_000)
        : 0;
    return {
      borrowing_id: b.borrowing_id,
      transaction_code: b.transaction_code,
      book_id: b.book_id,
      book_title: b.book_title,
      student_code: b.student_code,
      student_name: b.student_name,
      department: b.student_department,
      accession_number: b.accession_number,
      branch: b.branch,
      category: b.category,
      issue_date: b.issue_date,
      due_date: b.due_date,
      return_date: b.return_date ?? b.due_date,
      days_late: daysLate,
      condition: b.copy_condition,
    };
  });

  const overdueRows: OverdueReportRow[] = filteredOverdue.map((ov) => {
    const bucket = classifyOverdueDurationBucket(ov.days_overdue);
    return {
      borrowing_id: ov.borrowing_id,
      transaction_code: ov.transaction_code,
      book_id: ov.book_id,
      book_title: ov.book_title,
      student_code: ov.student_code,
      student_name: ov.student_name,
      department: ov.student_department,
      accession_number: ov.accession_number,
      branch: ov.branch,
      category: ov.book_category,
      issue_date: ov.issue_date,
      due_date: ov.due_date,
      days_overdue: ov.days_overdue,
      duration_bucket: bucket?.label ?? '1–7 Days Overdue',
      fine_label:
        ov.fine_amount !== null
          ? `${ov.fine_currency_symbol}${ov.fine_amount}`
          : 'No Monetary Fine Policy',
    };
  });

  const inventoryRows: InventoryReportRow[] = matchingBooks.map((book) => ({
    book_id: book.book_id,
    slug: book.slug,
    title: book.title,
    authors: book.authors,
    isbn: book.isbn,
    category: book.category,
    subject: book.subject,
    branch: book.branch,
    total_copies: book.total_copies,
    available_copies: book.available_copies,
    issued_copies: book.issued_copies,
    reserved_copies: book.reserved_copies,
    unavailable_copies: book.unavailable_copies,
    availability_status: book.availability_status,
    borrow_count: bookRangeCounts.get(book.book_id)?.borrows ?? book.borrow_count,
  }));

  const reservationsRows: ReservationsReportRow[] = filteredReservations.map((r) => ({
    reservation_id: r.reservation_id,
    reservation_code: r.reservation_code,
    book_id: r.book_id,
    book_title: r.book_title,
    student_code: r.student_code,
    student_name: r.student_name,
    department: r.student_department,
    branch: r.branch,
    category: r.category,
    reservation_date: r.reservation_date,
    queue_position: r.queue_position,
    status: r.status,
    pickup_deadline: r.pickup_deadline,
  }));

  const studentActivityRows: StudentActivitySummaryRow[] = Array.from(deptStudentMap.entries())
    .map(([department, d]) => ({
      department,
      distinct_students: d.students.size,
      active_students: d.activeStudents,
      total_borrows: d.totalBorrows,
      active_loans: d.activeLoans,
      completed_loans: d.completedLoans,
      overdue_loans: d.overdueLoans,
      active_reservations: d.activeReservations,
    }))
    .sort((a, b) => b.total_borrows - a.total_borrows || a.department.localeCompare(b.department));

  return {
    generated_at: referenceDate.toISOString(),
    facets,
    summary: {
      totalBookTitles: matchingBooks.length,
      totalPhysicalCopies: matchingCopies.length,
      availableCopies: availCopiesCount,
      booksIssuedInRange: issuedInRange.length,
      booksReturnedInRange: returnedInRange.length,
      currentlyOverdueBooks: filteredOverdue.length,
      activeReservations: activeReservationsCount,
      previousPeriodDeltas: dataset.previousPeriodDeltas,
    },
    charts: {
      hasCirculationData: circulationTrends.length > 0,
      circulationTrends,
      mostBorrowedBooks,
      popularCategories,
      popularSubjects,
      inventoryStatus: {
        available: availCopiesCount,
        issued: issuedCopiesCount,
        reserved: reservedCopiesCount,
        lost_damaged_repair: unavailableCopiesCount,
        total_copies: matchingCopies.length,
      },
      overdueBuckets,
      overdueTrends,
      reservationBreakdown,
      reservationTrends,
      departmentActivity,
    },
    tables: {
      borrowing: borrowingRows,
      returns: returnsRows,
      overdue: overdueRows,
      inventory: inventoryRows,
      reservations: reservationsRows,
      student_activity: studentActivityRows,
    },
  };
}

/**
 * Escapes CSV cell values against formula injection (=, +, -, @, tab, CR) and quotes safely.
 */
export function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  let raw = String(value).replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(raw)) {
    raw = `'${raw}`;
  }
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function buildReportCsvContent(options: {
  reportTitle: string;
  generatedAtIso: string;
  activeFiltersSummary: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}): string {
  const lines: string[] = [];
  lines.push([sanitizeCsvCell('Report Title'), sanitizeCsvCell(options.reportTitle)].join(','));
  lines.push([sanitizeCsvCell('Generated At'), sanitizeCsvCell(options.generatedAtIso)].join(','));
  lines.push(
    [sanitizeCsvCell('Active Filters'), sanitizeCsvCell(options.activeFiltersSummary)].join(',')
  );
  lines.push('');
  lines.push(options.headers.map((h) => sanitizeCsvCell(h)).join(','));
  for (const row of options.rows) {
    lines.push(row.map((cell) => sanitizeCsvCell(cell)).join(','));
  }
  return lines.join('\r\n');
}

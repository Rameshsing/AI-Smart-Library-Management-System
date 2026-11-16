import { DEMO_BOOKS, type AppRoute } from '../data/libraryData';
import {
  formatDueRemainingLabel,
  getBorrowUrgency,
  getDaysRemaining,
  getTimeGreeting,
} from './studentDashboard';

export { formatDueRemainingLabel, getBorrowUrgency, getDaysRemaining, getTimeGreeting };

export type LibrarianSectionRoute = Extract<
  AppRoute['name'],
  | 'librarian-dashboard'
  | 'librarian-inventory'
  | 'librarian-add-book'
  | 'librarian-issue-books'
  | 'librarian-return-books'
  | 'librarian-reservations'
  | 'librarian-students'
  | 'librarian-overdue'
  | 'librarian-announcements'
  | 'librarian-reports'
  | 'librarian-profile'
>;

export function isLibrarianSectionRoute(
  routeName: AppRoute['name']
): routeName is LibrarianSectionRoute {
  return (
    routeName === 'librarian-dashboard' ||
    routeName === 'librarian-inventory' ||
    routeName === 'librarian-add-book' ||
    routeName === 'librarian-issue-books' ||
    routeName === 'librarian-return-books' ||
    routeName === 'librarian-reservations' ||
    routeName === 'librarian-students' ||
    routeName === 'librarian-overdue' ||
    routeName === 'librarian-announcements' ||
    routeName === 'librarian-reports' ||
    routeName === 'librarian-profile'
  );
}

export interface LibrarianPermissions {
  can_manage_inventory: boolean;
  can_issue_books: boolean;
  can_return_books: boolean;
  can_manage_reservations: boolean;
  can_view_student_records: boolean;
  can_view_new_registrations: boolean;
  can_manage_announcements: boolean;
  can_view_reports: boolean;
}

export interface LibrarianProfile {
  librarian_id: number;
  user_id: number;
  staff_code: string;
  full_name: string;
  email: string;
  department_title: string;
  role: 'librarian';
  account_status: 'Active' | 'Suspended';
  avatar_url: string | null;
  permissions: LibrarianPermissions;
}

export interface LibrarianSessionCheckResponse {
  authenticated: boolean;
  verified_role?: 'student' | 'librarian' | 'admin' | string;
  librarian?: LibrarianProfile;
  message?: string;
}

export function verifyLibrarianSessionRole(
  session: LibrarianSessionCheckResponse | null | undefined
): {
  authorized: boolean;
  redirectRoute?: AppRoute;
  reason?: string;
} {
  if (!session || !session.authenticated || !session.verified_role) {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: session?.message ?? 'Librarian authentication required.',
    };
  }

  if (session.verified_role === 'student') {
    return {
      authorized: false,
      redirectRoute: { name: 'student-dashboard' },
      reason: 'Student accounts cannot access librarian operations routes.',
    };
  }

  if (session.verified_role === 'admin') {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-dashboard' },
      reason: 'Administrator accounts must use the Admin Dashboard.',
    };
  }

  if (session.verified_role !== 'librarian') {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: 'Verified librarian privileges are required to view this workspace.',
    };
  }

  if (session.librarian && session.librarian.account_status !== 'Active') {
    return {
      authorized: false,
      redirectRoute: { name: 'admin-login' },
      reason: 'Your staff account is not active. Contact a library administrator.',
    };
  }

  return { authorized: true };
}

export interface SummaryPreviousDelta {
  total_books?: number | null;
  total_copies?: number | null;
  available_copies?: number | null;
  currently_issued?: number | null;
  pending_reservations?: number | null;
  overdue_books?: number | null;
}

export interface LibrarianSummaryPayload {
  is_prototype_sample: boolean;
  librarian: LibrarianProfile;
  metrics: {
    total_books_unique_titles: number;
    total_book_copies: number;
    available_copies: number;
    currently_issued: number;
    pending_reservations: number;
    overdue_books: number;
    previous_period_delta?: SummaryPreviousDelta | null;
  };
  supported_borrowing_statuses: Array<'Issued' | 'Returned' | 'Overdue' | 'Renewal Pending'>;
}

export type LibrarianBorrowingStatus = 'Issued' | 'Returned' | 'Overdue' | 'Renewal Pending';

export interface LibrarianBorrowingRecord {
  borrowing_id: number;
  transaction_code: string;
  student_id: number;
  student_name: string;
  student_code: string;
  book_id: number;
  book_slug: string;
  book_title: string;
  copy_id: number;
  accession_number: string;
  shelf_location: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: LibrarianBorrowingStatus;
}

export interface RecentBorrowingsPayload {
  items: LibrarianBorrowingRecord[];
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

export interface ExpectedReturnItem {
  borrowing_id: number;
  book_id: number;
  book_slug: string;
  book_title: string;
  student_name: string;
  student_code: string;
  issue_date: string;
  due_date: string;
  status: 'Issued' | 'Overdue' | 'Renewal Pending';
}

export interface ExpectedReturnsPayload {
  items: ExpectedReturnItem[];
  total_upcoming_or_overdue: number;
}

export type LibrarianReservationStatus =
  | 'Waiting'
  | 'Ready for Pickup'
  | 'Expiring Soon'
  | 'Fulfilled';

export interface LibrarianReservationRecord {
  reservation_id: number;
  book_id: number;
  book_slug: string;
  book_title: string;
  student_name: string;
  student_code: string;
  reservation_date: string;
  queue_position: number | null;
  status: LibrarianReservationStatus;
}

export interface LibrarianReservationsOverviewPayload {
  counts: {
    active_waiting: number;
    ready_for_pickup: number;
    expiring_soon: number;
    recently_fulfilled: number;
  };
  supports_queue_position: boolean;
  items: LibrarianReservationRecord[];
}

export type InventoryStatus = 'Available' | 'Low Stock' | 'Unavailable';

export interface InventoryBookOverviewItem {
  book_id: number;
  slug: string;
  cover_image: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  total_copies: number;
  available_copies: number;
  is_recently_added: boolean;
}

export interface InventoryOverviewPayload {
  configured_low_stock_threshold: number | null;
  counts: {
    recently_added: number;
    low_copy_titles: number | null;
    unavailable_titles: number;
    available_titles: number;
  };
  items: InventoryBookOverviewItem[];
}

export function deriveInventoryStatus(
  availableCopies: number,
  totalCopies: number,
  configuredThreshold: number | null
): InventoryStatus {
  if (availableCopies <= 0 || totalCopies <= 0) {
    return 'Unavailable';
  }
  if (
    configuredThreshold !== null &&
    configuredThreshold > 0 &&
    availableCopies <= configuredThreshold
  ) {
    return 'Low Stock';
  }
  return 'Available';
}

export type StudentActivityType =
  | 'new_registration'
  | 'borrowing'
  | 'return'
  | 'reservation'
  | 'feedback';

export interface LibrarianStudentActivityRecord {
  activity_id: string;
  type: StudentActivityType;
  student_name: string;
  student_code: string;
  book_title: string | null;
  summary: string;
  timestamp: string;
}

export interface StudentActivityPayload {
  items: LibrarianStudentActivityRecord[];
}

export function filterAuthorizedStudentActivity(
  items: LibrarianStudentActivityRecord[],
  permissions: LibrarianPermissions
): LibrarianStudentActivityRecord[] {
  if (!permissions.can_view_student_records) {
    return [];
  }
  return items.filter((item) => {
    if (item.type === 'new_registration' && !permissions.can_view_new_registrations) {
      return false;
    }
    return true;
  });
}

export type AlertPriority = 'Urgent' | 'High' | 'Normal';

export interface LibrarianAlertRecord {
  alert_id: string;
  category:
    | 'overdue'
    | 'due_today'
    | 'reservation_ready'
    | 'reservation_expiring'
    | 'low_inventory'
    | 'pending_return'
    | 'announcement';
  title: string;
  description: string;
  priority: AlertPriority;
  timestamp: string | null;
  action_label: string;
  action_route: LibrarianSectionRoute;
}

export interface LibrarianAlertsPayload {
  items: LibrarianAlertRecord[];
}

export function deduplicateAlerts(items: LibrarianAlertRecord[]): LibrarianAlertRecord[] {
  const seen = new Set<string>();
  const unique: LibrarianAlertRecord[] = [];
  for (const item of items) {
    const key = `${item.category}::${item.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

export type AnnouncementStatus = 'Published' | 'Scheduled' | 'Draft' | 'Attention Required';

export interface LibrarianAnnouncementRecord {
  announcement_id: number;
  title: string;
  description: string;
  published_at: string;
  author_department: string;
  status: AnnouncementStatus;
}

export interface LibrarianAnalyticsPayload {
  has_sufficient_data: boolean;
  books_issued_this_month: number;
  books_returned_this_month: number;
  reservation_activity_this_month: number;
  most_borrowed_categories: Array<{ category: string; borrow_count: number }>;
  most_borrowed_titles: Array<{ book_id: number; title: string; borrow_count: number }>;
  monthly_borrowing_activity: Array<{ month: string; issued: number; returned: number }>;
}

export interface LibrarianDashboardFullData {
  summary: LibrarianSummaryPayload;
  recentBorrowings: RecentBorrowingsPayload;
  expectedReturns: ExpectedReturnsPayload;
  reservations: LibrarianReservationsOverviewPayload;
  inventory: InventoryOverviewPayload;
  alerts: LibrarianAlertsPayload;
  studentActivity: StudentActivityPayload;
  announcements: LibrarianAnnouncementRecord[];
  analytics: LibrarianAnalyticsPayload;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

export function formatLibrarianCurrentDate(date: Date = new Date()): string {
  const dayName = WEEKDAY_SHORT[date.getDay()] ?? '';
  const dayNum = date.getDate();
  const monthName = MONTH_SHORT[date.getMonth()] ?? '';
  const year = date.getFullYear();
  return `${dayName}, ${dayNum} ${monthName} ${year}`;
}

export function formatStaffDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  const day = parsed.getDate();
  const month = MONTH_SHORT[parsed.getMonth()] ?? '';
  const year = parsed.getFullYear();
  if (isoString.includes('T')) {
    const hh = String(parsed.getHours()).padStart(2, '0');
    const mm = String(parsed.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  }
  return `${day} ${month} ${year}`;
}

export function formatLibrarianShortDate(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const trimmed = isoString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split('-').map((n) => Number(n));
    const monthName = MONTH_SHORT[(mm ?? 1) - 1] ?? '';
    return `${dd} ${monthName} ${yyyy}`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return isoString;
  const day = parsed.getDate();
  const month = MONTH_SHORT[parsed.getMonth()] ?? '';
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

function addDaysIso(baseDate: Date, offsetDays: number): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysTimeIso(
  baseDate: Date,
  offsetDays: number,
  hour: number,
  minute: number
): string {
  return `${addDaysIso(baseDate, offsetDays)}T${String(hour).padStart(2, '0')}:${String(
    minute
  ).padStart(2, '0')}:00`;
}

export function createSampleLibrarianDashboardBundles(
  referenceDate: Date = new Date()
): LibrarianDashboardFullData {
  const librarian: LibrarianProfile = {
    librarian_id: 204,
    user_id: 88,
    staff_code: 'LIB-2026-008',
    full_name: 'Dr. Priya Nair',
    email: 'priya.nair@library.university.edu',
    department_title: 'Head of Circulation & Academic Reserves',
    role: 'librarian',
    account_status: 'Active',
    avatar_url: null,
    permissions: {
      can_manage_inventory: true,
      can_issue_books: true,
      can_return_books: true,
      can_manage_reservations: true,
      can_view_student_records: true,
      can_view_new_registrations: true,
      can_manage_announcements: true,
      can_view_reports: true,
    },
  };

  const inventoryItems: InventoryBookOverviewItem[] = DEMO_BOOKS.map((book, idx) => ({
    book_id: idx + 1,
    slug: book.slug,
    cover_image: book.coverImage,
    title: book.title,
    author: book.author,
    isbn: book.isbnPlaceholder,
    category: book.category,
    total_copies: book.totalCopies,
    available_copies: book.availableCopies,
    is_recently_added: idx === 0 || idx === 2,
  }));

  const configuredThreshold = 1;
  const totalUniqueTitles = inventoryItems.length;
  const totalCopies = inventoryItems.reduce((sum, item) => sum + item.total_copies, 0);
  const availableCopies = inventoryItems.reduce((sum, item) => sum + item.available_copies, 0);

  const borrowings: LibrarianBorrowingRecord[] = [
    {
      borrowing_id: 8401,
      transaction_code: 'TXN-2026-8401',
      student_id: 1042,
      student_name: 'Ananya Verma',
      student_code: 'STU-2026-042',
      book_id: 3,
      book_slug: DEMO_BOOKS[2].slug,
      book_title: DEMO_BOOKS[2].title,
      copy_id: 302,
      accession_number: 'ACC-DS-308-B',
      shelf_location: 'Floor 2 · Row DS-308',
      issue_date: addDaysIso(referenceDate, -16),
      due_date: addDaysIso(referenceDate, -2),
      return_date: null,
      status: 'Overdue',
    },
    {
      borrowing_id: 8402,
      transaction_code: 'TXN-2026-8402',
      student_id: 1089,
      student_name: 'Rohan Kulkarni',
      student_code: 'STU-2026-089',
      book_id: 5,
      book_slug: DEMO_BOOKS[4].slug,
      book_title: DEMO_BOOKS[4].title,
      copy_id: 501,
      accession_number: 'ACC-PS-119-A',
      shelf_location: 'Floor 1 · Row PS-119',
      issue_date: addDaysIso(referenceDate, -14),
      due_date: addDaysIso(referenceDate, 0),
      return_date: null,
      status: 'Issued',
    },
    {
      borrowing_id: 8403,
      transaction_code: 'TXN-2026-8403',
      student_id: 1114,
      student_name: 'Meera Iyer',
      student_code: 'STU-2026-114',
      book_id: 1,
      book_slug: DEMO_BOOKS[0].slug,
      book_title: DEMO_BOOKS[0].title,
      copy_id: 103,
      accession_number: 'ACC-AI-104-C',
      shelf_location: 'Floor 3 · Row AI-104',
      issue_date: addDaysIso(referenceDate, -12),
      due_date: addDaysIso(referenceDate, 2),
      return_date: null,
      status: 'Renewal Pending',
    },
    {
      borrowing_id: 8404,
      transaction_code: 'TXN-2026-8404',
      student_id: 1150,
      student_name: 'Kabir Sharma',
      student_code: 'STU-2026-150',
      book_id: 2,
      book_slug: DEMO_BOOKS[1].slug,
      book_title: DEMO_BOOKS[1].title,
      copy_id: 201,
      accession_number: 'ACC-CS-212-A',
      shelf_location: 'Floor 2 · Row CS-212',
      issue_date: addDaysIso(referenceDate, -5),
      due_date: addDaysIso(referenceDate, 9),
      return_date: null,
      status: 'Issued',
    },
    {
      borrowing_id: 8405,
      transaction_code: 'TXN-2026-8405',
      student_id: 1042,
      student_name: 'Ananya Verma',
      student_code: 'STU-2026-042',
      book_id: 4,
      book_slug: DEMO_BOOKS[3].slug,
      book_title: DEMO_BOOKS[3].title,
      copy_id: 404,
      accession_number: 'ACC-SE-415-D',
      shelf_location: 'Floor 3 · Row SE-415',
      issue_date: addDaysIso(referenceDate, -10),
      due_date: addDaysIso(referenceDate, 4),
      return_date: addDaysIso(referenceDate, -1),
      status: 'Returned',
    },
  ];

  const activeBorrowingsCount = borrowings.filter((b) => b.status !== 'Returned').length;
  const overdueBorrowingsCount = borrowings.filter((b) => b.status === 'Overdue').length;

  const reservationItems: LibrarianReservationRecord[] = [
    {
      reservation_id: 6201,
      book_id: 5,
      book_slug: DEMO_BOOKS[4].slug,
      book_title: DEMO_BOOKS[4].title,
      student_name: 'Neha Deshmukh',
      student_code: 'STU-2026-127',
      reservation_date: addDaysIso(referenceDate, -3),
      queue_position: 1,
      status: 'Expiring Soon',
    },
    {
      reservation_id: 6202,
      book_id: 3,
      book_slug: DEMO_BOOKS[2].slug,
      book_title: DEMO_BOOKS[2].title,
      student_name: 'Arjun Menon',
      student_code: 'STU-2026-063',
      reservation_date: addDaysIso(referenceDate, -2),
      queue_position: null,
      status: 'Ready for Pickup',
    },
    {
      reservation_id: 6203,
      book_id: 5,
      book_slug: DEMO_BOOKS[4].slug,
      book_title: DEMO_BOOKS[4].title,
      student_name: 'Siddharth Rao',
      student_code: 'STU-2026-198',
      reservation_date: addDaysIso(referenceDate, -1),
      queue_position: 2,
      status: 'Waiting',
    },
    {
      reservation_id: 6204,
      book_id: 2,
      book_slug: DEMO_BOOKS[1].slug,
      book_title: DEMO_BOOKS[1].title,
      student_name: 'Tanya Bose',
      student_code: 'STU-2026-031',
      reservation_date: addDaysIso(referenceDate, -4),
      queue_position: null,
      status: 'Fulfilled',
    },
  ];

  const expectedReturns: ExpectedReturnItem[] = borrowings
    .filter((b) => b.status !== 'Returned')
    .sort((a, b) => getDaysRemaining(a.due_date, referenceDate) - getDaysRemaining(b.due_date, referenceDate))
    .map((b) => ({
      borrowing_id: b.borrowing_id,
      book_id: b.book_id,
      book_slug: b.book_slug,
      book_title: b.book_title,
      student_name: b.student_name,
      student_code: b.student_code,
      issue_date: b.issue_date,
      due_date: b.due_date,
      status: b.status === 'Returned' ? 'Issued' : b.status,
    }));

  const unavailableCount = inventoryItems.filter((b) => b.available_copies <= 0).length;
  const lowCopyCount = inventoryItems.filter(
    (b) => b.available_copies > 0 && b.available_copies <= configuredThreshold
  ).length;
  const availableTitleCount = inventoryItems.filter((b) => b.available_copies > 0).length;

  const alerts = deduplicateAlerts([
    {
      alert_id: 'alt-overdue-1',
      category: 'overdue',
      title: `${overdueBorrowingsCount} Overdue Book Requires Follow-Up`,
      description: `"${DEMO_BOOKS[2].title}" borrowed by Ananya Verma (STU-2026-042) is 2 days past due.`,
      priority: 'Urgent',
      timestamp: addDaysTimeIso(referenceDate, 0, 8, 30),
      action_label: 'Open Overdue Books',
      action_route: 'librarian-overdue',
    },
    {
      alert_id: 'alt-due-today-1',
      category: 'due_today',
      title: '1 Book Due Back Today',
      description: `"${DEMO_BOOKS[4].title}" (Rohan Kulkarni · STU-2026-089) is scheduled for return today.`,
      priority: 'High',
      timestamp: addDaysTimeIso(referenceDate, 0, 8, 45),
      action_label: 'Process Return',
      action_route: 'librarian-return-books',
    },
    {
      alert_id: 'alt-res-expiring-1',
      category: 'reservation_expiring',
      title: 'Hold Shelf Pickup Window Expiring Soon',
      description: `Reservation for "${DEMO_BOOKS[4].title}" expires soon on Hold Shelf B-02.`,
      priority: 'High',
      timestamp: addDaysTimeIso(referenceDate, 0, 9, 10),
      action_label: 'Manage Reservations',
      action_route: 'librarian-reservations',
    },
    {
      alert_id: 'alt-low-inv-1',
      category: 'low_inventory',
      title: `${lowCopyCount} Low-Copy Title & ${unavailableCount} Checked Out`,
      description: `Configured threshold (${configuredThreshold} copy): "${DEMO_BOOKS[2].title}" has 1 copy left.`,
      priority: 'Normal',
      timestamp: addDaysTimeIso(referenceDate, -1, 16, 20),
      action_label: 'Inspect Inventory',
      action_route: 'librarian-inventory',
    },
  ]);

  const studentActivity: LibrarianStudentActivityRecord[] = [
    {
      activity_id: 'act-1',
      type: 'return',
      student_name: 'Ananya Verma',
      student_code: 'STU-2026-042',
      book_title: DEMO_BOOKS[3].title,
      summary: 'Returned copy ACC-SE-415-D at Circulation Desk 1.',
      timestamp: addDaysTimeIso(referenceDate, -1, 15, 40),
    },
    {
      activity_id: 'act-2',
      type: 'reservation',
      student_name: 'Siddharth Rao',
      student_code: 'STU-2026-198',
      book_title: DEMO_BOOKS[4].title,
      summary: 'Joined hold queue (#2) for checked-out copy.',
      timestamp: addDaysTimeIso(referenceDate, -1, 14, 15),
    },
    {
      activity_id: 'act-3',
      type: 'feedback',
      student_name: 'Meera Iyer',
      student_code: 'STU-2026-114',
      book_title: DEMO_BOOKS[0].title,
      summary: 'Submitted a 5-star course review aiding recommendation quality.',
      timestamp: addDaysTimeIso(referenceDate, -2, 11, 20),
    },
    {
      activity_id: 'act-4',
      type: 'new_registration',
      student_name: 'Vikram Joshi',
      student_code: 'STU-2026-219',
      book_title: null,
      summary: 'Completed Computer Science student library onboarding.',
      timestamp: addDaysTimeIso(referenceDate, -2, 10, 5),
    },
  ];

  const announcements: LibrarianAnnouncementRecord[] = [
    {
      announcement_id: 301,
      title: 'Extended Reading Hall Hours During End-Semester Assessments',
      description:
        'Main Library Reading Halls and Circulation Desks stay open from 07:30 to 23:00 for exam preparation.',
      published_at: addDaysIso(referenceDate, -2),
      author_department: 'Chief Librarian Office',
      status: 'Published',
    },
    {
      announcement_id: 302,
      title: 'Annual Stock Verification & Reference Audit Notice',
      description:
        'Departmental reserve shelves CS-200 through AI-150 will undergo barcode verification next Monday.',
      published_at: addDaysIso(referenceDate, 0),
      author_department: 'Cataloguing & Inventory Team',
      status: 'Attention Required',
    },
  ];

  return {
    summary: {
      is_prototype_sample: true,
      librarian,
      metrics: {
        total_books_unique_titles: totalUniqueTitles,
        total_book_copies: totalCopies,
        available_copies: availableCopies,
        currently_issued: activeBorrowingsCount,
        pending_reservations: 3,
        overdue_books: overdueBorrowingsCount,
        previous_period_delta: {
          currently_issued: 2,
          overdue_books: -1,
        },
      },
      supported_borrowing_statuses: ['Issued', 'Returned', 'Overdue', 'Renewal Pending'],
    },
    recentBorrowings: {
      items: borrowings,
      page: 1,
      limit: 5,
      total_count: borrowings.length,
      total_pages: 1,
    },
    expectedReturns: {
      items: expectedReturns,
      total_upcoming_or_overdue: expectedReturns.length,
    },
    reservations: {
      counts: {
        active_waiting: 1,
        ready_for_pickup: 1,
        expiring_soon: 1,
        recently_fulfilled: 1,
      },
      supports_queue_position: true,
      items: reservationItems,
    },
    inventory: {
      configured_low_stock_threshold: configuredThreshold,
      counts: {
        recently_added: 2,
        low_copy_titles: lowCopyCount,
        unavailable_titles: unavailableCount,
        available_titles: availableTitleCount,
      },
      items: inventoryItems,
    },
    alerts: {
      items: alerts,
    },
    studentActivity: {
      items: studentActivity,
    },
    announcements,
    analytics: {
      has_sufficient_data: true,
      books_issued_this_month: 38,
      books_returned_this_month: 31,
      reservation_activity_this_month: 14,
      most_borrowed_categories: [
        { category: 'Artificial Intelligence', borrow_count: 14 },
        { category: 'Computer Science', borrow_count: 11 },
        { category: 'Data Science', borrow_count: 8 },
        { category: 'Software Engineering', borrow_count: 5 },
      ],
      most_borrowed_titles: [
        { book_id: 1, title: DEMO_BOOKS[0].title, borrow_count: 9 },
        { book_id: 2, title: DEMO_BOOKS[1].title, borrow_count: 7 },
        { book_id: 3, title: DEMO_BOOKS[2].title, borrow_count: 6 },
      ],
      monthly_borrowing_activity: [
        { month: 'Jun', issued: 22, returned: 19 },
        { month: 'Jul', issued: 27, returned: 25 },
        { month: 'Aug', issued: 18, returned: 17 },
        { month: 'Sep', issued: 34, returned: 29 },
        { month: 'Oct', issued: 31, returned: 30 },
        { month: 'Nov', issued: 38, returned: 31 },
      ],
    },
  };
}

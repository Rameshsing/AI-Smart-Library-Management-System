import { DEMO_BOOKS } from '../data/libraryData';
import {
  computeBorrowingLoanMetrics,
  createSampleCirculationStore,
  evaluateStudentEligibility,
  type CirculationPolicy,
  type CirculationStudentRecord,
  type CirculationStudentStatus,
} from './librarianCirculation';
import {
  createSampleLibrarianDashboardBundles,
  getBorrowUrgency,
  getDaysRemaining,
} from './librarianDashboard';
import {
  createSampleReservationsStore,
  type LibrarianReservationItem,
} from './librarianReservations';

export interface LibrarianStudentDirectoryItem extends CirculationStudentRecord {
  institution: string;
  academic_year: string;
  semester: string;
  mobile: string | null;
  active_reservations_count: number;
  total_books_borrowed: number;
  completed_loans_count: number;
}

export interface StudentCurrentBorrowingItem {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_author: string;
  book_cover: string;
  copy_id: number;
  accession_number: string;
  issue_date: string;
  due_date: string;
  display_status: 'Active' | 'Due Soon' | 'Due Today' | 'Overdue';
  days_overdue: number;
  fine_label: string;
}

export interface StudentBorrowingHistoryItem {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_author: string;
  category: string;
  issue_date: string;
  return_date: string;
  loan_duration_days: number;
  status: 'Returned';
}

export interface StudentRatingContextSummary {
  permitted: boolean;
  ratings_count: number;
  average_rating_given: number | null;
  rated_books: Array<{
    book_id: number;
    book_title: string;
    rating: number;
    rated_at: string;
  }>;
}

export interface StudentComputedLibraryStats {
  totalBooksBorrowed: number;
  currentlyBorrowed: number;
  completedLoans: number;
  overdueCount: number;
  averageLoanDurationDays: number | null;
  favoriteCategories: Array<{ category: string; count: number }>;
}

export interface LibrarianStudentFullProfile {
  student: LibrarianStudentDirectoryItem;
  current_borrowings: StudentCurrentBorrowingItem[];
  reservations: LibrarianReservationItem[];
  borrowing_history: StudentBorrowingHistoryItem[];
  rating_context: StudentRatingContextSummary;
}

export interface StudentDirectorySummary {
  totalStudents: number;
  activeStudents: number;
  withActiveLoans: number;
  withOverdueBooks: number;
  withReservations: number;
}

export interface StudentRecordsSupportedCapabilities {
  can_block_unblock: boolean;
  can_view_ratings: boolean;
  supported_filters: {
    account_status: boolean;
    department: boolean;
    course: boolean;
    academic_year: boolean;
    activity_flags: boolean;
  };
}

export interface StudentFilterCriteria {
  query: string;
  accountStatus: 'All' | CirculationStudentStatus;
  department: string;
  course: string;
  academicYear: string;
  onlyActiveLoans: boolean;
  onlyOverdue: boolean;
  onlyWithReservations: boolean;
}

const SENSITIVE_STUDENT_KEYS = new Set([
  'password',
  'password_hash',
  'hashed_password',
  'salt',
  'auth_token',
  'access_token',
  'refresh_token',
  'session_token',
  'secret_question',
  'secret_answer',
  'recommendation_explanation',
  'private_preferences',
]);

export function sanitizeStudentRecordForLibrarian<T extends Record<string, unknown>>(
  raw: T
): Partial<T> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!SENSITIVE_STUDENT_KEYS.has(key.toLowerCase())) {
      cleaned[key] = value;
    }
  }
  return cleaned as Partial<T>;
}

export function computeStudentDirectorySummary(
  students: LibrarianStudentDirectoryItem[]
): StudentDirectorySummary {
  let activeStudents = 0;
  let withActiveLoans = 0;
  let withOverdueBooks = 0;
  let withReservations = 0;

  for (const s of students) {
    if (s.account_status === 'Active') activeStudents += 1;
    if (s.active_loans_count > 0) withActiveLoans += 1;
    if (s.overdue_count > 0) withOverdueBooks += 1;
    if (s.active_reservations_count > 0) withReservations += 1;
  }

  return {
    totalStudents: students.length,
    activeStudents,
    withActiveLoans,
    withOverdueBooks,
    withReservations,
  };
}

export function deriveStudentRestrictionBanner(student: CirculationStudentRecord): {
  restricted: boolean;
  title: string;
  reason: string | null;
} {
  const eligibility = evaluateStudentEligibility({ student });
  if (!eligibility.eligible) {
    const title =
      eligibility.reasonCode === 'ACCOUNT_BLOCKED'
        ? `Account ${student.account_status}`
        : eligibility.reasonCode === 'LIMIT_REACHED'
          ? 'Borrowing Limit Reached'
          : 'Borrowing Restricted';
    return {
      restricted: true,
      title,
      reason: eligibility.message,
    };
  }
  if (student.overdue_count > 0) {
    return {
      restricted: false,
      title: 'Overdue Items Present',
      reason: `${student.overdue_count} overdue item${student.overdue_count === 1 ? '' : 's'} flagged for return follow-up.`,
    };
  }
  return { restricted: false, title: 'Eligible for borrowing', reason: null };
}

export function mapActiveBorrowingDisplayStatus(
  dueDateIso: string,
  referenceDate: Date
): 'Active' | 'Due Soon' | 'Due Today' | 'Overdue' {
  const clean = dueDateIso.trim();
  const normalizedIso = /^\d{4}-\d{2}-\d{2}$/.test(clean) ? `${clean}T00:00:00` : clean;
  const daysRemaining = getDaysRemaining(normalizedIso, referenceDate);
  const urgency = getBorrowUrgency(daysRemaining);
  if (urgency === 'overdue') return 'Overdue';
  if (daysRemaining === 0) return 'Due Today';
  if (urgency === 'due-soon') return 'Due Soon';
  return 'Active';
}

export function computeStudentLibraryStats(params: {
  student: Pick<
    LibrarianStudentDirectoryItem,
    'active_loans_count' | 'overdue_count' | 'total_books_borrowed' | 'completed_loans_count'
  >;
  history: StudentBorrowingHistoryItem[];
}): StudentComputedLibraryStats {
  const durations = params.history
    .map((h) => h.loan_duration_days)
    .filter((d) => typeof d === 'number' && Number.isFinite(d) && d > 0);

  const averageLoanDurationDays =
    durations.length >= 2
      ? Number((durations.reduce((acc, d) => acc + d, 0) / durations.length).toFixed(1))
      : null;

  const categoryCounts = new Map<string, number>();
  for (const h of params.history) {
    if (h.category) {
      categoryCounts.set(h.category, (categoryCounts.get(h.category) ?? 0) + 1);
    }
  }

  const favoriteCategories =
    params.history.length >= 2
      ? Array.from(categoryCounts.entries())
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
      : [];

  return {
    totalBooksBorrowed: Math.max(
      params.student.total_books_borrowed,
      params.student.active_loans_count + params.history.length
    ),
    currentlyBorrowed: params.student.active_loans_count,
    completedLoans: Math.max(params.student.completed_loans_count, params.history.length),
    overdueCount: params.student.overdue_count,
    averageLoanDurationDays,
    favoriteCategories,
  };
}

export function filterAndPaginateStudents(
  students: LibrarianStudentDirectoryItem[],
  filters: StudentFilterCriteria,
  page: number,
  pageSize: number
): {
  items: LibrarianStudentDirectoryItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const cleanQuery = filters.query.trim().toLowerCase();

  const filtered = students.filter((s) => {
    if (cleanQuery) {
      const haystack = [
        s.full_name,
        s.student_code,
        s.roll_number,
        s.email,
        s.department,
        s.program,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(cleanQuery)) return false;
    }

    if (filters.accountStatus !== 'All' && s.account_status !== filters.accountStatus) {
      return false;
    }
    if (filters.department !== 'All' && s.department !== filters.department) return false;
    if (filters.course !== 'All' && !s.program.startsWith(filters.course)) return false;
    if (filters.academicYear !== 'All' && s.academic_year !== filters.academicYear) return false;
    if (filters.onlyActiveLoans && s.active_loans_count <= 0) return false;
    if (filters.onlyOverdue && s.overdue_count <= 0) return false;
    if (filters.onlyWithReservations && s.active_reservations_count <= 0) return false;

    return true;
  });

  const safeSize = Math.max(1, pageSize);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * safeSize;

  return {
    items: filtered.slice(startIndex, startIndex + safeSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function buildStudentsApiQueryParams(
  filters: StudentFilterCriteria,
  page: number,
  limit: number
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, page)));
  params.set('limit', String(Math.max(1, limit)));
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.accountStatus !== 'All') params.set('account_status', filters.accountStatus);
  if (filters.department !== 'All') params.set('department', filters.department);
  if (filters.course !== 'All') params.set('course', filters.course);
  if (filters.academicYear !== 'All') params.set('academic_year', filters.academicYear);
  if (filters.onlyActiveLoans) params.set('has_active_loans', 'true');
  if (filters.onlyOverdue) params.set('has_overdue', 'true');
  if (filters.onlyWithReservations) params.set('has_reservations', 'true');
  return params;
}

export function mapStudentRecordApiError(status: number, serverMessage?: string): string {
  const clean = serverMessage?.trim();
  if (status === 401) return clean || 'Librarian session expired. Please sign in again.';
  if (status === 403) {
    return clean || 'Your librarian account does not have permission to access student records.';
  }
  if (status === 404) return clean || 'Student record not found.';
  if (status >= 500) {
    return clean || 'Unable to load student records. Please try again.';
  }
  return clean || `Student records request failed (HTTP ${status}).`;
}

function addDaysIsoDate(baseDate: Date, offsetDays: number): string {
  const d = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function createSampleStudentRecordsStore(referenceDate: Date = new Date()): {
  policy: CirculationPolicy;
  capabilities: StudentRecordsSupportedCapabilities;
  students: LibrarianStudentDirectoryItem[];
  profilesById: Record<number, LibrarianStudentFullProfile>;
} {
  const circulation = createSampleCirculationStore(referenceDate);
  const reservationsStore = createSampleReservationsStore(referenceDate);
  const dashboardBundles = createSampleLibrarianDashboardBundles(referenceDate);

  const extraStudents: CirculationStudentRecord[] = [
    {
      student_id: 1127,
      student_code: 'STU-2026-127',
      roll_number: 'PSY26-127',
      full_name: 'Neha Deshmukh',
      email: 'neha.deshmukh@university.edu',
      department: 'Cognitive & Behavioural Sciences',
      program: 'B.A. Psychology · Semester 5',
      account_status: 'Active',
      active_loans_count: 0,
      due_soon_count: 0,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 5,
      active_book_ids: [],
      restriction_reason: null,
    },
    {
      student_id: 1031,
      student_code: 'STU-2026-031',
      roll_number: 'CS26-031',
      full_name: 'Tanya Bose',
      email: 'tanya.bose@university.edu',
      department: 'Computer Science & Engineering',
      program: 'B.Tech Computer Science · Semester 6',
      account_status: 'Active',
      active_loans_count: 0,
      due_soon_count: 0,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 5,
      active_book_ids: [],
      restriction_reason: null,
    },
  ];

  const allCirculationStudents = [...circulation.students, ...extraStudents];

  const academicMeta: Record<
    number,
    { year: string; semester: string; mobile: string | null; completedCount: number }
  > = {
    1042: { year: '3rd Year', semester: 'Semester 6', mobile: '+91 98201 44102', completedCount: 4 },
    1089: { year: '2nd Year', semester: 'Semester 4', mobile: '+91 98201 44189', completedCount: 2 },
    1114: { year: '4th Year', semester: 'Semester 7', mobile: null, completedCount: 3 },
    1150: { year: '2nd Year', semester: 'Semester 3', mobile: '+91 98201 44250', completedCount: 2 },
    1063: { year: '2nd Year', semester: 'Semester 4', mobile: null, completedCount: 1 },
    1198: { year: '2nd Year', semester: 'Semester 4', mobile: '+91 98201 44398', completedCount: 1 },
    1127: { year: '3rd Year', semester: 'Semester 5', mobile: '+91 98201 44327', completedCount: 2 },
    1031: { year: '3rd Year', semester: 'Semester 6', mobile: null, completedCount: 3 },
  };

  const students: LibrarianStudentDirectoryItem[] = allCirculationStudents.map((s) => {
    const activeReservations = reservationsStore.items.filter(
      (r) =>
        r.student_id === s.student_id &&
        (r.status === 'Waiting' || r.status === 'Ready for Pickup')
    ).length;
    const meta = academicMeta[s.student_id] ?? {
      year: '2nd Year',
      semester: 'Semester 4',
      mobile: null,
      completedCount: 0,
    };

    return {
      ...s,
      institution: 'Institute of Technology & Digital Sciences',
      academic_year: meta.year,
      semester: meta.semester,
      mobile: meta.mobile,
      active_reservations_count: activeReservations,
      total_books_borrowed: s.active_loans_count + meta.completedCount,
      completed_loans_count: meta.completedCount,
    };
  });

  const historyByStudent: Record<number, StudentBorrowingHistoryItem[]> = {
    1042: [
      {
        borrowing_id: 8405,
        transaction_code: 'TXN-2026-8405',
        book_id: 4,
        book_slug: DEMO_BOOKS[3].slug,
        book_title: DEMO_BOOKS[3].title,
        book_author: DEMO_BOOKS[3].author,
        category: DEMO_BOOKS[3].category,
        issue_date: addDaysIsoDate(referenceDate, -10),
        return_date: addDaysIsoDate(referenceDate, -1),
        loan_duration_days: 9,
        status: 'Returned',
      },
      {
        borrowing_id: 8312,
        transaction_code: 'TXN-2026-8312',
        book_id: 1,
        book_slug: DEMO_BOOKS[0].slug,
        book_title: DEMO_BOOKS[0].title,
        book_author: DEMO_BOOKS[0].author,
        category: DEMO_BOOKS[0].category,
        issue_date: addDaysIsoDate(referenceDate, -38),
        return_date: addDaysIsoDate(referenceDate, -25),
        loan_duration_days: 13,
        status: 'Returned',
      },
      {
        borrowing_id: 8220,
        transaction_code: 'TXN-2026-8220',
        book_id: 2,
        book_slug: DEMO_BOOKS[1].slug,
        book_title: DEMO_BOOKS[1].title,
        book_author: DEMO_BOOKS[1].author,
        category: DEMO_BOOKS[1].category,
        issue_date: addDaysIsoDate(referenceDate, -60),
        return_date: addDaysIsoDate(referenceDate, -49),
        loan_duration_days: 11,
        status: 'Returned',
      },
      {
        borrowing_id: 8115,
        transaction_code: 'TXN-2026-8115',
        book_id: 1,
        book_slug: DEMO_BOOKS[0].slug,
        book_title: DEMO_BOOKS[0].title,
        book_author: DEMO_BOOKS[0].author,
        category: DEMO_BOOKS[0].category,
        issue_date: addDaysIsoDate(referenceDate, -84),
        return_date: addDaysIsoDate(referenceDate, -72),
        loan_duration_days: 12,
        status: 'Returned',
      },
    ],
    1089: [
      {
        borrowing_id: 8340,
        transaction_code: 'TXN-2026-8340',
        book_id: 3,
        book_slug: DEMO_BOOKS[2].slug,
        book_title: DEMO_BOOKS[2].title,
        book_author: DEMO_BOOKS[2].author,
        category: DEMO_BOOKS[2].category,
        issue_date: addDaysIsoDate(referenceDate, -42),
        return_date: addDaysIsoDate(referenceDate, -30),
        loan_duration_days: 12,
        status: 'Returned',
      },
      {
        borrowing_id: 8288,
        transaction_code: 'TXN-2026-8288',
        book_id: 1,
        book_slug: DEMO_BOOKS[0].slug,
        book_title: DEMO_BOOKS[0].title,
        book_author: DEMO_BOOKS[0].author,
        category: DEMO_BOOKS[0].category,
        issue_date: addDaysIsoDate(referenceDate, -65),
        return_date: addDaysIsoDate(referenceDate, -51),
        loan_duration_days: 14,
        status: 'Returned',
      },
    ],
    1114: [
      {
        borrowing_id: 8351,
        transaction_code: 'TXN-2026-8351',
        book_id: 2,
        book_slug: DEMO_BOOKS[1].slug,
        book_title: DEMO_BOOKS[1].title,
        book_author: DEMO_BOOKS[1].author,
        category: DEMO_BOOKS[1].category,
        issue_date: addDaysIsoDate(referenceDate, -32),
        return_date: addDaysIsoDate(referenceDate, -20),
        loan_duration_days: 12,
        status: 'Returned',
      },
      {
        borrowing_id: 8299,
        transaction_code: 'TXN-2026-8299',
        book_id: 4,
        book_slug: DEMO_BOOKS[3].slug,
        book_title: DEMO_BOOKS[3].title,
        book_author: DEMO_BOOKS[3].author,
        category: DEMO_BOOKS[3].category,
        issue_date: addDaysIsoDate(referenceDate, -54),
        return_date: addDaysIsoDate(referenceDate, -40),
        loan_duration_days: 14,
        status: 'Returned',
      },
      {
        borrowing_id: 8210,
        transaction_code: 'TXN-2026-8210',
        book_id: 2,
        book_slug: DEMO_BOOKS[1].slug,
        book_title: DEMO_BOOKS[1].title,
        book_author: DEMO_BOOKS[1].author,
        category: DEMO_BOOKS[1].category,
        issue_date: addDaysIsoDate(referenceDate, -78),
        return_date: addDaysIsoDate(referenceDate, -65),
        loan_duration_days: 13,
        status: 'Returned',
      },
    ],
    1150: [
      {
        borrowing_id: 8366,
        transaction_code: 'TXN-2026-8366',
        book_id: 4,
        book_slug: DEMO_BOOKS[3].slug,
        book_title: DEMO_BOOKS[3].title,
        book_author: DEMO_BOOKS[3].author,
        category: DEMO_BOOKS[3].category,
        issue_date: addDaysIsoDate(referenceDate, -28),
        return_date: addDaysIsoDate(referenceDate, -17),
        loan_duration_days: 11,
        status: 'Returned',
      },
      {
        borrowing_id: 8244,
        transaction_code: 'TXN-2026-8244',
        book_id: 1,
        book_slug: DEMO_BOOKS[0].slug,
        book_title: DEMO_BOOKS[0].title,
        book_author: DEMO_BOOKS[0].author,
        category: DEMO_BOOKS[0].category,
        issue_date: addDaysIsoDate(referenceDate, -50),
        return_date: addDaysIsoDate(referenceDate, -38),
        loan_duration_days: 12,
        status: 'Returned',
      },
    ],
  };

  const ratingsByStudent: Record<number, StudentRatingContextSummary> = {
    1042: {
      permitted: true,
      ratings_count: 3,
      average_rating_given: 4.7,
      rated_books: [
        {
          book_id: 4,
          book_title: DEMO_BOOKS[3].title,
          rating: 5,
          rated_at: addDaysIsoDate(referenceDate, -1),
        },
        {
          book_id: 1,
          book_title: DEMO_BOOKS[0].title,
          rating: 5,
          rated_at: addDaysIsoDate(referenceDate, -25),
        },
        {
          book_id: 2,
          book_title: DEMO_BOOKS[1].title,
          rating: 4,
          rated_at: addDaysIsoDate(referenceDate, -49),
        },
      ],
    },
    1089: {
      permitted: true,
      ratings_count: 2,
      average_rating_given: 4.5,
      rated_books: [
        {
          book_id: 3,
          book_title: DEMO_BOOKS[2].title,
          rating: 5,
          rated_at: addDaysIsoDate(referenceDate, -30),
        },
        {
          book_id: 1,
          book_title: DEMO_BOOKS[0].title,
          rating: 4,
          rated_at: addDaysIsoDate(referenceDate, -51),
        },
      ],
    },
  };

  const profilesById: Record<number, LibrarianStudentFullProfile> = {};

  for (const student of students) {
    const activeLoans: StudentCurrentBorrowingItem[] = circulation.borrowings
      .filter((b) => b.student_id === student.student_id && b.status !== 'Returned')
      .map((b) => {
        const metrics = computeBorrowingLoanMetrics(
          b,
          circulation.policy.server_reference_iso,
          circulation.policy
        );
        const demoBook = DEMO_BOOKS[b.book_id - 1] ?? DEMO_BOOKS[0];
        return {
          borrowing_id: b.borrowing_id,
          transaction_code: b.transaction_code,
          book_id: b.book_id,
          book_slug: demoBook.slug,
          book_title: b.book_title,
          book_author: b.book_author,
          book_cover: b.book_cover,
          copy_id: b.copy_id,
          accession_number: b.accession_number,
          issue_date: b.issue_date,
          due_date: b.due_date,
          display_status: mapActiveBorrowingDisplayStatus(b.due_date, referenceDate),
          days_overdue: metrics.daysOverdue,
          fine_label: metrics.fineSummaryLabel,
        };
      });

    // Keep consistent overdue items for Siddharth Rao's blocked status in sample data
    if (student.student_id === 1198 && activeLoans.length === 0) {
      const overdueBook = DEMO_BOOKS[5];
      const dummyBorrowing = {
        issue_date: addDaysIsoDate(referenceDate, -25),
        due_date: addDaysIsoDate(referenceDate, -8),
        status: 'Overdue' as const,
      };
      const metrics = computeBorrowingLoanMetrics(
        dummyBorrowing,
        circulation.policy.server_reference_iso,
        circulation.policy
      );
      activeLoans.push({
        borrowing_id: 8399,
        transaction_code: 'TXN-2026-8399',
        book_id: 6,
        book_slug: overdueBook.slug,
        book_title: overdueBook.title,
        book_author: overdueBook.author,
        book_cover: overdueBook.coverImage,
        copy_id: 601,
        accession_number: 'LIB-2026-0023',
        issue_date: dummyBorrowing.issue_date,
        due_date: dummyBorrowing.due_date,
        display_status: 'Overdue',
        days_overdue: metrics.daysOverdue,
        fine_label: metrics.fineSummaryLabel,
      });
    }

    profilesById[student.student_id] = {
      student,
      current_borrowings: activeLoans,
      reservations: reservationsStore.items.filter((r) => r.student_id === student.student_id),
      borrowing_history: historyByStudent[student.student_id] ?? [],
      rating_context: ratingsByStudent[student.student_id] ?? {
        permitted: true,
        ratings_count: 0,
        average_rating_given: null,
        rated_books: [],
      },
    };
  }

  void dashboardBundles;

  return {
    policy: circulation.policy,
    capabilities: {
      can_block_unblock: true,
      can_view_ratings: true,
      supported_filters: {
        account_status: true,
        department: true,
        course: true,
        academic_year: true,
        activity_flags: true,
      },
    },
    students,
    profilesById,
  };
}

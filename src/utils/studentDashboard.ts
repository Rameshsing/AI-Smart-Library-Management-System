import { DEMO_BOOKS, type AppRoute } from '../data/libraryData';

export const STUDENT_AVATAR_IMAGE =
  '/src/assets/images/student_avatar_profile_1794589807361.jpg';

export interface StudentProfile {
  student_id: number;
  student_code: string;
  name: string;
  email: string;
  course_department: string;
  academic_year: string;
  avatar_url: string;
  interests: string[];
  preferred_subjects: string[];
}

export interface LibraryBookRecord {
  book_id: number;
  slug: string;
  title: string;
  author: string;
  category: string;
  subject: string;
  cover: string;
  availability: 'Available' | 'Limited' | 'Checked Out';
  available_copies: number;
  total_copies: number;
  rating_average: number;
  added_at: string;
}

export interface BorrowingTransaction {
  transaction_id: number;
  student_id: number;
  book_id: number;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: 'borrowed' | 'returned' | 'overdue';
  progress_percent?: number;
  book: LibraryBookRecord;
}

export interface BookRecommendation {
  student_id: number;
  book_id: number;
  recommendation_score: number;
  recommendation_reason: string;
  book: LibraryBookRecord;
}

export interface BookRatingReview {
  student_id: number;
  book_id: number;
  rating: number;
  review: string;
  created_at: string;
  updated_at: string;
}

export interface StudentReservation {
  reservation_id: number;
  student_id: number;
  book_id: number;
  reserved_at: string;
  status: 'active' | 'ready_for_pickup' | 'fulfilled' | 'cancelled';
  book: LibraryBookRecord;
}

export interface StudentNotification {
  notification_id: number;
  student_id: number;
  type: 'due_reminder' | 'reservation_ready' | 'new_arrival' | 'rating_prompt';
  message: string;
  created_at: string;
  relative_time: string;
  is_read: boolean;
}

export interface MonthlyReadingPoint {
  month: string;
  books_completed: number;
  books_borrowed: number;
}

export interface StudentDashboardPayload {
  is_prototype_sample: boolean;
  student: StudentProfile;
  recommendations: BookRecommendation[];
  current_borrowings: BorrowingTransaction[];
  reading_history_count: number;
  reservations: StudentReservation[];
  recent_books: LibraryBookRecord[];
  notifications: StudentNotification[];
  monthly_reading_activity: MonthlyReadingPoint[];
  favourite_subjects_breakdown: Array<{ subject: string; count: number }>;
  recent_reviews: BookRatingReview[];
}

export type BorrowUrgency = 'normal' | 'due-soon' | 'overdue';

export interface ComputedDashboardSummary {
  currentlyBorrowedCount: number;
  dueSoonCount: number;
  readingHistoryCount: number;
  activeReservationsCount: number;
  unreadNotificationsCount: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toUtcDayStart(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTimeGreeting(hour: number): 'Good Morning' | 'Good Afternoon' | 'Good Evening' {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getDaysRemaining(dueDateIso: string, referenceDate: Date = new Date()): number {
  const parsed = new Date(dueDateIso);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const diffMs = toUtcDayStart(parsed) - toUtcDayStart(referenceDate);
  return Math.round(diffMs / MS_PER_DAY);
}

export function getBorrowUrgency(daysRemaining: number): BorrowUrgency {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 3) return 'due-soon';
  return 'normal';
}

export function formatDueRemainingLabel(daysRemaining: number): string {
  if (daysRemaining < -1) {
    return `Overdue by ${Math.abs(daysRemaining)} days`;
  }
  if (daysRemaining === -1) {
    return 'Overdue by 1 day';
  }
  if (daysRemaining === 0) {
    return 'Due today';
  }
  if (daysRemaining === 1) {
    return 'Due in 1 day';
  }
  return `Due in ${daysRemaining} days`;
}

export function getMostUrgentDueBook(
  borrowings: BorrowingTransaction[],
  referenceDate: Date = new Date()
): { borrowing: BorrowingTransaction; daysRemaining: number; urgency: BorrowUrgency } | null {
  const active = borrowings.filter((item) => item.status !== 'returned');
  if (active.length === 0) return null;

  const evaluated = active
    .map((borrowing) => {
      const daysRemaining = getDaysRemaining(borrowing.due_date, referenceDate);
      return {
        borrowing,
        daysRemaining,
        urgency: getBorrowUrgency(daysRemaining),
      };
    })
    .filter((entry) => entry.daysRemaining <= 3)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return evaluated[0] ?? null;
}

export function computeDashboardSummary(
  data: StudentDashboardPayload,
  referenceDate: Date = new Date()
): ComputedDashboardSummary {
  const activeBorrowings = data.current_borrowings.filter((b) => b.status !== 'returned');
  const dueSoonCount = activeBorrowings.filter(
    (b) => getDaysRemaining(b.due_date, referenceDate) <= 3
  ).length;
  const activeReservationsCount = data.reservations.filter(
    (r) => r.status === 'active' || r.status === 'ready_for_pickup'
  ).length;
  const unreadNotificationsCount = data.notifications.filter((n) => !n.is_read).length;

  return {
    currentlyBorrowedCount: activeBorrowings.length,
    dueSoonCount,
    readingHistoryCount: data.reading_history_count,
    activeReservationsCount,
    unreadNotificationsCount,
  };
}

export function getEligibleRecommendations(
  recommendations: BookRecommendation[],
  limit: number = 5
): BookRecommendation[] {
  return recommendations
    .filter((rec) => rec.book.available_copies > 0 && rec.book.availability !== 'Checked Out')
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, limit);
}

export function markNotificationAsRead(
  notifications: StudentNotification[],
  notificationId: number
): StudentNotification[] {
  return notifications.map((item) =>
    item.notification_id === notificationId ? { ...item, is_read: true } : item
  );
}

export function markAllNotificationsAsRead(
  notifications: StudentNotification[]
): StudentNotification[] {
  return notifications.map((item) => ({ ...item, is_read: true }));
}

function addDaysIso(baseDate: Date, offsetDays: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createSampleStudentDashboardData(
  referenceDate: Date = new Date()
): StudentDashboardPayload {
  const books: LibraryBookRecord[] = DEMO_BOOKS.map((demo, index) => ({
    book_id: index + 1,
    slug: demo.slug,
    title: demo.title,
    author: demo.author,
    category: demo.category,
    subject: demo.category,
    cover: demo.coverImage,
    availability: demo.status,
    available_copies: demo.availableCopies,
    total_copies: demo.totalCopies,
    rating_average: Number((4.5 + (index % 4) * 0.1).toFixed(1)),
    added_at: addDaysIso(referenceDate, -(index + 2)),
  }));

  const student: StudentProfile = {
    student_id: 1042,
    student_code: 'STU-2026-042',
    name: 'Ananya Verma',
    email: 'ananya.verma@university.edu',
    course_department: 'Computer Science & Engineering',
    academic_year: '3rd Year / Semester 5–6',
    avatar_url: STUDENT_AVATAR_IMAGE,
    interests: ['Python Programming', 'Artificial Intelligence', 'Data Science', 'Algorithms'],
    preferred_subjects: ['Computer Science', 'Python Programming', 'Artificial Intelligence'],
  };

  // Extra recommendation-eligible book reusing existing verified cover assets
  const mlBook: LibraryBookRecord = {
    book_id: 7,
    slug: 'interconnected-knowledge-systems-data-modern-education',
    title: 'Introduction to Machine Learning Systems',
    author: 'Dr. Eleanor Vance & Prof. Michael Chen',
    category: 'Machine Learning',
    subject: 'Artificial Intelligence',
    cover: DEMO_BOOKS[0].coverImage,
    availability: 'Available',
    available_copies: 2,
    total_copies: 4,
    rating_average: 4.9,
    added_at: addDaysIso(referenceDate, -1),
  };

  return {
    is_prototype_sample: true,
    student,
    recommendations: [
      {
        student_id: student.student_id,
        book_id: books[0].book_id,
        recommendation_score: 0.96,
        recommendation_reason:
          'Recommended because you enjoy Python and Artificial Intelligence.',
        book: books[0],
      },
      {
        student_id: student.student_id,
        book_id: books[1].book_id,
        recommendation_score: 0.92,
        recommendation_reason: "Similar to computer science books you've previously borrowed.",
        book: books[1],
      },
      {
        student_id: student.student_id,
        book_id: books[2].book_id,
        recommendation_score: 0.89,
        recommendation_reason: 'Matches your Data Science interest and coursework ratings.',
        book: books[2],
      },
      {
        student_id: student.student_id,
        book_id: books[3].book_id,
        recommendation_score: 0.85,
        recommendation_reason: 'Popular among students in Computer Science & Engineering.',
        book: books[3],
      },
      {
        student_id: student.student_id,
        book_id: books[5].book_id,
        recommendation_score: 0.78,
        recommendation_reason: 'Broadens interdisciplinary research alongside your core subjects.',
        book: books[5],
      },
    ],
    current_borrowings: [
      {
        transaction_id: 501,
        student_id: student.student_id,
        book_id: mlBook.book_id,
        issue_date: addDaysIso(referenceDate, -12),
        due_date: addDaysIso(referenceDate, 2),
        return_date: null,
        status: 'borrowed',
        progress_percent: 72,
        book: mlBook,
      },
      {
        transaction_id: 502,
        student_id: student.student_id,
        book_id: books[1].book_id,
        issue_date: addDaysIso(referenceDate, -6),
        due_date: addDaysIso(referenceDate, 8),
        return_date: null,
        status: 'borrowed',
        progress_percent: 45,
        book: books[1],
      },
      {
        transaction_id: 503,
        student_id: student.student_id,
        book_id: books[3].book_id,
        issue_date: addDaysIso(referenceDate, -3),
        due_date: addDaysIso(referenceDate, 11),
        return_date: null,
        status: 'borrowed',
        progress_percent: 20,
        book: books[3],
      },
    ],
    reading_history_count: 24,
    reservations: [
      {
        reservation_id: 301,
        student_id: student.student_id,
        book_id: books[4].book_id,
        reserved_at: addDaysIso(referenceDate, -2),
        status: 'ready_for_pickup',
        book: books[4],
      },
      {
        reservation_id: 302,
        student_id: student.student_id,
        book_id: books[2].book_id,
        reserved_at: addDaysIso(referenceDate, -1),
        status: 'active',
        book: books[2],
      },
    ],
    recent_books: [books[0], books[2], books[3], books[5]],
    notifications: [
      {
        notification_id: 901,
        student_id: student.student_id,
        type: 'due_reminder',
        message: 'Your book "Introduction to Machine Learning Systems" is due in 2 days.',
        created_at: addDaysIso(referenceDate, 0),
        relative_time: '2 hours ago',
        is_read: false,
      },
      {
        notification_id: 902,
        student_id: student.student_id,
        type: 'reservation_ready',
        message: 'Your reserved book "Understanding Mind" is now available for pickup.',
        created_at: addDaysIso(referenceDate, -1),
        relative_time: 'Yesterday',
        is_read: false,
      },
      {
        notification_id: 903,
        student_id: student.student_id,
        type: 'new_arrival',
        message: 'New books matching your Artificial Intelligence interest have been added.',
        created_at: addDaysIso(referenceDate, -2),
        relative_time: '2 days ago',
        is_read: true,
      },
      {
        notification_id: 904,
        student_id: student.student_id,
        type: 'rating_prompt',
        message: 'You can now rate your recently returned book "Algorithms & Data Structures".',
        created_at: addDaysIso(referenceDate, -4),
        relative_time: '4 days ago',
        is_read: true,
      },
    ],
    monthly_reading_activity: [
      { month: 'Jun', books_completed: 3, books_borrowed: 4 },
      { month: 'Jul', books_completed: 4, books_borrowed: 4 },
      { month: 'Aug', books_completed: 2, books_borrowed: 3 },
      { month: 'Sep', books_completed: 5, books_borrowed: 6 },
      { month: 'Oct', books_completed: 4, books_borrowed: 5 },
      { month: 'Nov', books_completed: 6, books_borrowed: 6 },
    ],
    favourite_subjects_breakdown: [
      { subject: 'Artificial Intelligence', count: 9 },
      { subject: 'Computer Science', count: 7 },
      { subject: 'Data Science', count: 5 },
      { subject: 'Software Engineering', count: 3 },
    ],
    recent_reviews: [
      {
        student_id: student.student_id,
        book_id: books[1].book_id,
        rating: 5,
        review: 'Clear explanation of tree and graph traversal algorithms.',
        created_at: addDaysIso(referenceDate, -10),
        updated_at: addDaysIso(referenceDate, -10),
      },
    ],
  };
}

export type StudentSectionRoute = Extract<
  AppRoute['name'],
  | 'student-dashboard'
  | 'student-search'
  | 'student-recommendations'
  | 'student-my-books'
  | 'student-history'
  | 'student-reservations'
  | 'student-notifications'
  | 'student-profile'
>;

export function isStudentSectionRoute(routeName: AppRoute['name']): routeName is StudentSectionRoute {
  return (
    routeName === 'student-dashboard' ||
    routeName === 'student-search' ||
    routeName === 'student-recommendations' ||
    routeName === 'student-my-books' ||
    routeName === 'student-history' ||
    routeName === 'student-reservations' ||
    routeName === 'student-notifications' ||
    routeName === 'student-profile'
  );
}

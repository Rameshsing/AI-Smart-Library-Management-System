import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Bookmark,
  BookOpen,
  History,
  Info,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch, clearClientSessionToken  } from '../../utils/clientSession';
import {
  computeDashboardSummary,
  createSampleStudentDashboardData,
  getEligibleRecommendations,
  getMostUrgentDueBook,
  getTimeGreeting,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type StudentDashboardPayload,
  type StudentSectionRoute,
} from '../../utils/studentDashboard';
import {
  CurrentBooksSection,
  DashboardSkeleton,
  NewInLibrarySection,
  NotificationsPreviewSection,
  QuickActionsSection,
  ReadingActivitySection,
  RecommendedForYouSection,
  ReturnReminderBanner,
  SummaryCardsRow,
} from './DashboardOverviewSections';
import { BrowseBooksPage } from './BrowseBooksPage';
import { BookDetailsPage } from './BookDetailsPage';
import { RecommendedForYouPage } from './RecommendedForYouPage';
import { ReadingHistoryPage } from './ReadingHistoryPage';
import { ReservationsPage } from './ReservationsPage';
import { NotificationsPage } from './NotificationsPage';
import { MyProfilePage } from './MyProfilePage';
import { MyBooksPage } from './MyBooksPage';
import { createReviewNotification } from '../../utils/readingHistory';
import {
  createReservationEventNotification,
  type ReservationNotificationEvent,
} from '../../utils/reservationsPage';
import { StudentShell } from './StudentShell';

interface StudentDashboardPageProps {
  activeRoute: StudentSectionRoute;
  bookIdentifier?: string;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

const SUB_ROUTE_META: Record<
  Exclude<StudentSectionRoute, 'student-dashboard'>,
  {
    title: string;
    subtitle: string;
    endpoint: string;
    description: string;
    icon: React.ReactNode;
  }
> = {
  'student-search': {
    title: 'Search Books',
    subtitle: 'Find books across subjects, authors, and real-time library availability.',
    endpoint: '/api/books?q=...',
    description:
      'Dedicated student book search and borrowing workspace connects to the library catalogue API.',
    icon: <Search className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-recommendations': {
    title: 'Recommended for You',
    subtitle: 'Personalised book picks ranked by your interests, history, and ratings.',
    endpoint: '/api/recommendations',
    description:
      'Full hybrid AI recommendation workspace powered by TF-IDF content similarity and collaborative filtering.',
    icon: <Sparkles className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-my-books': {
    title: 'My Books',
    subtitle: 'Track your active borrowings, due dates, and renewal requests.',
    endpoint: '/api/student/borrowings',
    description:
      'Manage active book loans, view exact due countdowns, and request loan renewals.',
    icon: <BookOpen className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-history': {
    title: 'Reading History',
    subtitle: 'Review completed books, returned dates, and personal ratings.',
    endpoint: '/api/student/reading-history',
    description:
      'Complete chronological record of returned books along with your submitted reviews.',
    icon: <History className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-reservations': {
    title: 'Reservations',
    subtitle: 'Monitor active holds and books ready for pickup at the library desk.',
    endpoint: '/api/student/reservations',
    description:
      'Manage queued book holds, pickup deadlines, and reservation cancellations.',
    icon: <Bookmark className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-notifications': {
    title: 'Notifications',
    subtitle: 'Stay updated on due reminders, pickup alerts, and new library arrivals.',
    endpoint: '/api/student/notifications',
    description:
      'Full student notification centre synced with borrowing transactions and catalogue arrivals.',
    icon: <Bell className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
  'student-profile': {
    title: 'My Profile',
    subtitle:
      'Manage your account information, academic details, and reading preferences to improve your library experience.',
    endpoint: '/api/student/profile',
    description:
      'Update your department, semester, reading interests, and preferred subjects used by the recommender.',
    icon: <User className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
  },
};

export function StudentDashboardPage({
  activeRoute,
  bookIdentifier,
  onNavigate,
}: StudentDashboardPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [data, setData] = useState<StudentDashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>('');
  const [liveUnreadCount, setLiveUnreadCount] = useState<number | null>(null);
  const onNavigateRef = React.useRef(onNavigate);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    let isMounted = true;
    const apiBaseUrl = getApiBaseUrl();

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage(null);

      if (isBackendConnected()) {
        try {
          const response = await apiFetch(`${apiBaseUrl}/api/student/dashboard`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              Accept: 'application/json',
            },
          });

          if (response.status === 401 || response.status === 403) {
            if (isMounted) {
              onNavigateRef.current({ name: 'login' });
            }
            return;
          }

          if (!response.ok) {
            throw new Error(`Unable to load student dashboard (${response.status}).`);
          }

          const payload = (await response.json()) as StudentDashboardPayload & {
            role?: string;
          };

          if (payload.role && payload.role !== 'student') {
            if (isMounted) {
              onNavigateRef.current({ name: 'login' });
            }
            return;
          }

          if (isMounted) {
            setData({ ...payload, is_prototype_sample: false });
            setIsLoading(false);
          }
          return;
        } catch (err) {
          if (isMounted) {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : 'Unable to reach the student dashboard service.'
            );
            setIsLoading(false);
          }
          return;
        }
      }

      // Prototype / development mode when VITE_API_BASE_URL is not configured
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (isMounted) {
        setData(createSampleStudentDashboardData(referenceDate));
        setIsLoading(false);
      }
    }

    void loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [referenceDate]);

  const handleMarkNotificationRead = (notificationId: number) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: markNotificationAsRead(prev.notifications, notificationId),
          }
        : prev
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: markAllNotificationsAsRead(prev.notifications),
          }
        : prev
    );
  };

  const handleQuickSearchSubmit = (query: string) => {
    setQuickSearchQuery(query.trim());
    onNavigate({ name: 'student-search' });
  };

  const handleHistoryFeedbackSubmitted = (bookTitle: string) => {
    const todayIso = referenceDate.toISOString().slice(0, 10);
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: createReviewNotification(
              prev.notifications,
              prev.student.student_id,
              bookTitle,
              todayIso
            ),
          }
        : prev
    );
  };

  const handleReservationEvent = (
    eventType: ReservationNotificationEvent,
    bookTitle: string
  ) => {
    const todayIso = referenceDate.toISOString().slice(0, 10);
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: createReservationEventNotification(
              prev.notifications,
              prev.student.student_id,
              eventType,
              bookTitle,
              todayIso
            ),
          }
        : prev
    );
  };

  const handleLogout = async () => {
    const apiBaseUrl = getApiBaseUrl();
    if (isBackendConnected()) {
      try {
        await apiFetch(`${apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Proceed to login even if logout endpoint is unreachable
      }
    }
    clearClientSessionToken();
    onNavigate({ name: 'login' });
  };

  const fallbackStudent = createSampleStudentDashboardData(referenceDate).student;
  const activeStudent = data?.student ?? fallbackStudent;
  const summary = data
    ? computeDashboardSummary(data, referenceDate)
    : {
        currentlyBorrowedCount: 0,
        dueSoonCount: 0,
        readingHistoryCount: 0,
        activeReservationsCount: 0,
        unreadNotificationsCount: 0,
      };

  const greetingTitle = bookIdentifier
    ? 'Book Details'
    : activeRoute === 'student-dashboard'
      ? `${getTimeGreeting(referenceDate.getHours())}, ${activeStudent.name} 👋`
      : SUB_ROUTE_META[activeRoute].title;

  const headerSubtitle = bookIdentifier
    ? 'Inspect book details, live copy availability, and student reviews.'
    : activeRoute === 'student-dashboard'
      ? 'Here’s what’s happening with your library activity.'
      : SUB_ROUTE_META[activeRoute].subtitle;

  const urgentDueBook = data
    ? getMostUrgentDueBook(data.current_borrowings, referenceDate)
    : null;
  const eligibleRecommendations = data
    ? getEligibleRecommendations(data.recommendations, 5)
    : [];

  return (
    <StudentShell
      activeRoute={activeRoute}
      student={activeStudent}
      greetingTitle={greetingTitle}
      subtitle={headerSubtitle}
      unreadNotificationsCount={
        activeRoute === 'student-notifications' && liveUnreadCount !== null
          ? liveUnreadCount
          : summary.unreadNotificationsCount
      }
      onNavigate={onNavigate}
      onLogout={handleLogout}
      onQuickSearchSubmit={handleQuickSearchSubmit}
    >
      {isLoading ? (
        <DashboardSkeleton />
      ) : errorMessage || !data ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-6 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                Dashboard data unavailable
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                {errorMessage ?? 'Unable to retrieve your library activity at the moment.'}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      ) : activeRoute === 'student-dashboard' ? (
        <div className="space-y-6">
          {data.is_prototype_sample && (
            <div
              role="note"
              className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-[#142B4A]">
                    Sample Student Preview:
                  </strong>{' '}
                  Showing development data for {data.student.name} ({data.student.student_code})
                  structured for the Flask + MySQL student dashboard API.
                </span>
              </div>
              <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
                GET /api/student/dashboard
              </span>
            </div>
          )}

          <SummaryCardsRow summary={summary} />

          {urgentDueBook && (
            <ReturnReminderBanner urgentBorrowing={urgentDueBook} onNavigate={onNavigate} />
          )}

          <RecommendedForYouSection
            recommendations={eligibleRecommendations}
            isPrototypeSample={data.is_prototype_sample}
            onNavigate={onNavigate}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CurrentBooksSection
                borrowings={data.current_borrowings}
                referenceDate={referenceDate}
                onNavigate={onNavigate}
              />
            </div>
            <div className="lg:col-span-5">
              <ReadingActivitySection
                monthlyActivity={data.monthly_reading_activity}
                favouriteSubjects={data.favourite_subjects_breakdown}
                totalCompleted={data.reading_history_count}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <QuickActionsSection onNavigate={onNavigate} />
            </div>
            <div className="lg:col-span-8">
              <NotificationsPreviewSection
                notifications={data.notifications}
                onMarkRead={handleMarkNotificationRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onNavigate={onNavigate}
              />
            </div>
          </div>

          <NewInLibrarySection books={data.recent_books} onNavigate={onNavigate} />
        </div>
      ) : bookIdentifier ? (
        <BookDetailsPage
          bookIdentifier={bookIdentifier}
          isStudentContext={true}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-search' ? (
        <BrowseBooksPage
          student={data.student}
          initialQuickSearch={quickSearchQuery}
          onConsumeQuickSearch={() => setQuickSearchQuery('')}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-recommendations' ? (
        <RecommendedForYouPage
          student={data.student}
          readingHistoryCount={data.reading_history_count}
          recentReviews={data.recent_reviews}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-history' ? (
        <ReadingHistoryPage
          student={data.student}
          onFeedbackSubmitted={handleHistoryFeedbackSubmitted}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-reservations' ? (
        <ReservationsPage
          student={data.student}
          onReservationEvent={handleReservationEvent}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-notifications' ? (
        <NotificationsPage
          student={data.student}
          onUnreadCountChange={(count) => setLiveUnreadCount(count)}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'student-profile' ? (
        <MyProfilePage student={data.student} onNavigate={onNavigate} />
      ) : activeRoute === 'student-my-books' ? (
        <MyBooksPage onNavigate={onNavigate} />
      ) : (
        <StudentSubRouteSection
          activeRoute={activeRoute}
          data={data}
          quickSearchQuery={quickSearchQuery}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onNavigate={onNavigate}
        />
      )}
    </StudentShell>
  );
}

interface StudentSubRouteSectionProps {
  activeRoute: Exclude<StudentSectionRoute, 'student-dashboard'>;
  data: StudentDashboardPayload;
  quickSearchQuery: string;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

function StudentSubRouteSection({
  activeRoute,
  data,
  quickSearchQuery,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: StudentSubRouteSectionProps) {
  const meta = SUB_ROUTE_META[activeRoute];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3.5">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F8FC]">
              {meta.icon}
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-[#142B4A]">
                {meta.title} Workspace
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-[#64748B]">{meta.description}</p>
              <p className="font-mono-tabular mt-2 text-xs text-[#64748B]">
                Planned API endpoint: <span className="text-[#142B4A]">{meta.endpoint}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-dashboard' })}
            className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {activeRoute === 'student-search' && quickSearchQuery && (
          <div className="mt-5 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-sm text-[#142B4A]">
            Showing search context for query:{' '}
            <strong className="font-semibold">&ldquo;{quickSearchQuery}&rdquo;</strong>
          </div>
        )}

        {activeRoute === 'student-profile' && (
          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div className="rounded-lg bg-[#F5F8FC] p-4">
              <p className="text-xs font-semibold text-[#64748B]">Academic Profile</p>
              <p className="mt-1 text-sm font-semibold text-[#142B4A]">{data.student.name}</p>
              <p className="text-xs text-[#64748B]">{data.student.email}</p>
              <p className="mt-2 text-xs text-[#1E293B]">
                {data.student.course_department} · {data.student.academic_year}
              </p>
            </div>
            <div className="rounded-lg bg-[#F5F8FC] p-4">
              <p className="text-xs font-semibold text-[#64748B]">
                Saved Interests &amp; Preferred Subjects
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#142B4A]">
                {data.student.interests.join(', ')}
              </p>
              <p className="mt-2 text-xs text-[#64748B]">
                Subjects: {data.student.preferred_subjects.join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {activeRoute === 'student-notifications' && (
        <NotificationsPreviewSection
          notifications={data.notifications}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
          onNavigate={onNavigate}
        />
      )}

      {activeRoute === 'student-my-books' && (
        <CurrentBooksSection
          borrowings={data.current_borrowings}
          referenceDate={new Date()}
          onNavigate={onNavigate}
        />
      )}

      {activeRoute === 'student-recommendations' && (
        <RecommendedForYouSection
          recommendations={getEligibleRecommendations(data.recommendations, 5)}
          isPrototypeSample={data.is_prototype_sample}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  History,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatDueRemainingLabel,
  getBorrowUrgency,
  getDaysRemaining,
  type BookRecommendation,
  type BorrowingTransaction,
  type ComputedDashboardSummary,
  type LibraryBookRecord,
  type MonthlyReadingPoint,
  type StudentNotification,
  type StudentSectionRoute,
} from '../../utils/studentDashboard';

export function DashboardSkeleton() {
  return (
    <div aria-label="Loading student dashboard" className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-12 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-72 rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-5 w-48 rounded bg-slate-200" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-48 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="h-64 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5" />
      </div>
    </div>
  );
}

interface SummaryCardsRowProps {
  summary: ComputedDashboardSummary;
}

export function SummaryCardsRow({ summary }: SummaryCardsRowProps) {
  const cards = [
    {
      id: 'currently-borrowed',
      label: 'Currently Borrowed',
      value: summary.currentlyBorrowedCount,
      context:
        summary.currentlyBorrowedCount === 1
          ? 'Book currently borrowed'
          : 'Books currently borrowed',
      icon: <BookOpen className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'due-soon',
      label: 'Due Soon',
      value: summary.dueSoonCount,
      context:
        summary.dueSoonCount === 1
          ? 'Book due within the next few days'
          : 'Books due within the next few days',
      icon: (
        <Clock
          className={`h-5 w-5 ${summary.dueSoonCount > 0 ? 'text-amber-600' : 'text-[#2563EB]'}`}
          aria-hidden="true"
        />
      ),
    },
    {
      id: 'reading-history',
      label: 'Reading History',
      value: summary.readingHistoryCount,
      context: summary.readingHistoryCount === 1 ? 'Book read' : 'Books read',
      icon: <History className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'reservations',
      label: 'Reservations',
      value: summary.activeReservationsCount,
      context:
        summary.activeReservationsCount === 1
          ? 'Active reservation'
          : 'Active reservations',
      icon: <Bookmark className="h-5 w-5 text-[#2563EB]" aria-hidden="true" />,
    },
  ];

  return (
    <section aria-label="Library activity overview">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-[#2563EB]/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[#64748B]">{card.label}</span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                {card.icon}
              </span>
            </div>
            <p className="font-mono-tabular mt-3 text-3xl font-bold tracking-tight text-[#142B4A]">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">{card.context}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface ReturnReminderBannerProps {
  urgentBorrowing: {
    borrowing: BorrowingTransaction;
    daysRemaining: number;
    urgency: 'normal' | 'due-soon' | 'overdue';
  };
  onNavigate: (route: AppRoute) => void;
}

export function ReturnReminderBanner({
  urgentBorrowing,
  onNavigate,
}: ReturnReminderBannerProps) {
  const { borrowing, daysRemaining, urgency } = urgentBorrowing;
  const isOverdue = urgency === 'overdue';

  return (
    <section
      aria-label="Return reminder"
      className={`rounded-xl border p-4 sm:p-5 ${
        isOverdue
          ? 'border-red-200 bg-red-50/70'
          : 'border-amber-200 bg-amber-50/70'
      }`}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-sm font-semibold text-[#142B4A]">
              Return Reminder
            </h2>
            <p className="mt-0.5 text-sm text-[#1E293B]">
              Your book &lsquo;{borrowing.book.title}&rsquo; is{' '}
              <strong className="font-semibold">
                {formatDueRemainingLabel(daysRemaining).toLowerCase()}
              </strong>{' '}
              (Due {borrowing.due_date}).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'book-detail', slug: borrowing.book.slug })}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            View Book
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-my-books' })}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A63] whitespace-nowrap cursor-pointer"
          >
            View My Books
          </button>
        </div>
      </div>
    </section>
  );
}

interface CoverThumbnailProps {
  src: string;
  alt: string;
  title: string;
}

function CoverThumbnail({ src, alt, title }: CoverThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-3 text-center text-white">
        <BookOpen className="h-6 w-6 text-[#DBEAFE]" aria-hidden="true" />
        <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className="h-full w-auto max-w-full rounded object-contain shadow-xs"
    />
  );
}

interface RecommendedForYouSectionProps {
  recommendations: BookRecommendation[];
  isPrototypeSample: boolean;
  onNavigate: (route: AppRoute) => void;
}

export function RecommendedForYouSection({
  recommendations,
  isPrototypeSample,
  onNavigate,
}: RecommendedForYouSectionProps) {
  return (
    <section aria-labelledby="recommended-heading" className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2563EB]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isPrototypeSample
                ? 'Sample Recommendation Preview · Ready for Hybrid Engine'
                : 'Hybrid AI Recommendations'}
            </span>
          </div>
          <h2
            id="recommended-heading"
            className="font-display mt-1 text-xl font-bold tracking-tight text-[#142B4A]"
          >
            Recommended for You
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Books selected based on your interests, reading history, ratings, and preferences.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate({ name: 'student-recommendations' })}
          className="inline-flex min-h-[40px] items-center gap-1.5 self-start text-sm font-semibold text-[#2563EB] hover:underline whitespace-nowrap shrink-0 sm:self-auto cursor-pointer"
        >
          <span>View All Recommendations</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] px-6 py-10 text-center">
          <Sparkles className="h-8 w-8 text-[#2563EB]" aria-hidden="true" />
          <p className="mt-3 max-w-md text-sm font-medium text-[#142B4A]">
            We&apos;re still learning your reading preferences. Explore some books and start building
            your reading history.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-search' })}
            className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Explore Books
          </button>
        </div>
      ) : (
        <div
          data-testid="recommended-books-row"
          className="mt-6 flex gap-4 overflow-x-auto pb-2 snap-x"
        >
          {recommendations.map((item) => (
            <article
              key={item.book_id}
              className="flex w-[250px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-150 hover:border-[#2563EB]/50 hover:shadow-sm sm:w-[260px]"
            >
              <div className="flex h-40 items-center justify-center border-b border-slate-100 bg-[#F5F8FC] p-3">
                <CoverThumbnail
                  src={item.book.cover}
                  alt={`Cover of ${item.book.title}`}
                  title={item.book.title}
                />
              </div>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="truncate font-medium text-[#2563EB]">
                    {item.book.category}
                  </span>
                  <span className="font-mono-tabular inline-flex shrink-0 items-center gap-1 font-semibold text-[#142B4A]">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                    {item.book.rating_average.toFixed(1)}
                  </span>
                </div>

                <h3 className="font-display mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-[#142B4A]">
                  {item.book.title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-[#64748B]">{item.book.author}</p>

                <p className="mt-2.5 line-clamp-2 rounded-lg bg-[#F5F8FC] px-2.5 py-2 text-xs leading-relaxed text-[#1E293B]">
                  {item.recommendation_reason}
                </p>

                <div className="mt-auto pt-3">
                  <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {item.book.availability} ({item.book.available_copies}{' '}
                      {item.book.available_copies === 1 ? 'copy' : 'copies'})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'book-detail', slug: item.book.slug })}
                    className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:bg-[#DBEAFE]/50 hover:text-[#2563EB] cursor-pointer"
                  >
                    <span>View Details</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

interface CurrentBooksSectionProps {
  borrowings: BorrowingTransaction[];
  referenceDate: Date;
  onNavigate: (route: AppRoute) => void;
}

export function CurrentBooksSection({
  borrowings,
  referenceDate,
  onNavigate,
}: CurrentBooksSectionProps) {
  return (
    <section
      aria-labelledby="current-books-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="current-books-heading" className="font-display text-lg font-bold text-[#142B4A]">
            Your Current Books
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Active loans, due countdowns, and reading progress.
          </p>
        </div>
        {borrowings.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-my-books' })}
            className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
          >
            Manage Loans
          </button>
        )}
      </div>

      {borrowings.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] px-6 py-10 text-center">
          <BookOpen className="h-8 w-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-[#142B4A]">
            You haven&apos;t borrowed any books yet.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Search the catalogue to borrow or reserve your next title.
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-search' })}
            className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Find a Book
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3.5">
          {borrowings.map((item) => {
            const daysRemaining = getDaysRemaining(item.due_date, referenceDate);
            const urgency = getBorrowUrgency(daysRemaining);
            const dueLabel = formatDueRemainingLabel(daysRemaining);

            const urgencyBadge =
              urgency === 'overdue'
                ? {
                    className: 'text-red-700',
                    icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
                  }
                : urgency === 'due-soon'
                  ? {
                      className: 'text-amber-700',
                      icon: <Clock className="h-3.5 w-3.5" aria-hidden="true" />,
                    }
                  : {
                      className: 'text-emerald-700',
                      icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />,
                    };

            return (
              <div
                key={item.transaction_id}
                className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5">
                  <CoverThumbnail
                    src={item.book.cover}
                    alt={`Cover of ${item.book.title}`}
                    title={item.book.title}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-sm font-semibold text-[#142B4A]">
                        {item.book.title}
                      </h3>
                      <p className="truncate text-xs text-[#64748B]">{item.book.author}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${urgencyBadge.className}`}
                    >
                      {urgencyBadge.icon}
                      <span>{dueLabel}</span>
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                    <span>
                      Issued: <span className="font-mono-tabular text-[#1E293B]">{item.issue_date}</span>
                    </span>
                    <span>
                      Due: <span className="font-mono-tabular text-[#1E293B]">{item.due_date}</span>
                    </span>
                    <span className="capitalize">Status: {item.status}</span>
                  </div>

                  {typeof item.progress_percent === 'number' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>Reading progress</span>
                        <span className="font-mono-tabular font-semibold text-[#142B4A]">
                          {item.progress_percent}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#2563EB]"
                          style={{ width: `${Math.min(100, Math.max(0, item.progress_percent))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ReadingActivitySectionProps {
  monthlyActivity: MonthlyReadingPoint[];
  favouriteSubjects: Array<{ subject: string; count: number }>;
  totalCompleted: number;
  onNavigate: (route: AppRoute) => void;
}

export function ReadingActivitySection({
  monthlyActivity,
  favouriteSubjects,
  totalCompleted,
  onNavigate,
}: ReadingActivitySectionProps) {
  const maxBooks = Math.max(
    1,
    ...monthlyActivity.map((point) => Math.max(point.books_completed, point.books_borrowed))
  );

  return (
    <section
      aria-labelledby="reading-activity-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="reading-activity-heading" className="font-display text-lg font-bold text-[#142B4A]">
            Your Reading Activity
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Books read and borrowed per month across your top subjects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'student-history' })}
          className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
        >
          View History
        </button>
      </div>

      {monthlyActivity.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center">
          <p className="text-sm font-medium text-[#142B4A]">
            Not enough reading history yet to display monthly trends.
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Complete your first borrowed book to start tracking monthly activity.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Lightweight Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#142B4A]">Books Read This Month &amp; Trend</span>
              <span className="font-mono-tabular text-[#64748B]">
                Total completed: <strong className="text-[#142B4A]">{totalCompleted}</strong>
              </span>
            </div>

            <div className="grid grid-cols-6 items-end gap-3 pt-2" role="img" aria-label="Monthly books read bar chart">
              {monthlyActivity.map((point) => {
                const heightPct = Math.round((point.books_completed / maxBooks) * 100);
                return (
                  <div key={point.month} className="flex flex-col items-center gap-1.5">
                    <span className="font-mono-tabular text-[11px] font-semibold text-[#142B4A]">
                      {point.books_completed}
                    </span>
                    <div className="flex h-24 w-full max-w-[36px] items-end rounded-md bg-slate-200/70 p-0.5">
                      <div
                        className="w-full rounded bg-[#2563EB] transition-all duration-300"
                        style={{ height: `${Math.max(12, heightPct)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#64748B]">{point.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Favourite Subjects */}
          {favouriteSubjects.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#142B4A]">Favourite Subjects</h3>
              <div className="mt-2.5 space-y-2">
                {favouriteSubjects.map((item) => (
                  <div key={item.subject} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[#1E293B]">{item.subject}</span>
                    <span className="font-mono-tabular font-medium text-[#64748B]">
                      {item.count} books
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

interface QuickActionsSectionProps {
  onNavigate: (route: AppRoute) => void;
}

export function QuickActionsSection({ onNavigate }: QuickActionsSectionProps) {
  const actions: Array<{
    label: string;
    route: StudentSectionRoute;
    icon: React.ReactNode;
  }> = [
    {
      label: 'Search Books',
      route: 'student-search',
      icon: <Search className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      label: 'Get Recommendations',
      route: 'student-recommendations',
      icon: <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      label: 'My Books',
      route: 'student-my-books',
      icon: <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      label: 'Reading History',
      route: 'student-history',
      icon: <History className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      label: 'My Interests',
      route: 'student-profile',
      icon: <Heart className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      label: 'Notifications',
      route: 'student-notifications',
      icon: <Bell className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
  ];

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <h2 id="quick-actions-heading" className="font-display text-lg font-bold text-[#142B4A]">
        Quick Actions
      </h2>
      <p className="mt-0.5 text-xs text-[#64748B]">
        Jump directly to your most used library tools.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onNavigate({ name: action.route })}
            className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-2.5 text-left text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:bg-[#DBEAFE]/50 hover:text-[#2563EB] cursor-pointer"
          >
            {action.icon}
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

interface NewInLibrarySectionProps {
  books: LibraryBookRecord[];
  onNavigate: (route: AppRoute) => void;
}

export function NewInLibrarySection({ books, onNavigate }: NewInLibrarySectionProps) {
  return (
    <section
      aria-labelledby="new-library-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 id="new-library-heading" className="font-display text-lg font-bold text-[#142B4A]">
            New in the Library
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Recently catalogued books available to explore or reserve.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate({ name: 'student-search' })}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-[#2563EB] hover:underline whitespace-nowrap sm:self-auto cursor-pointer"
        >
          <span>Browse All Books</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {books.map((book) => (
          <article
            key={book.book_id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-[#2563EB]/40"
          >
            <div className="flex h-36 items-center justify-center border-b border-slate-100 bg-[#F5F8FC] p-3">
              <CoverThumbnail
                src={book.cover}
                alt={`Cover of ${book.title}`}
                title={book.title}
              />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <span className="text-[11px] font-medium text-[#2563EB]">{book.category}</span>
              <h3 className="font-display mt-1 line-clamp-2 text-sm font-semibold text-[#142B4A]">
                {book.title}
              </h3>
              <p className="mt-0.5 truncate text-xs text-[#64748B]">{book.author}</p>

              <div className="mt-auto pt-3">
                <p className="mb-2.5 text-xs font-medium text-emerald-800">
                  {book.availability} ({book.available_copies}{' '}
                  {book.available_copies === 1 ? 'copy' : 'copies'})
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'book-detail', slug: book.slug })}
                  className="inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  View Details
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

interface NotificationsPreviewSectionProps {
  notifications: StudentNotification[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function NotificationsPreviewSection({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: NotificationsPreviewSectionProps) {
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getNotificationIcon = (type: StudentNotification['type']) => {
    switch (type) {
      case 'due_reminder':
        return <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />;
      case 'reservation_ready':
        return <Bookmark className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'new_arrival':
        return <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
      case 'rating_prompt':
        return <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />;
    }
  };

  return (
    <section
      aria-labelledby="notifications-preview-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            id="notifications-preview-heading"
            className="font-display text-lg font-bold text-[#142B4A]"
          >
            Recent Notifications
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Updates on loans, holds, and interest matches.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-[#F5F8FC] px-5 py-8 text-center">
          <Bell className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2.5 text-sm font-medium text-[#142B4A]">You&apos;re all caught up!</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {notifications.map((item) => (
            <li key={item.notification_id} className="py-3 first:pt-1 last:pb-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC]">
                    {getNotificationIcon(item.type)}
                  </span>
                  <div>
                    <p
                      className={`text-xs leading-relaxed ${
                        item.is_read ? 'text-[#64748B]' : 'font-semibold text-[#142B4A]'
                      }`}
                    >
                      {item.message}
                    </p>
                    <p className="mt-1 text-[11px] text-[#64748B]">
                      {item.relative_time}
                      {!item.is_read && ' · Unread'}
                    </p>
                  </div>
                </div>

                {!item.is_read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(item.notification_id)}
                    aria-label={`Mark notification as read: ${item.message}`}
                    className="shrink-0 text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => onNavigate({ name: 'student-notifications' })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
        >
          <span>View All Notifications</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

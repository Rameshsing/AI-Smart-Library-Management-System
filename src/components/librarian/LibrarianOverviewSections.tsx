import React, { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookOpen,
  BookPlus,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Library,
  RefreshCw,
  Repeat,
  RotateCcw,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatDueRemainingLabel,
  getBorrowUrgency,
  getDaysRemaining,
  type ExpectedReturnsPayload,
  type LibrarianBorrowingRecord,
  type LibrarianBorrowingStatus,
  type LibrarianPermissions,
  type LibrarianSectionRoute,
  type LibrarianSummaryPayload,
  type RecentBorrowingsPayload,
} from '../../utils/librarianDashboard';

export interface SectionState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function SectionErrorBox({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900 sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <p className="font-semibold text-red-900">{title}</p>
          <p className="mt-0.5 text-red-800">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Retry</span>
      </button>
    </div>
  );
}

interface LibrarianSummaryCardsProps {
  metrics: LibrarianSummaryPayload['metrics'];
  onNavigate: (route: AppRoute) => void;
}

export function LibrarianSummaryCards({
  metrics,
  onNavigate,
}: LibrarianSummaryCardsProps) {
  const deltas = metrics.previous_period_delta ?? null;

  const cards: Array<{
    id: string;
    label: string;
    value: number;
    description: string;
    delta: number | null | undefined;
    route: LibrarianSectionRoute;
    icon: React.ReactNode;
    accentTone?: string;
  }> = [
    {
      id: 'total-books',
      label: 'Total Books',
      value: metrics.total_books_unique_titles,
      description: 'Unique catalogue titles',
      delta: deltas?.total_books,
      route: 'librarian-inventory',
      icon: <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'total-copies',
      label: 'Total Book Copies',
      value: metrics.total_book_copies,
      description: 'Physical copies across titles',
      delta: deltas?.total_copies,
      route: 'librarian-inventory',
      icon: <Layers className="h-4 w-4 text-[#142B4A]" aria-hidden="true" />,
    },
    {
      id: 'available-copies',
      label: 'Available Copies',
      value: metrics.available_copies,
      description: 'Ready on shelf to borrow',
      delta: deltas?.available_copies,
      route: 'librarian-inventory',
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />,
    },
    {
      id: 'currently-issued',
      label: 'Currently Issued',
      value: metrics.currently_issued,
      description: 'Active borrowing transactions',
      delta: deltas?.currently_issued,
      route: 'librarian-issue-books',
      icon: <Repeat className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'pending-reservations',
      label: 'Pending Reservations',
      value: metrics.pending_reservations,
      description: 'Holds awaiting fulfilment',
      delta: deltas?.pending_reservations,
      route: 'librarian-reservations',
      icon: <Bookmark className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'overdue-books',
      label: 'Overdue Books',
      value: metrics.overdue_books,
      description: 'Overdue borrowing records',
      delta: deltas?.overdue_books,
      route: 'librarian-overdue',
      icon: (
        <AlertTriangle
          className={`h-4 w-4 ${metrics.overdue_books > 0 ? 'text-red-600' : 'text-slate-500'}`}
          aria-hidden="true"
        />
      ),
      accentTone: metrics.overdue_books > 0 ? 'text-red-700' : 'text-[#142B4A]',
    },
  ];

  return (
    <section aria-label="Library overview statistics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onNavigate({ name: card.route })}
            className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 text-left shadow-xs transition-colors hover:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#64748B] group-hover:text-[#142B4A]">
                {card.label}
              </span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                {card.icon}
              </span>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p
                className={`font-mono-tabular text-3xl font-bold tracking-tight ${
                  card.accentTone ?? 'text-[#142B4A]'
                }`}
              >
                {card.value}
              </p>
              {typeof card.delta === 'number' && card.delta !== 0 && (
                <span className="font-mono-tabular text-[11px] font-semibold text-[#64748B]">
                  {card.delta > 0 ? `+${card.delta}` : card.delta} vs prior period
                </span>
              )}
            </div>

            <div className="mt-2 flex w-full items-center justify-between gap-2 text-xs text-[#64748B]">
              <span>{card.description}</span>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#2563EB]"
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface LibrarianQuickActionsProps {
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}

export function LibrarianQuickActions({
  permissions,
  onNavigate,
}: LibrarianQuickActionsProps) {
  const actions: Array<{
    id: string;
    label: string;
    helper: string;
    route: LibrarianSectionRoute;
    icon: React.ReactNode;
    allowed: boolean;
  }> = [
    {
      id: 'issue-book',
      label: 'Issue a Book',
      helper: 'Checkout copy to student',
      route: 'librarian-issue-books',
      icon: <Repeat className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
      allowed: permissions.can_issue_books,
    },
    {
      id: 'return-book',
      label: 'Return a Book',
      helper: 'Process returned copy',
      route: 'librarian-return-books',
      icon: <RotateCcw className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
      allowed: permissions.can_return_books,
    },
    {
      id: 'add-book',
      label: 'Add New Book',
      helper: 'Register title & copies',
      route: 'librarian-add-book',
      icon: <BookPlus className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
      allowed: permissions.can_manage_inventory,
    },
    {
      id: 'manage-inventory',
      label: 'Manage Inventory',
      helper: 'Update catalogue stock',
      route: 'librarian-inventory',
      icon: <Library className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
      allowed: permissions.can_manage_inventory,
    },
    {
      id: 'manage-reservations',
      label: 'Manage Reservations',
      helper: 'Fulfil or clear holds',
      route: 'librarian-reservations',
      icon: <Bookmark className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
      allowed: permissions.can_manage_reservations,
    },
    {
      id: 'view-overdue',
      label: 'View Overdue Books',
      helper: 'Follow up late returns',
      route: 'librarian-overdue',
      icon: <AlertTriangle className="h-4 w-4 text-red-600" aria-hidden="true" />,
      allowed: true,
    },
  ];

  const visibleActions = actions.filter((a) => a.allowed);

  return (
    <section
      aria-labelledby="librarian-quick-actions-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2
            id="librarian-quick-actions-heading"
            className="font-display text-lg font-bold text-[#142B4A]"
          >
            Quick Actions
          </h2>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Direct access to daily library desk workflows permitted for your staff role.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {visibleActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onNavigate({ name: action.route })}
            className="flex flex-col items-start justify-between gap-2 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5 text-left transition-colors hover:border-[#2563EB] hover:bg-[#EFF6FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DBEAFE] bg-white">
              {action.icon}
            </span>
            <div>
              <span className="block text-xs font-bold text-[#142B4A]">{action.label}</span>
              <span className="mt-0.5 block text-[11px] text-[#64748B]">{action.helper}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function getBorrowingStatusBadge(status: LibrarianBorrowingStatus): {
  classes: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'Issued':
      return {
        classes: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#142B4A]',
        icon: <BookOpen className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />,
      };
    case 'Returned':
      return {
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" aria-hidden="true" />,
      };
    case 'Overdue':
      return {
        classes: 'border-red-200 bg-red-50 text-red-800',
        icon: <AlertTriangle className="h-3 w-3 text-red-600" aria-hidden="true" />,
      };
    case 'Renewal Pending':
      return {
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <Clock className="h-3 w-3 text-amber-700" aria-hidden="true" />,
      };
  }
}

interface RecentBorrowingAndReturnsProps {
  borrowingsSection: SectionState<RecentBorrowingsPayload>;
  expectedReturnsSection: SectionState<ExpectedReturnsPayload>;
  permissions: LibrarianPermissions;
  referenceDate: Date;
  onOpenTransactionDetails: (record: LibrarianBorrowingRecord) => void;
  onNavigate: (route: AppRoute) => void;
}

export function RecentBorrowingAndReturns({
  borrowingsSection,
  expectedReturnsSection,
  permissions,
  referenceDate,
  onOpenTransactionDetails,
  onNavigate,
}: RecentBorrowingAndReturnsProps) {
  return (
    <div className="space-y-6">
      {/* Recent Borrowing Activity (Full Width to prevent table clipping) */}
      <section
        aria-labelledby="recent-borrowing-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="recent-borrowing-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Recent Borrowing Activity
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Latest circulation checkouts, returns, and overdue flags.
            </p>
          </div>
          {permissions.can_issue_books && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-issue-books' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Issue / Manage Loans</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4">
          {borrowingsSection.isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-12 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : borrowingsSection.error ? (
            <SectionErrorBox
              title="Unable to load recent borrowing activity"
              message={borrowingsSection.error}
              onRetry={borrowingsSection.onRetry}
            />
          ) : !borrowingsSection.data || borrowingsSection.data.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center">
              <Repeat className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-2.5 font-display text-sm font-bold text-[#142B4A]">
                No recent borrowing activity
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                New borrowing transactions will appear here when students borrow books.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop / Tablet Table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                      <th scope="col" className="px-3 py-2.5">
                        Transaction ID
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Student
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Book Title
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Issue Date
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Due Date
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Status
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {borrowingsSection.data.items.map((txn) => {
                      const badge = getBorrowingStatusBadge(txn.status);
                      return (
                        <tr key={txn.borrowing_id} className="hover:bg-[#F5F8FC]/60">
                          <td className="font-mono-tabular px-3 py-3 font-semibold text-[#142B4A] whitespace-nowrap">
                            {txn.transaction_code}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <p className="font-semibold text-[#142B4A]">{txn.student_name}</p>
                            <p className="font-mono-tabular text-[11px] text-[#64748B]">
                              {txn.student_code}
                            </p>
                          </td>
                          <td className="max-w-[260px] px-3 py-3">
                            <p className="line-clamp-2 font-medium text-[#1E293B]">
                              {txn.book_title}
                            </p>
                          </td>
                          <td className="font-mono-tabular px-3 py-3 whitespace-nowrap text-[#64748B]">
                            {txn.issue_date}
                          </td>
                          <td className="font-mono-tabular px-3 py-3 whitespace-nowrap font-medium text-[#142B4A]">
                            {txn.due_date}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                            >
                              {badge.icon}
                              <span>{txn.status}</span>
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenTransactionDetails(txn)}
                                aria-label={`View details for ${txn.transaction_code}`}
                                className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                              >
                                <Eye className="h-3 w-3" aria-hidden="true" />
                                <span>Details</span>
                              </button>
                              {permissions.can_view_student_records && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate({ name: 'librarian-students' })}
                                  aria-label={`View student ${txn.student_name}`}
                                  className="inline-flex min-h-[32px] items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                                >
                                  Student
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate({ name: 'book-detail', slug: txn.book_slug })
                                }
                                aria-label={`View book ${txn.book_title}`}
                                className="inline-flex min-h-[32px] items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-[#64748B] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                              >
                                Book
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="space-y-3 md:hidden">
                {borrowingsSection.data.items.map((txn) => {
                  const badge = getBorrowingStatusBadge(txn.status);
                  return (
                    <div
                      key={txn.borrowing_id}
                      className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono-tabular font-bold text-[#142B4A]">
                          {txn.transaction_code}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                        >
                          {badge.icon}
                          <span>{txn.status}</span>
                        </span>
                      </div>
                      <p className="mt-2 font-semibold text-[#142B4A]">{txn.book_title}</p>
                      <p className="mt-1 text-[#64748B]">
                        {txn.student_name} ·{' '}
                        <span className="font-mono-tabular">{txn.student_code}</span>
                      </p>
                      <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                        Issued {txn.issue_date} · Due {txn.due_date}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenTransactionDetails(txn)}
                          className="min-h-[36px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate({ name: 'book-detail', slug: txn.book_slug })
                          }
                          className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#2563EB] cursor-pointer"
                        >
                          View Book
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Expected Returns Section */}
      <section
        aria-labelledby="expected-returns-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="expected-returns-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Expected Returns
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Upcoming and overdue loan deadlines.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'librarian-overdue' })}
            className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
          >
            View All
          </button>
        </div>

        <div className="mt-4 flex-1">
          {expectedReturnsSection.isLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 animate-pulse">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-24 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : expectedReturnsSection.error ? (
            <SectionErrorBox
              title="Unable to load expected returns"
              message={expectedReturnsSection.error}
              onRetry={expectedReturnsSection.onRetry}
            />
          ) : !expectedReturnsSection.data || expectedReturnsSection.data.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              No active borrowings due soon.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {expectedReturnsSection.data.items.slice(0, 4).map((item) => {
                const daysLeft = getDaysRemaining(item.due_date, referenceDate);
                const urgency = getBorrowUrgency(daysLeft);
                const remainingLabel = formatDueRemainingLabel(daysLeft);

                return (
                  <li
                    key={item.borrowing_id}
                    className={`flex flex-col justify-between rounded-xl border p-3.5 text-xs ${
                      urgency === 'overdue'
                        ? 'border-red-200 bg-red-50/60'
                        : urgency === 'due-soon'
                          ? 'border-amber-200 bg-amber-50/60'
                          : 'border-slate-200 bg-[#F5F8FC]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-bold text-[#142B4A]">{item.book_title}</p>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                            urgency === 'overdue'
                              ? 'bg-red-100 text-red-800'
                              : urgency === 'due-soon'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-white text-[#142B4A]'
                          }`}
                        >
                          {urgency === 'overdue' ? (
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Clock className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{remainingLabel}</span>
                        </span>
                      </div>
                      <p className="mt-1.5 text-[#64748B]">
                        {item.student_name} ·{' '}
                        <span className="font-mono-tabular">{item.student_code}</span>
                      </p>
                    </div>
                    <div className="font-mono-tabular mt-2.5 space-y-0.5 border-t border-slate-200/70 pt-2 text-[11px] text-[#64748B]">
                      <p className="whitespace-nowrap">Issued: {item.issue_date}</p>
                      <p className="whitespace-nowrap text-[#142B4A]">
                        Due: {item.due_date} · {item.status}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

interface TransactionDetailsModalProps {
  transaction: LibrarianBorrowingRecord | null;
  canViewStudentRecords: boolean;
  onClose: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function TransactionDetailsModal({
  transaction,
  canViewStudentRecords,
  onClose,
  onNavigate,
}: TransactionDetailsModalProps) {
  useEffect(() => {
    if (!transaction) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [transaction, onClose]);

  if (!transaction) return null;
  const badge = getBorrowingStatusBadge(transaction.status);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="librarian-txn-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
              {transaction.transaction_code}
            </p>
            <h2
              id="librarian-txn-modal-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Borrowing Transaction Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transaction details modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${badge.classes}`}
            >
              {badge.icon}
              <span>Status: {transaction.status}</span>
            </span>
            <span className="font-mono-tabular text-[#64748B]">
              Accession: <strong className="text-[#142B4A]">{transaction.accession_number}</strong>
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 space-y-2">
            <p className="text-[11px] font-semibold text-[#64748B]">Book &amp; Copy</p>
            <p className="text-sm font-bold text-[#142B4A]">{transaction.book_title}</p>
            <p className="text-[#64748B]">Location: {transaction.shelf_location}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-semibold text-[#64748B]">Borrower</p>
              <p className="mt-1 font-bold text-[#142B4A]">{transaction.student_name}</p>
              <p className="font-mono-tabular text-[#64748B]">{transaction.student_code}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-semibold text-[#64748B]">Circulation Dates</p>
              <p className="font-mono-tabular mt-1 text-[#1E293B]">
                Issued: {transaction.issue_date}
              </p>
              <p className="font-mono-tabular text-[#142B4A]">Due: {transaction.due_date}</p>
              {transaction.return_date && (
                <p className="font-mono-tabular text-emerald-700">
                  Returned: {transaction.return_date}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {canViewStudentRecords && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate({ name: 'librarian-students' });
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>View Student</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate({ name: 'book-detail', slug: transaction.book_slug });
              }}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Book</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

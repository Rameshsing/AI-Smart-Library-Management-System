import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import { formatDueRemainingLabel, getBorrowUrgency } from '../../utils/studentDashboard';

interface MyBookBorrowingItem {
  borrowing_id: number;
  transaction_code: string;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_author: string;
  book_cover: string;
  category: string;
  subject: string;
  accession_number: string;
  shelf_location: string;
  issue_date: string;
  due_date: string;
  days_remaining: number;
  status: 'Borrowed' | 'Due Today' | 'Overdue';
  renewals_used: number;
  max_renewals: number;
  can_renew: boolean;
  renewal_block_reason: string | null;
}

interface BorrowingsApiPayload {
  items: MyBookBorrowingItem[];
  policy: {
    default_loan_duration_days: number;
    max_active_loans_per_student: number;
    allow_renewal: boolean;
    max_renewals_per_loan: number;
    renewal_extension_days: number;
  };
}

interface MyBooksPageProps {
  onNavigate: (route: AppRoute) => void;
  onBorrowingUpdated?: () => void;
}

export const MyBooksPage: React.FC<MyBooksPageProps> = ({
  onNavigate,
  onBorrowingUpdated,
}) => {
  const [data, setData] = useState<BorrowingsApiPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadBorrowings = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/borrowings`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401 || response.status === 403) {
        onNavigate({ name: 'login' });
        return;
      }
      if (!response.ok) {
        throw new Error(`Unable to fetch active borrowings (${response.status}).`);
      }
      const payload = (await response.json()) as BorrowingsApiPayload;
      setData(payload);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to load your active borrowings.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [onNavigate]);

  useEffect(() => {
    void loadBorrowings();
  }, [loadBorrowings]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const handleRenew = async (item: MyBookBorrowingItem) => {
    if (renewingId !== null) return;
    setRenewingId(item.borrowing_id);
    setErrorMsg(null);

    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await apiFetch(
        `${apiBaseUrl}/api/student/borrowings/${item.borrowing_id}/renew`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        due_date?: string;
      };
      if (!response.ok) {
        throw new Error(body.message ?? `Unable to renew "${item.book_title}".`);
      }
      setToastMsg(
        body.message ?? `Loan renewed for "${item.book_title}". New due date: ${body.due_date}.`
      );
      await loadBorrowings();
      onBorrowingUpdated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to renew loan right now.');
    } finally {
      setRenewingId(null);
    }
  };

  const items = data?.items ?? [];
  const policy = data?.policy;

  return (
    <div className="space-y-6">
      {toastMsg && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Policy Summary Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Active Borrowings ({items.length}
              {policy ? ` / ${policy.max_active_loans_per_student} max` : ''})
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              {policy
                ? `Institutional policy: ${policy.default_loan_duration_days}-day loan period · ${
                    policy.allow_renewal
                      ? `Up to ${policy.max_renewals_per_loan} renewals (+${policy.renewal_extension_days} days each)`
                      : 'Renewals currently disabled'
                  }.`
                : 'View currently checked-out books, due dates, and online renewal eligibility.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-search' })}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] cursor-pointer"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Browse More Books</span>
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="font-display mt-4 text-base font-bold text-[#142B4A]">
            No active borrowed books
          </h3>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Explore the catalog or your personalized recommendations to borrow your next book.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-search' })}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Browse Catalog
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-recommendations' })}
              className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
            >
              View Recommendations
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const urgency = getBorrowUrgency(item.days_remaining);
            const badgeClass =
              urgency === 'overdue'
                ? 'border-red-200 bg-red-50 text-red-700'
                : urgency === 'due-soon'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]';

            return (
              <article
                key={item.borrowing_id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={item.book_cover}
                    alt={item.book_title}
                    className="h-24 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {formatDueRemainingLabel(item.days_remaining)}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-[#64748B]">
                        {item.transaction_code} · Copy {item.accession_number}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ name: 'book-detail', slug: item.book_slug })
                      }
                      className="mt-1.5 text-left font-display text-base font-bold text-[#142B4A] hover:text-[#2563EB] hover:underline cursor-pointer"
                    >
                      {item.book_title}
                    </button>
                    <p className="text-xs text-[#64748B]">
                      {item.book_author} · {item.category} · {item.shelf_location}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                        Issued: {item.issue_date}
                      </span>
                      <span className="font-semibold text-[#142B4A]">
                        Due Date: {item.due_date}
                      </span>
                      <span>
                        Renewals used: {item.renewals_used} / {item.max_renewals}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <button
                    type="button"
                    disabled={!item.can_renew || renewingId === item.borrowing_id}
                    onClick={() => void handleRenew(item)}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-white px-4 py-2 text-xs font-semibold text-[#2563EB] transition-colors hover:bg-[#F5F8FC] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        renewingId === item.borrowing_id ? 'animate-spin' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {renewingId === item.borrowing_id ? 'Renewing...' : 'Renew Loan'}
                    </span>
                  </button>
                  {!item.can_renew && item.renewal_block_reason && (
                    <span className="text-[11px] text-[#64748B]">
                      {item.renewal_block_reason}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

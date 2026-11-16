import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Barcode,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import {
  computeBorrowingLoanMetrics,
  createSampleCirculationStore,
  deriveCopyStatusAfterReturn,
  mapCirculationApiError,
  RETURN_CONDITION_OPTIONS,
  validateReturnSubmissionReadiness,
  type ActiveBorrowingDetail,
  type CirculationPolicy,
  type CirculationReservationRecord,
  type CirculationStudentRecord,
  type ReturnCopyCondition,
  type ReturnTransactionConfirmation,
} from '../../utils/librarianCirculation';
import {
  CirculationAuthorizationBlocked,
  CirculationBookCover,
  CirculationBorrowingModal,
  CirculationPageHeader,
  CirculationStatusBadge,
  CirculationStudentModal,
} from './CirculationSharedComponents';

interface ReturnBooksPageProps {
  permissions: LibrarianPermissions;
  prefillSearchQuery?: string;
  onNavigate: (route: AppRoute) => void;
}

type ReturnFilterStatus = 'all_active' | 'due_today' | 'overdue';

export function ReturnBooksPage({
  permissions,
  prefillSearchQuery,
  onNavigate,
}: ReturnBooksPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleCirculationStore());
  const [policy, setPolicy] = useState<CirculationPolicy>(sampleStoreRef.current.policy);
  const [reservations, setReservations] = useState<CirculationReservationRecord[]>(
    sampleStoreRef.current.reservations
  );

  // Search & active borrowings state
  const [searchQuery, setSearchQuery] = useState(prefillSearchQuery ?? '');

  useEffect(() => {
    if (typeof prefillSearchQuery === 'string' && prefillSearchQuery.trim()) {
      setSearchQuery(prefillSearchQuery);
      setSelectedBorrowing(null);
      setConfirmedReturn(null);
    }
  }, [prefillSearchQuery]);
  const [statusFilter, setStatusFilter] = useState<ReturnFilterStatus>('all_active');
  const [includeReturned, setIncludeReturned] = useState(false);

  const [borrowings, setBorrowings] = useState<ActiveBorrowingDetail[]>(
    sampleStoreRef.current.borrowings
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected borrowing inspection & return inspection state
  const [selectedBorrowing, setSelectedBorrowing] = useState<ActiveBorrowingDetail | null>(null);
  const [returnCondition, setReturnCondition] = useState<ReturnCopyCondition>('Good');
  const [conditionNotes, setConditionNotes] = useState('');
  const [sendDamagedToRepair, setSendDamagedToRepair] = useState(false);

  // Submission & confirmation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedReturn, setConfirmedReturn] = useState<ReturnTransactionConfirmation | null>(
    null
  );
  const submitLockRef = useRef(false);

  // Inspection modals
  const [inspectStudentModal, setInspectStudentModal] =
    useState<CirculationStudentRecord | null>(null);
  const [inspectBorrowingModal, setInspectBorrowingModal] =
    useState<ActiveBorrowingDetail | null>(null);

  // Fetch configured circulation policy when backend API is present
  useEffect(() => {
    if (!hasBackendApi) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/circulation/policy`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.ok && active) {
          const data = (await res.json()) as Partial<CirculationPolicy>;
          setPolicy((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // Keep safe policy defaults
      }
    })();
    return () => {
      active = false;
    };
  }, [apiBaseUrl, hasBackendApi]);

  const fetchBorrowings = useCallback(
    async (query: string, filter: ReturnFilterStatus, showReturned: boolean) => {
      setSearchError(null);
      const clean = query.trim();

      if (!hasBackendApi) {
        const lower = clean.toLowerCase();
        const filtered = sampleStoreRef.current.borrowings.filter((b) => {
          if (!showReturned && b.status === 'Returned') return false;
          const metrics = computeBorrowingLoanMetrics(
            b,
            sampleStoreRef.current.policy.server_reference_iso,
            sampleStoreRef.current.policy
          );
          if (filter === 'due_today' && metrics.displayStatus !== 'Due Today') return false;
          if (filter === 'overdue' && metrics.displayStatus !== 'Overdue') return false;

          if (!lower) return true;
          return (
            b.student_name.toLowerCase().includes(lower) ||
            b.student_code.toLowerCase().includes(lower) ||
            b.student_email.toLowerCase().includes(lower) ||
            b.book_title.toLowerCase().includes(lower) ||
            b.book_isbn.toLowerCase().includes(lower) ||
            b.accession_number.toLowerCase().includes(lower) ||
            b.transaction_code.toLowerCase().includes(lower) ||
            String(b.copy_id) === lower ||
            String(b.borrowing_id) === lower
          );
        });
        setBorrowings(filtered);
        return;
      }

      setIsSearching(true);
      try {
        const params = new URLSearchParams();
        if (clean) params.set('q', clean);
        params.set('status', filter);
        if (showReturned) params.set('include_returned', '1');

        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/borrowings/active?${params.toString()}`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          throw new Error(mapCirculationApiError(res.status));
        }
        const data = (await res.json()) as {
          items?: ActiveBorrowingDetail[];
          reservations?: CirculationReservationRecord[];
        };
        setBorrowings(data.items ?? []);
        if (Array.isArray(data.reservations)) {
          setReservations(data.reservations);
        }
      } catch (err) {
        setSearchError(
          err instanceof Error ? err.message : 'Unable to retrieve active borrowings.'
        );
      } finally {
        setIsSearching(false);
      }
    },
    [apiBaseUrl, hasBackendApi, onNavigate]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchBorrowings(searchQuery, statusFilter, includeReturned);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [fetchBorrowings, includeReturned, searchQuery, statusFilter]);

  const handleSelectBorrowing = async (borrowing: ActiveBorrowingDetail) => {
    setSelectedBorrowing(borrowing);
    setReturnCondition('Good');
    setConditionNotes('');
    setSendDamagedToRepair(false);
    setSubmitError(null);

    if (hasBackendApi) {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${borrowing.book_id}/reservations`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const data = (await res.json()) as { items?: CirculationReservationRecord[] };
          if (Array.isArray(data.items)) {
            setReservations((prev) => [
              ...prev.filter((r) => r.book_id !== borrowing.book_id),
              ...data.items!,
            ]);
          }
        }
      } catch {
        // Keep loaded reservations if endpoint unavailable
      }
    }
  };

  const selectedLoanMetrics = useMemo(() => {
    if (!selectedBorrowing) return null;
    return computeBorrowingLoanMetrics(selectedBorrowing, policy.server_reference_iso, policy);
  }, [policy, selectedBorrowing]);

  const selectedPostReturnOutcome = useMemo(() => {
    if (!selectedBorrowing) return null;
    return deriveCopyStatusAfterReturn({
      condition: returnCondition,
      sendDamagedToRepair,
      bookId: selectedBorrowing.book_id,
      activeReservations: reservations,
    });
  }, [reservations, returnCondition, selectedBorrowing, sendDamagedToRepair]);

  const handleConfirmReturn = async () => {
    if (submitLockRef.current || isSubmitting) return;
    setSubmitError(null);

    const validation = validateReturnSubmissionReadiness({
      borrowing: selectedBorrowing,
      condition: returnCondition,
      conditionNotes,
    });

    if (!validation.valid) {
      setSubmitError(validation.error ?? 'Return validation failed.');
      return;
    }

    if (!hasBackendApi) {
      setSubmitError(
        'Return inspection & post-return routing validated cleanly, but confirming a return requires VITE_API_BASE_URL to be configured so POST /api/librarian/returns can stamp the server return time, close the borrowing, update copy status/reservation holds, add to student Reading History, and notify affected students.'
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/returns`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          borrowing_id: selectedBorrowing!.borrowing_id,
          copy_id: selectedBorrowing!.copy_id,
          condition: returnCondition,
          condition_notes:
            returnCondition === 'Damaged' ? conditionNotes.trim() || null : null,
          send_damaged_to_repair: returnCondition === 'Damaged' ? sendDamagedToRepair : false,
        }),
      });

      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        throw new Error(
          mapCirculationApiError(response.status, errBody?.message ?? errBody?.error)
        );
      }

      const confirmed = (await response.json()) as Partial<ReturnTransactionConfirmation>;
      if (!confirmed.return_date || !confirmed.resulting_copy_status) {
        throw new Error(
          'Backend returned an incomplete return confirmation without return timestamp or copy status.'
        );
      }

      setConfirmedReturn({
        borrowing_id: confirmed.borrowing_id ?? selectedBorrowing!.borrowing_id,
        transaction_code: confirmed.transaction_code ?? selectedBorrowing!.transaction_code,
        student_id: confirmed.student_id ?? selectedBorrowing!.student_id,
        student_name: confirmed.student_name ?? selectedBorrowing!.student_name,
        student_code: confirmed.student_code ?? selectedBorrowing!.student_code,
        book_id: confirmed.book_id ?? selectedBorrowing!.book_id,
        book_title: confirmed.book_title ?? selectedBorrowing!.book_title,
        copy_id: confirmed.copy_id ?? selectedBorrowing!.copy_id,
        accession_number: confirmed.accession_number ?? selectedBorrowing!.accession_number,
        return_date: confirmed.return_date,
        returned_condition: confirmed.returned_condition ?? returnCondition,
        resulting_copy_status: confirmed.resulting_copy_status,
        days_overdue: confirmed.days_overdue ?? (selectedLoanMetrics?.daysOverdue ?? 0),
        fine_applied: Boolean(confirmed.fine_applied),
        fine_amount: confirmed.fine_amount ?? null,
        fine_currency_symbol: confirmed.fine_currency_symbol ?? policy.fine_currency_symbol,
        fine_status_label:
          confirmed.fine_status_label ??
          (selectedLoanMetrics?.fineSummaryLabel ?? 'No overdue penalty'),
        reservation_status_note: confirmed.reservation_status_note ?? null,
        held_for_student_name: confirmed.held_for_student_name ?? null,
        reading_history_updated: Boolean(confirmed.reading_history_updated ?? true),
        in_app_notification_created: Boolean(confirmed.in_app_notification_created),
        email_notification_sent: Boolean(confirmed.email_notification_sent),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to complete book return. Check server connection and retry.'
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleOpenStudentDetails = () => {
    const targetStudentId = confirmedReturn?.student_id ?? selectedBorrowing?.student_id;
    const match =
      sampleStoreRef.current.students.find((s) => s.student_id === targetStudentId) ?? null;
    if (match) {
      setInspectStudentModal(match);
    } else if (selectedBorrowing) {
      setInspectStudentModal({
        student_id: selectedBorrowing.student_id,
        student_code: selectedBorrowing.student_code,
        roll_number: selectedBorrowing.student_code,
        full_name: selectedBorrowing.student_name,
        email: selectedBorrowing.student_email,
        department: selectedBorrowing.student_department,
        program: 'Academic Program',
        account_status: selectedBorrowing.student_account_status,
        active_loans_count: 1,
        due_soon_count: 0,
        overdue_count: selectedLoanMetrics && selectedLoanMetrics.daysOverdue > 0 ? 1 : 0,
        max_borrowing_limit: 5,
        remaining_capacity: 4,
        active_book_ids: [selectedBorrowing.book_id],
        restriction_reason: null,
      });
    }
  };

  const handleProcessAnother = () => {
    setSelectedBorrowing(null);
    setReturnCondition('Good');
    setConditionNotes('');
    setSendDamagedToRepair(false);
    setSubmitError(null);
    setConfirmedReturn(null);
    void fetchBorrowings(searchQuery, statusFilter, includeReturned);
  };

  if (!permissions.can_return_books) {
    return (
      <CirculationAuthorizationBlocked
        title="Book Returns Restricted"
        message="Your staff role does not currently have permission to process book returns."
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6">
      <CirculationPageHeader
        title="Return Books"
        subtitle="Process returned books and update their physical availability."
        onNavigate={onNavigate}
      />

      {!hasBackendApi && !confirmedReturn && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#142B4A] shadow-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <p>
            Sample active borrowings and reservation queues are displayed for circulation workflow
            inspection while <span className="font-mono-tabular font-semibold">VITE_API_BASE_URL</span>{' '}
            is unconfigured. Authoritative returns commit strictly via{' '}
            <span className="font-mono-tabular font-semibold">POST /api/librarian/returns</span>.
          </p>
        </div>
      )}

      {confirmedReturn ? (
        <section
          aria-live="polite"
          className="mx-auto max-w-3xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs sm:p-8"
        >
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <h3 className="font-display mt-4 text-2xl font-bold text-[#142B4A]">
              Book Returned Successfully
            </h3>
            <p className="mt-1 text-sm text-[#64748B]">
              The borrowing record has been closed, copy status updated, and Reading History
              synchronized without auto-generating ratings.
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Student</dt>
              <dd className="mt-0.5 font-semibold text-[#142B4A]">
                {confirmedReturn.student_name} ({confirmedReturn.student_code})
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Book</dt>
              <dd className="mt-0.5 font-semibold text-[#142B4A]">
                {confirmedReturn.book_title}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Copy ID / Accession</dt>
              <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                #{confirmedReturn.copy_id} · {confirmedReturn.accession_number}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Return Date</dt>
              <dd className="font-mono-tabular mt-0.5 text-[#1E293B]">
                {formatLibrarianShortDate(confirmedReturn.return_date)}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Returned Condition / Copy Status</dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <CirculationStatusBadge status={confirmedReturn.returned_condition} />
                <span className="text-[#64748B]">→</span>
                <CirculationStatusBadge status={confirmedReturn.resulting_copy_status} />
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Fine / Overdue Status</dt>
              <dd className="mt-0.5 font-medium text-[#142B4A]">
                {confirmedReturn.fine_applied && typeof confirmedReturn.fine_amount === 'number'
                  ? `${confirmedReturn.fine_currency_symbol}${confirmedReturn.fine_amount} (${confirmedReturn.days_overdue} days overdue)`
                  : confirmedReturn.fine_status_label}
              </dd>
            </div>
            {confirmedReturn.reservation_status_note && (
              <div className="sm:col-span-2">
                <dt className="text-[#64748B]">Reservation Queue Update</dt>
                <dd className="mt-0.5 font-semibold text-[#2563EB]">
                  {confirmedReturn.reservation_status_note}
                </dd>
              </div>
            )}
          </dl>

          {confirmedReturn.in_app_notification_created && (
            <div className="mt-4 space-y-1 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs text-[#142B4A]">
              <p>
                <strong>Notification Sent:</strong> &ldquo;{confirmedReturn.book_title} has been
                successfully returned.&rdquo;
              </p>
              {confirmedReturn.held_for_student_name && (
                <p>
                  <strong>Reservation Hold Notice:</strong> Notified{' '}
                  {confirmedReturn.held_for_student_name} that their reserved copy is now ready for
                  pickup.
                </p>
              )}
              {confirmedReturn.email_notification_sent && (
                <p className="text-[#64748B]">Email notifications delivered by backend service.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleOpenStudentDetails}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              View Student
            </button>
            {selectedBorrowing && (
              <button
                type="button"
                onClick={() =>
                  setInspectBorrowingModal({
                    ...selectedBorrowing,
                    status: 'Returned',
                    return_date: confirmedReturn.return_date,
                    copy_status: confirmedReturn.resulting_copy_status,
                  })
                }
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
              >
                View Borrowing
              </button>
            )}
            <button
              type="button"
              onClick={handleProcessAnother}
              className="min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Process Another Return
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-dashboard' })}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </section>
      ) : !selectedBorrowing ? (
        /* STEP 1: FIND ACTIVE BORROWING */
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div>
            <h3 className="font-display text-lg font-bold text-[#142B4A]">
              Find Active Borrowing
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Search active loans by Student ID, Student Name, Email, Book Title, ISBN, Copy ID,
              Accession Number, or Borrowing / Transaction ID.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <label htmlFor="return-borrowing-search" className="sr-only">
                Search active borrowings
              </label>
              <Search
                className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="return-borrowing-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by STU-2026-042, Ananya Verma, ISBN, Accession Number, or TXN-2026-8401..."
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all_active', label: 'All Active' },
                  { id: 'due_today', label: 'Due Today' },
                  { id: 'overdue', label: 'Overdue' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    statusFilter === tab.id
                      ? 'border-[#142B4A] bg-[#142B4A] text-white'
                      : 'border-slate-300 bg-white text-[#1E293B] hover:border-[#2563EB]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <label className="ml-1 inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 text-xs font-medium text-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeReturned}
                  onChange={(e) => setIncludeReturned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Include Returned</span>
              </label>
            </div>
          </div>

          {searchError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{searchError}</span>
            </div>
          )}

          {isSearching ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : borrowings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-8 text-center text-xs text-[#64748B]">
              No active borrowing records matched your search criteria.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                      <th scope="col" className="px-3.5 py-2.5">
                        Student
                      </th>
                      <th scope="col" className="px-3.5 py-2.5">
                        Book
                      </th>
                      <th scope="col" className="px-3.5 py-2.5">
                        Copy
                      </th>
                      <th scope="col" className="px-3.5 py-2.5">
                        Issue Date
                      </th>
                      <th scope="col" className="px-3.5 py-2.5">
                        Due Date
                      </th>
                      <th scope="col" className="px-3.5 py-2.5">
                        Status
                      </th>
                      <th scope="col" className="px-3.5 py-2.5 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {borrowings.map((b) => {
                      const metrics = computeBorrowingLoanMetrics(
                        b,
                        policy.server_reference_iso,
                        policy
                      );
                      const displayLabel =
                        b.status === 'Returned' ? 'Returned' : metrics.displayStatus;
                      return (
                        <tr key={b.borrowing_id} className="hover:bg-[#F5F8FC]/60">
                          <td className="px-3.5 py-3">
                            <p className="font-semibold text-[#142B4A]">{b.student_name}</p>
                            <p className="font-mono-tabular text-[11px] text-[#64748B]">
                              {b.student_code}
                            </p>
                          </td>
                          <td className="max-w-[220px] px-3.5 py-3">
                            <p className="truncate font-semibold text-[#142B4A]">{b.book_title}</p>
                            <p className="font-mono-tabular text-[11px] text-[#64748B]">
                              {b.transaction_code}
                            </p>
                          </td>
                          <td className="font-mono-tabular px-3.5 py-3">
                            <p className="font-medium text-[#142B4A]">{b.accession_number}</p>
                            <p className="text-[11px] text-[#64748B]">Copy #{b.copy_id}</p>
                          </td>
                          <td className="font-mono-tabular px-3.5 py-3 text-[#64748B]">
                            {formatLibrarianShortDate(b.issue_date)}
                          </td>
                          <td className="font-mono-tabular px-3.5 py-3 font-medium text-[#142B4A]">
                            {formatLibrarianShortDate(b.due_date)}
                          </td>
                          <td className="px-3.5 py-3">
                            <CirculationStatusBadge status={displayLabel} />
                          </td>
                          <td className="px-3.5 py-3 text-right">
                            {b.status === 'Returned' ? (
                              <span className="text-[11px] font-medium text-[#64748B]">
                                Already Returned
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleSelectBorrowing(b)}
                                aria-label={`Select loan ${b.transaction_code} for ${b.student_name}`}
                                className="min-h-[34px] rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
                              >
                                Select Loan
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {borrowings.map((b) => {
                  const metrics = computeBorrowingLoanMetrics(
                    b,
                    policy.server_reference_iso,
                    policy
                  );
                  const displayLabel =
                    b.status === 'Returned' ? 'Returned' : metrics.displayStatus;
                  return (
                    <div
                      key={b.borrowing_id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-[#142B4A]">{b.book_title}</p>
                          <p className="mt-0.5 text-[#64748B]">
                            {b.student_name} ·{' '}
                            <span className="font-mono-tabular">{b.student_code}</span>
                          </p>
                        </div>
                        <CirculationStatusBadge status={displayLabel} />
                      </div>
                      <p className="font-mono-tabular mt-2 text-[11px] text-[#64748B]">
                        {b.accession_number} · Due {formatLibrarianShortDate(b.due_date)}
                      </p>
                      {b.status !== 'Returned' && (
                        <button
                          type="button"
                          onClick={() => void handleSelectBorrowing(b)}
                          aria-label={`Select loan ${b.transaction_code} for ${b.student_name}`}
                          className="mt-3 min-h-[38px] w-full rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                        >
                          Select Loan for Return
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      ) : (
        /* STEP 2: INSPECT LOAN, CONDITION, FINE POLICY & CONFIRM RETURN */
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                {selectedBorrowing.transaction_code}
              </p>
              <h3 className="font-display text-lg font-bold text-[#142B4A]">
                Inspect Loan & Process Return
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelectedBorrowing(null)}
              className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Find Different Loan</span>
            </button>
          </div>

          {/* 4 Detailed Inspection Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Student */}
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                  <UserCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <span>Student</span>
                </span>
                <CirculationStatusBadge status={selectedBorrowing.student_account_status} />
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Name</dt>
                  <dd className="font-semibold text-[#142B4A]">
                    {selectedBorrowing.student_name}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Student ID</dt>
                  <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                    {selectedBorrowing.student_code}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Department</dt>
                  <dd className="text-right text-[#1E293B]">
                    {selectedBorrowing.student_department}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Book */}
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
              <div className="flex items-center gap-1.5 border-b border-slate-200/80 pb-2 text-xs font-bold text-[#142B4A]">
                <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                <span>Book</span>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <CirculationBookCover
                  src={selectedBorrowing.book_cover}
                  title={selectedBorrowing.book_title}
                  size="sm"
                />
                <dl className="min-w-0 flex-1 space-y-1 text-xs">
                  <dd className="font-bold text-[#142B4A]">{selectedBorrowing.book_title}</dd>
                  <dd className="text-[#64748B]">{selectedBorrowing.book_author}</dd>
                  <dd className="font-mono-tabular text-[11px] text-[#142B4A]">
                    ISBN: {selectedBorrowing.book_isbn}
                  </dd>
                </dl>
              </div>
            </div>

            {/* Physical Copy */}
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                  <Barcode className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <span>Physical Copy</span>
                </span>
                <CirculationStatusBadge status={selectedBorrowing.copy_status} />
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Copy ID / Accession</dt>
                  <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                    #{selectedBorrowing.copy_id} · {selectedBorrowing.accession_number}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Shelf Location</dt>
                  <dd className="text-right text-[#1E293B]">
                    {selectedBorrowing.shelf_location}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#64748B]">Previous Condition</dt>
                  <dd className="text-[#1E293B]">{selectedBorrowing.copy_condition}</dd>
                </div>
              </dl>
            </div>

            {/* Loan Timeline & Fine Policy */}
            {selectedLoanMetrics && (
              <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                    <CalendarClock className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Loan & Overdue Check</span>
                  </span>
                  <CirculationStatusBadge status={selectedLoanMetrics.displayStatus} />
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Issue / Due Date</dt>
                    <dd className="font-mono-tabular text-[#142B4A]">
                      {formatLibrarianShortDate(selectedBorrowing.issue_date)} →{' '}
                      {formatLibrarianShortDate(selectedBorrowing.due_date)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Return Date (Server Time)</dt>
                    <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                      {formatLibrarianShortDate(policy.server_reference_iso)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Days Borrowed / Overdue</dt>
                    <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                      {selectedLoanMetrics.daysBorrowed} days borrowed ·{' '}
                      <span
                        className={
                          selectedLoanMetrics.daysOverdue > 0 ? 'text-red-700' : 'text-emerald-700'
                        }
                      >
                        {selectedLoanMetrics.daysOverdue} days overdue
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Fine Policy</dt>
                    <dd
                      className={`font-semibold ${
                        selectedLoanMetrics.daysOverdue > 0 ? 'text-red-700' : 'text-[#1E293B]'
                      }`}
                    >
                      {selectedLoanMetrics.fineSummaryLabel}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Book Condition on Return */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h4 className="font-display text-sm font-bold text-[#142B4A]">
              Book Condition on Return
            </h4>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Record physical inspection findings. Copy availability updates strictly according to
              condition and active reservation holds.
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {RETURN_CONDITION_OPTIONS.map((opt) => {
                const isSelected = returnCondition === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReturnCondition(opt.value)}
                    aria-pressed={isSelected}
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#2563EB] bg-[#F5F8FC] ring-2 ring-[#2563EB]/15'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold text-[#142B4A]">{opt.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{opt.helper}</p>
                  </button>
                );
              })}
            </div>

            {returnCondition === 'Damaged' && (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div>
                  <label
                    htmlFor="return-condition-notes"
                    className="mb-1.5 block text-xs font-semibold text-[#142B4A]"
                  >
                    Condition Notes <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="return-condition-notes"
                    rows={3}
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    placeholder='Describe physical damage (e.g. "Cover damaged", "Pages missing", "Water damage")...'
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#142B4A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendDamagedToRepair}
                    onChange={(e) => setSendDamagedToRepair(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                  />
                  <span>Route physical copy directly to Under Repair (instead of Damaged)</span>
                </label>
              </div>
            )}
          </div>

          {/* Post-Return Copy State & Reservation Queue Preview */}
          {selectedPostReturnOutcome && (
            <div
              role="status"
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
                selectedPostReturnOutcome.matchedWaitingReservation
                  ? 'border-[#DBEAFE] bg-[#F5F8FC] text-[#142B4A]'
                  : returnCondition === 'Damaged' || returnCondition === 'Lost'
                    ? 'border-amber-200 bg-amber-50 text-amber-950'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {selectedPostReturnOutcome.matchedWaitingReservation ? (
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
              )}
              <div>
                <p className="font-bold">
                  Resulting Physical Copy State: Issued →{' '}
                  {selectedPostReturnOutcome.nextCopyStatus}
                </p>
                <p className="mt-0.5">{selectedPostReturnOutcome.statusExplanation}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-2.5 text-xs text-[#64748B]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <p>
              Submitting executes{' '}
              <span className="font-mono-tabular font-semibold text-[#142B4A]">
                POST /api/librarian/returns
              </span>{' '}
              atomically with server return timestamp, updates Reading History (without auto-creating
              ratings), and promotes queued reservations only per backend policy.
            </p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setSelectedBorrowing(null)}
              disabled={isSubmitting}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmReturn()}
              disabled={isSubmitting}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Confirming Return...</span>
                </>
              ) : (
                <span>Confirm Return</span>
              )}
            </button>
          </div>
        </section>
      )}

      <CirculationStudentModal
        student={inspectStudentModal}
        onClose={() => setInspectStudentModal(null)}
      />
      <CirculationBorrowingModal
        borrowing={inspectBorrowingModal}
        onClose={() => setInspectBorrowingModal(null)}
      />
    </div>
  );
}

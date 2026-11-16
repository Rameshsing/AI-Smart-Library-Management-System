import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  formatStaffDateTime,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import {
  buildOverdueApiQueryParams,
  buildOverdueReminderPreview,
  classifyOverdueDurationBucket,
  computeOverdueSummary,
  createSampleOverdueStore,
  deriveOverdueStudentPolicyWarning,
  filterAndSortOverdueRecords,
  filterValidOverdueRecords,
  mapOverdueApiError,
  prepareBulkOverdueSelection,
  wasReminderSentRecently,
  type OverdueDurationBucketKey,
  type OverdueFilterCriteria,
  type OverdueFinePaymentStatus,
  type OverduePolicyCapabilities,
  type OverdueRecordItem,
  type OverdueSortOption,
} from '../../utils/librarianOverdue';
import {
  CirculationAuthorizationBlocked,
  CirculationBookCover,
  CirculationStatusBadge,
} from './CirculationSharedComponents';

interface OverdueBooksPageProps {
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}

const PAGE_SIZE = 6;

export function OverdueBooksPage({ permissions, onNavigate }: OverdueBooksPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleOverdueStore());
  const [policy, setPolicy] = useState<OverduePolicyCapabilities>(sampleStoreRef.current.policy);
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const [records, setRecords] = useState<OverdueRecordItem[]>(sampleStoreRef.current.records);
  const [totalCount, setTotalCount] = useState(sampleStoreRef.current.records.length);
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Filters & search
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [durationBucket, setDurationBucket] = useState<'All' | OverdueDurationBucketKey>('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [fineStatusFilter, setFineStatusFilter] = useState<'All' | OverdueFinePaymentStatus>(
    'All'
  );
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<OverdueSortOption>('most_overdue');

  // Selection for bulk reminders
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Detail modal & reminder confirmation dialogs
  const [inspectedRecord, setInspectedRecord] = useState<OverdueRecordItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [singleReminderTarget, setSingleReminderTarget] = useState<OverdueRecordItem | null>(null);
  const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const referenceNow = useMemo(
    () => new Date(policy.authoritative_date_iso || Date.now()),
    [policy.authoritative_date_iso]
  );

  // Debounced search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchInput);
      setPage(1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filterCriteria: OverdueFilterCriteria = useMemo(
    () => ({
      query: debouncedQuery,
      durationBucket,
      department: departmentFilter,
      category: categoryFilter,
      branch: branchFilter,
      fineStatus: fineStatusFilter,
      dateFrom,
      dateTo,
      sortBy,
    }),
    [
      branchFilter,
      categoryFilter,
      dateFrom,
      dateTo,
      debouncedQuery,
      departmentFilter,
      durationBucket,
      fineStatusFilter,
      sortBy,
    ]
  );

  const fetchOverdueRecords = useCallback(async () => {
    setLoadError(null);

    if (!hasBackendApi) {
      const result = filterAndSortOverdueRecords(
        sampleStoreRef.current.records,
        filterCriteria,
        policyRef.current,
        page,
        PAGE_SIZE
      );
      setRecords(sampleStoreRef.current.records);
      setTotalCount(result.totalCount);
      return;
    }

    setIsLoading(true);
    try {
      const params = buildOverdueApiQueryParams(filterCriteria, policyRef.current, page, PAGE_SIZE);
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/overdue?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );

      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(mapOverdueApiError(res.status, body?.message));
      }

      const data = (await res.json()) as {
        items?: OverdueRecordItem[];
        total_count?: number;
        policy?: Partial<OverduePolicyCapabilities>;
      };

      if (data.policy) {
        setPolicy((prev) => ({ ...prev, ...data.policy }));
      }
      const validItems = filterValidOverdueRecords(data.items ?? []);
      setRecords(validItems);
      setTotalCount(data.total_count ?? validItems.length);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load overdue records. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, filterCriteria, hasBackendApi, onNavigate, page]);

  useEffect(() => {
    void fetchOverdueRecords();
  }, [fetchOverdueRecords]);

  // Close top modal on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (singleReminderTarget) {
        setSingleReminderTarget(null);
        setReminderError(null);
      } else if (isBulkConfirmOpen) {
        setIsBulkConfirmOpen(false);
        setReminderError(null);
      } else if (inspectedRecord) {
        setInspectedRecord(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inspectedRecord, isBulkConfirmOpen, singleReminderTarget]);

  const summary = useMemo(
    () => computeOverdueSummary(records, policy.duration_buckets),
    [policy.duration_buckets, records]
  );

  const departments = useMemo(
    () => Array.from(new Set(records.map((r) => r.student_department))).sort(),
    [records]
  );
  const categories = useMemo(
    () => Array.from(new Set(records.map((r) => r.book_category))).sort(),
    [records]
  );
  const branches = useMemo(() => Array.from(new Set(records.map((r) => r.branch))).sort(), [records]);

  const paginatedView = useMemo(() => {
    if (hasBackendApi) {
      const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      return {
        items: records,
        totalCount,
        totalPages,
        currentPage: Math.min(page, totalPages),
      };
    }
    return filterAndSortOverdueRecords(records, filterCriteria, policy, page, PAGE_SIZE);
  }, [filterCriteria, hasBackendApi, page, policy, records, totalCount]);

  const hasActiveFilters = Boolean(
    debouncedQuery.trim() ||
      durationBucket !== 'All' ||
      departmentFilter !== 'All' ||
      categoryFilter !== 'All' ||
      branchFilter !== 'All' ||
      fineStatusFilter !== 'All' ||
      dateFrom ||
      dateTo
  );

  const handleClearFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setDurationBucket('All');
    setDepartmentFilter('All');
    setCategoryFilter('All');
    setBranchFilter('All');
    setFineStatusFilter('All');
    setDateFrom('');
    setDateTo('');
    setSortBy('most_overdue');
    setPage(1);
  };

  const handleOpenOverdueDetail = async (record: OverdueRecordItem) => {
    setInspectedRecord(record);
    if (!hasBackendApi) return;

    setIsLoadingDetail(true);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/overdue/${record.borrowing_id}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      if (res.ok) {
        const detail = (await res.json()) as OverdueRecordItem;
        setInspectedRecord(detail);
      }
    } catch {
      // Keep list record snapshot if detail endpoint fails transiently
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const toggleSelectRecord = (borrowingId: number) => {
    setSelectedIds((prev) =>
      prev.includes(borrowingId) ? prev.filter((id) => id !== borrowingId) : [...prev, borrowingId]
    );
  };

  const visibleIds = paginatedView.items.map((r) => r.borrowing_id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const bulkPrep = useMemo(
    () =>
      prepareBulkOverdueSelection(
        selectedIds,
        records,
        policy.reminder_cooldown_hours,
        referenceNow
      ),
    [policy.reminder_cooldown_hours, records, referenceNow, selectedIds]
  );

  const handleConfirmSingleReminder = async () => {
    if (!singleReminderTarget) return;
    setReminderError(null);

    if (!hasBackendApi) {
      setActionFeedback({
        type: 'info',
        message: `Overdue reminder prepared for ${singleReminderTarget.student_name} (${singleReminderTarget.student_code}). Connect VITE_API_BASE_URL to dispatch persistent in-app/email reminders via POST /api/librarian/overdue/${singleReminderTarget.borrowing_id}/remind.`,
      });
      setSingleReminderTarget(null);
      return;
    }

    setIsSendingReminder(true);
    try {
      const res = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/overdue/${singleReminderTarget.borrowing_id}/remind`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ include_email: policy.supports_email_notifications }),
        }
      );

      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        message?: string;
        channel?: string;
        sent_at?: string;
      } | null;

      if (!res.ok) {
        throw new Error(mapOverdueApiError(res.status, body?.message));
      }

      setActionFeedback({
        type: 'success',
        message:
          body?.message ||
          `Overdue reminder delivered to ${singleReminderTarget.student_name} (${body?.channel ?? 'In-App'}).`,
      });
      setSingleReminderTarget(null);
      await fetchOverdueRecords();
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : 'Unable to send overdue reminder.');
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleConfirmBulkReminders = async () => {
    setReminderError(null);

    if (bulkPrep.dedupedBorrowingIds.length === 0) {
      setReminderError(
        'Selected borrowings were recently reminded within the duplicate-prevention window.'
      );
      return;
    }

    if (!hasBackendApi) {
      setActionFeedback({
        type: 'info',
        message: `Prepared bulk reminder batch for ${bulkPrep.dedupedBorrowingIds.length} overdue loan(s) (${bulkPrep.skippedCooldownRecords.length} skipped due to ${policy.reminder_cooldown_hours}h duplicate guard). Connect VITE_API_BASE_URL to commit via POST /api/librarian/overdue/bulk-remind.`,
      });
      setIsBulkConfirmOpen(false);
      return;
    }

    setIsSendingReminder(true);
    try {
      const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/overdue/bulk-remind`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          borrowing_ids: bulkPrep.dedupedBorrowingIds,
          include_email: policy.supports_email_notifications,
        }),
      });

      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      const body = (await res.json().catch(() => null)) as {
        message?: string;
        succeeded_count?: number;
        failed_count?: number;
        skipped_duplicate_count?: number;
      } | null;

      if (!res.ok) {
        throw new Error(mapOverdueApiError(res.status, body?.message));
      }

      const sent = body?.succeeded_count ?? bulkPrep.dedupedBorrowingIds.length;
      const failed = body?.failed_count ?? 0;
      const skipped = body?.skipped_duplicate_count ?? bulkPrep.skippedCooldownRecords.length;

      setActionFeedback({
        type: failed > 0 ? 'info' : 'success',
        message: `Bulk overdue reminders processed: ${sent} delivered, ${failed} failed${skipped > 0 ? `, ${skipped} skipped (cooldown active)` : ''}.`,
      });
      setSelectedIds([]);
      setIsBulkConfirmOpen(false);
      await fetchOverdueRecords();
    } catch (err) {
      setReminderError(
        err instanceof Error ? err.message : 'Unable to send bulk overdue reminders.'
      );
    } finally {
      setIsSendingReminder(false);
    }
  };

  if (!permissions.can_view_student_records && !permissions.can_return_books) {
    return (
      <CirculationAuthorizationBlocked
        title="Overdue Books Access Restricted"
        message="Your librarian role does not include overdue circulation or student follow-up permissions."
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Overdue Books
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Monitor overdue loans and follow up on pending book returns.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchOverdueRecords()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'librarian-dashboard' })}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </section>

      {/* Transparent backend notice */}
      {!hasBackendApi && (
        <div
          role="status"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs text-[#142B4A] sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              Sample overdue loans synchronized with Circulation and Student Records are shown while{' '}
              <code className="font-mono-tabular font-semibold">VITE_API_BASE_URL</code> is
              unconfigured. Authoritative due-date checks, fines, and reminders run via{' '}
              <code className="font-mono-tabular font-semibold">
                GET / POST /api/librarian/overdue
              </code>
              .
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-semibold text-[#64748B]">
            Ref TZ: {policy.authoritative_timezone}
          </span>
        </div>
      )}

      {actionFeedback && (
        <div
          role={actionFeedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            actionFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : actionFeedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-[#DBEAFE] bg-white text-[#142B4A]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : actionFeedback.type === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            aria-label="Dismiss notice"
            className="text-slate-500 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <section
        aria-label="Overdue summary metrics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <button
          type="button"
          onClick={() => {
            setDurationBucket('All');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            durationBucket === 'All'
              ? 'border-[#2563EB] bg-white ring-2 ring-[#2563EB]/15'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-xs font-medium text-[#64748B]">Total Overdue Loans</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
            {summary.totalOverdueLoans}
          </p>
        </button>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-left">
          <p className="text-xs font-medium text-[#64748B]">Students With Overdue Books</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2563EB]">
            {summary.studentsWithOverdueBooks}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDurationBucket('1_7');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            durationBucket === '1_7'
              ? 'border-amber-400 bg-amber-50/70 ring-2 ring-amber-400/20'
              : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
          }`}
        >
          <p className="text-xs font-medium text-amber-900">Books Overdue by 1–7 Days</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-amber-800">
            {summary.overdue1To7Days}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDurationBucket('8_30');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            durationBucket === '8_30'
              ? 'border-red-400 bg-red-50/60 ring-2 ring-red-400/20'
              : 'border-red-200 bg-red-50/25 hover:border-red-300'
          }`}
        >
          <p className="text-xs font-medium text-red-900">Books Overdue by 8–30 Days</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-red-700">
            {summary.overdue8To30Days}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setDurationBucket('31_plus');
            setPage(1);
          }}
          className={`col-span-2 sm:col-span-1 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
            durationBucket === '31_plus'
              ? 'border-red-500 bg-red-50 ring-2 ring-red-500/20'
              : 'border-red-200 bg-red-50/50 hover:border-red-300'
          }`}
        >
          <p className="text-xs font-medium text-red-950">Books Overdue More Than 30 Days</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-red-800">
            {summary.overdueMoreThan30Days}
          </p>
        </button>
      </section>

      {/* Main Toolbar + Table Container */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        {/* Search + Sort Row */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search overdue loans"
              placeholder="Search by Student Name, Student ID, Book Title, ISBN, Copy ID, Accession, or Borrowing ID..."
              className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <label htmlFor="overdue-sort-select" className="sr-only">
                Sort overdue records
              </label>
              <select
                id="overdue-sort-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as OverdueSortOption);
                  setPage(1);
                }}
                className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] focus:border-[#2563EB] focus:outline-none"
              >
                <option value="most_overdue">Sort: Most overdue</option>
                <option value="least_overdue">Sort: Least overdue</option>
                <option value="due_date">Sort: Due date</option>
                <option value="student_name">Sort: Student name</option>
                <option value="book_title">Sort: Book title</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label
              htmlFor="overdue-duration-filter"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Overdue Duration
            </label>
            <select
              id="overdue-duration-filter"
              value={durationBucket}
              onChange={(e) => {
                setDurationBucket(e.target.value as 'All' | OverdueDurationBucketKey);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            >
              <option value="All">All Durations</option>
              {policy.duration_buckets.map((bucket) => (
                <option key={bucket.key} value={bucket.key}>
                  {bucket.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="overdue-dept-filter"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Department
            </label>
            <select
              id="overdue-dept-filter"
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="overdue-cat-filter"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Category
            </label>
            <select
              id="overdue-cat-filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="overdue-branch-filter"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Branch
            </label>
            <select
              id="overdue-branch-filter"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            >
              <option value="All">All Branches</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="overdue-date-from"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Due From Date
            </label>
            <input
              id="overdue-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            />
          </div>

          <div>
            <label
              htmlFor="overdue-date-to"
              className="mb-1 block text-[11px] font-semibold text-[#64748B]"
            >
              Due To Date
            </label>
            <input
              id="overdue-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B]"
            />
          </div>
        </div>

        {/* Fine Status Filter — shown ONLY if library fine policy is enabled */}
        {policy.fine_policy_enabled && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label
              htmlFor="overdue-fine-status"
              className="text-xs font-semibold text-[#64748B]"
            >
              Fine Status:
            </label>
            <select
              id="overdue-fine-status"
              value={fineStatusFilter}
              onChange={(e) => {
                setFineStatusFilter(e.target.value as 'All' | OverdueFinePaymentStatus);
                setPage(1);
              }}
              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B]"
            >
              <option value="All">All Fine States</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Waived">Waived</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        )}

        {/* Bulk Reminder Bar */}
        {policy.supports_bulk_reminders && selectedIds.length > 0 && (
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-[#2563EB]/30 bg-[#F5F8FC] px-4 py-3 text-xs sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 text-[#142B4A]">
              <Bell className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>
                <strong className="font-mono-tabular">{selectedIds.length}</strong> overdue{' '}
                {selectedIds.length === 1 ? 'record' : 'records'} selected
              </span>
              {bulkPrep.skippedCooldownRecords.length > 0 && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {bulkPrep.skippedCooldownRecords.length} within {policy.reminder_cooldown_hours}h
                  cooldown will be skipped
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-slate-400 cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={() => {
                  setReminderError(null);
                  setIsBulkConfirmOpen(true);
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Send Reminders to Selected Students</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading / Error / Empty / Data Table */}
        <div className="mt-5">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-6 text-center"
            >
              <AlertCircle className="mx-auto h-7 w-7 text-red-600" aria-hidden="true" />
              <p className="mt-2 font-display text-sm font-bold text-red-950">
                Unable to load overdue records
              </p>
              <p className="mt-1 text-xs text-red-800">{loadError}</p>
              <button
                type="button"
                onClick={() => void fetchOverdueRecords()}
                className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A5F] cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : paginatedView.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 font-display text-base font-bold text-[#142B4A]">
                {hasActiveFilters ? 'No results found' : 'No overdue books'}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                {hasActiveFilters
                  ? 'Try changing your filters or search terms.'
                  : 'All books have been returned on time or are still within their loan period.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 lg:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                      {policy.supports_bulk_reminders && (
                        <th scope="col" className="w-10 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            aria-label="Select all visible overdue loans"
                            className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                          />
                        </th>
                      )}
                      <th scope="col" className="px-4 py-3">
                        Student
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Book
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Issue Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Due Date
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Days Overdue
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Fine
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedView.items.map((item) => {
                      const bucket = classifyOverdueDurationBucket(
                        item.days_overdue,
                        policy.duration_buckets
                      );
                      const isChecked = selectedIds.includes(item.borrowing_id);
                      const recentlyReminded = wasReminderSentRecently(
                        item,
                        policy.reminder_cooldown_hours,
                        referenceNow
                      );

                      return (
                        <tr
                          key={item.borrowing_id}
                          className={`transition-colors hover:bg-[#F5F8FC]/70 ${
                            isChecked ? 'bg-[#F5F8FC]' : 'bg-white'
                          }`}
                        >
                          {policy.supports_bulk_reminders && (
                            <td className="px-3 py-3.5 align-top">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectRecord(item.borrowing_id)}
                                aria-label={`Select overdue loan ${item.transaction_code} for ${item.student_name}`}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2563EB]"
                              />
                            </td>
                          )}

                          <td className="px-4 py-3.5 align-top">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-[#142B4A]">{item.student_name}</span>
                              {item.student_account_status !== 'Active' && (
                                <CirculationStatusBadge status={item.student_account_status} />
                              )}
                            </div>
                            <p className="font-mono-tabular mt-0.5 text-[11px] text-[#64748B]">
                              {item.student_code} · {item.student_department}
                            </p>
                            {item.student_restriction_note && (
                              <p className="mt-1 text-[11px] font-medium text-amber-800">
                                {item.student_restriction_note}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <div className="flex items-start gap-2.5">
                              <CirculationBookCover
                                src={item.book_cover}
                                title={item.book_title}
                                size="sm"
                              />
                              <div className="min-w-0 max-w-[230px]">
                                <p className="line-clamp-1 font-bold text-[#142B4A]">
                                  {item.book_title}
                                </p>
                                <p className="line-clamp-1 text-[11px] text-[#64748B]">
                                  {item.book_author}
                                </p>
                                <p className="font-mono-tabular mt-0.5 text-[11px] text-[#64748B]">
                                  Copy #{item.copy_id} · {item.accession_number}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="font-mono-tabular px-4 py-3.5 align-top text-[#1E293B] whitespace-nowrap">
                            {formatLibrarianShortDate(item.issue_date)}
                          </td>

                          <td className="font-mono-tabular px-4 py-3.5 align-top whitespace-nowrap">
                            <p className="font-semibold text-red-700">
                              {formatLibrarianShortDate(item.due_date)}
                            </p>
                            {item.last_reminder_at && (
                              <p className="mt-0.5 text-[10px] text-[#64748B]">
                                Reminded {formatStaffDateTime(item.last_reminder_at)}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            <p className="font-mono-tabular text-sm font-bold text-red-700">
                              {item.days_overdue} {item.days_overdue === 1 ? 'day' : 'days'}
                            </p>
                            {bucket && (
                              <div className="mt-1">
                                <CirculationStatusBadge status={bucket.label} />
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top">
                            {policy.fine_policy_enabled && item.fine_amount !== null ? (
                              <div>
                                <p className="font-mono-tabular font-bold text-[#142B4A]">
                                  {item.fine_currency_symbol}
                                  {item.fine_amount.toFixed(2)}
                                </p>
                                {item.fine_payment_status && (
                                  <p className="text-[11px] text-[#64748B]">
                                    {item.fine_payment_status}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#64748B]">No fine policy</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 align-top text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleOpenOverdueDetail(item)}
                                className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                disabled={recentlyReminded}
                                onClick={() => {
                                  setReminderError(null);
                                  setSingleReminderTarget(item);
                                }}
                                title={
                                  recentlyReminded
                                    ? `Reminder sent within ${policy.reminder_cooldown_hours}h cooldown`
                                    : 'Send overdue reminder'
                                }
                                className="min-h-[34px] rounded-lg bg-[#2563EB] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                              >
                                {recentlyReminded ? 'Reminded' : 'Remind'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile & Tablet Cards */}
              <div className="space-y-3 lg:hidden">
                {paginatedView.items.map((item) => {
                  const bucket = classifyOverdueDurationBucket(
                    item.days_overdue,
                    policy.duration_buckets
                  );
                  const isChecked = selectedIds.includes(item.borrowing_id);
                  const recentlyReminded = wasReminderSentRecently(
                    item,
                    policy.reminder_cooldown_hours,
                    referenceNow
                  );

                  return (
                    <article
                      key={item.borrowing_id}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {policy.supports_bulk_reminders && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectRecord(item.borrowing_id)}
                              aria-label={`Select overdue loan ${item.transaction_code}`}
                              className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#2563EB]"
                            />
                          )}
                          <CirculationBookCover
                            src={item.book_cover}
                            title={item.book_title}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-[#142B4A]">{item.book_title}</p>
                            <p className="mt-0.5 text-[#64748B]">
                              {item.student_name} ·{' '}
                              <span className="font-mono-tabular">{item.student_code}</span>
                            </p>
                          </div>
                        </div>
                        {bucket && <CirculationStatusBadge status={bucket.label} />}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#F5F8FC] p-3 text-[11px]">
                        <div>
                          <span className="text-[#64748B]">Due Date:</span>{' '}
                          <strong className="font-mono-tabular text-red-700">
                            {formatLibrarianShortDate(item.due_date)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#64748B]">Overdue:</span>{' '}
                          <strong className="font-mono-tabular text-red-700">
                            {item.days_overdue} days
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#64748B]">Copy:</span>{' '}
                          <strong className="font-mono-tabular text-[#142B4A]">
                            #{item.copy_id} ({item.accession_number})
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#64748B]">Fine:</span>{' '}
                          <strong className="text-[#142B4A]">
                            {policy.fine_policy_enabled && item.fine_amount !== null
                              ? `${item.fine_currency_symbol}${item.fine_amount.toFixed(2)}`
                              : 'No fine policy'}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleOpenOverdueDetail(item)}
                          className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          disabled={recentlyReminded}
                          onClick={() => {
                            setReminderError(null);
                            setSingleReminderTarget(item);
                          }}
                          className="min-h-[38px] rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                        >
                          {recentlyReminded ? 'Recently Reminded' : 'Send Reminder'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#64748B] sm:flex-row">
                <p>
                  Showing{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {paginatedView.items.length}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-mono-tabular text-[#142B4A]">
                    {paginatedView.totalCount}
                  </strong>{' '}
                  overdue loans
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={paginatedView.currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    Page {paginatedView.currentPage} of {paginatedView.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={paginatedView.currentPage >= paginatedView.totalPages}
                    onClick={() => setPage((p) => Math.min(paginatedView.totalPages, p + 1))}
                    className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* OVERDUE DETAILS MODAL */}
      {inspectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="overdue-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
                  {inspectedRecord.transaction_code} · Borrowing #{inspectedRecord.borrowing_id}
                </p>
                <h3
                  id="overdue-detail-title"
                  className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
                >
                  Overdue Borrowing Details
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setInspectedRecord(null)}
                aria-label="Close overdue borrowing details"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-6 text-xs">
              {isLoadingDetail && (
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                  <span>Refreshing backend borrowing details...</span>
                </div>
              )}

              {/* Account Restriction / Policy Warning */}
              {(() => {
                const warning = deriveOverdueStudentPolicyWarning(
                  inspectedRecord,
                  policy.overdue_restriction_policy_note
                );
                return (
                  <div
                    role="status"
                    className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
                      warning.severity === 'blocked'
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-bold">{warning.title}</p>
                      <p className="mt-0.5">{warning.detail}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Student & Book Info */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-[#142B4A]">
                      Student Information
                    </h4>
                    <CirculationStatusBadge status={inspectedRecord.student_account_status} />
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Name</dt>
                      <dd className="font-semibold text-[#142B4A]">
                        {inspectedRecord.student_name}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Student ID</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {inspectedRecord.student_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Department</dt>
                      <dd className="text-right text-[#1E293B]">
                        {inspectedRecord.student_department}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Email</dt>
                      <dd className="text-right text-[#1E293B]">{inspectedRecord.student_email}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-[#142B4A]">
                      Book Information
                    </h4>
                    <span className="text-[11px] font-semibold text-[#64748B]">
                      {inspectedRecord.book_category}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <CirculationBookCover
                      src={inspectedRecord.book_cover}
                      title={inspectedRecord.book_title}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-[#142B4A]">{inspectedRecord.book_title}</p>
                      <p className="mt-0.5 text-[#64748B]">{inspectedRecord.book_author}</p>
                      <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                        ISBN: {inspectedRecord.book_isbn}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Physical Copy & Borrowing Information */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="font-display text-sm font-bold text-[#142B4A]">Physical Copy</h4>
                  <dl className="mt-3 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Copy ID</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        #{inspectedRecord.copy_id}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Accession Number</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {inspectedRecord.accession_number}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Location</dt>
                      <dd className="text-right text-[#1E293B]">{inspectedRecord.shelf_location}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Condition</dt>
                      <dd>
                        <CirculationStatusBadge status={inspectedRecord.copy_condition} />
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-display text-sm font-bold text-[#142B4A]">
                      Borrowing Information
                    </h4>
                    <CirculationStatusBadge status={inspectedRecord.borrowing_status} />
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Issue Date</dt>
                      <dd className="font-mono-tabular text-[#1E293B]">
                        {formatLibrarianShortDate(inspectedRecord.issue_date)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Due Date</dt>
                      <dd className="font-mono-tabular font-semibold text-red-700">
                        {formatLibrarianShortDate(inspectedRecord.due_date)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Days Overdue</dt>
                      <dd className="font-mono-tabular font-bold text-red-700">
                        {inspectedRecord.days_overdue} days
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Fine Information — strictly policy-gated */}
              <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                <h4 className="font-display text-sm font-bold text-[#142B4A]">Fine Information</h4>
                {policy.fine_policy_enabled && inspectedRecord.fine_amount !== null ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] text-[#64748B]">Fine Amount</p>
                      <p className="font-mono-tabular mt-0.5 font-bold text-[#142B4A]">
                        {inspectedRecord.fine_currency_symbol}
                        {inspectedRecord.fine_amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#64748B]">Calculation Basis</p>
                      <p className="mt-0.5 font-medium text-[#1E293B]">
                        {inspectedRecord.fine_calculation_basis ?? 'Library overdue schedule'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#64748B]">Payment Status</p>
                      <p className="mt-0.5 font-semibold text-[#142B4A]">
                        {inspectedRecord.fine_payment_status ?? 'Unpaid'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#64748B]">Outstanding Balance</p>
                      <p className="font-mono-tabular mt-0.5 font-bold text-red-700">
                        {inspectedRecord.fine_currency_symbol}
                        {(inspectedRecord.fine_outstanding_balance ?? inspectedRecord.fine_amount).toFixed(
                          2
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[#64748B]">
                    Fine assessments are not enabled under current library policy. Overdue tracking
                    is based on overdue duration ({inspectedRecord.days_overdue} days past due).
                  </p>
                )}
              </div>

              {/* Previous Reminder History */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-bold text-[#142B4A]">
                    Previous Reminder History
                  </h4>
                  <span className="font-mono-tabular text-[11px] text-[#64748B]">
                    {inspectedRecord.reminder_history.length} logged
                  </span>
                </div>
                {inspectedRecord.reminder_history.length === 0 ? (
                  <p className="mt-2 text-[#64748B]">
                    No automated or manual reminders sent for this borrowing yet.
                  </p>
                ) : (
                  <ul className="mt-2.5 divide-y divide-slate-100">
                    {inspectedRecord.reminder_history.map((rem) => (
                      <li
                        key={rem.reminder_id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <div>
                          <span className="font-semibold text-[#142B4A]">{rem.channel}</span> ·{' '}
                          <span className="text-[#64748B]">by {rem.sent_by}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tabular text-[#64748B]">
                            {formatStaffDateTime(rem.sent_at)}
                          </span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            {rem.status}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const stuId = inspectedRecord.student_id;
                      setInspectedRecord(null);
                      onNavigate({ name: 'librarian-students', prefillStudentId: stuId });
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>View Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const txn = inspectedRecord.transaction_code;
                      setInspectedRecord(null);
                      onNavigate({ name: 'librarian-return-books', prefillSearchQuery: txn });
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A5F] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Process Return</span>
                  </button>

                  <button
                    type="button"
                    disabled={wasReminderSentRecently(
                      inspectedRecord,
                      policy.reminder_cooldown_hours,
                      referenceNow
                    )}
                    onClick={() => {
                      setReminderError(null);
                      setSingleReminderTarget(inspectedRecord);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Send Reminder</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedRecord(null)}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE REMINDER CONFIRMATION MODAL */}
      {singleReminderTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-reminder-confirm-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="send-reminder-confirm-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Send an overdue reminder to this student?
            </h3>
            <p className="mt-1 text-xs text-[#64748B]">
              Delivery channels: In-App Notification
              {policy.supports_email_notifications ? ' + Library Email Service' : ' (Email service not configured)'}.
            </p>

            {(() => {
              const preview = buildOverdueReminderPreview(
                singleReminderTarget,
                policy.library_contact_info,
                formatLibrarianShortDate(singleReminderTarget.due_date)
              );
              return (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs text-[#1E293B]">
                  <p className="font-bold text-[#142B4A]">{preview.subject}</p>
                  {preview.bodyLines.map((line, i) => (
                    <p key={i} className="leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              );
            })()}

            {reminderError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {reminderError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                disabled={isSendingReminder}
                onClick={() => {
                  setSingleReminderTarget(null);
                  setReminderError(null);
                }}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingReminder}
                onClick={() => void handleConfirmSingleReminder()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
              >
                {isSendingReminder ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Confirm &amp; Send Reminder</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK REMINDER CONFIRMATION MODAL */}
      {isBulkConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-reminder-confirm-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="bulk-reminder-confirm-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Send reminders to {bulkPrep.dedupedBorrowingIds.length} selected overdue loan(s)?
            </h3>
            <p className="mt-1.5 text-xs text-[#64748B]">
              Duplicate notifications for the same student and borrowing within{' '}
              {policy.reminder_cooldown_hours} hours are automatically prevented by backend rules.
            </p>

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-[#F5F8FC] p-3 text-xs">
              {bulkPrep.eligibleRecords.length === 0 ? (
                <p className="text-amber-800">
                  All selected borrowings already received a reminder within the cooldown period.
                </p>
              ) : (
                bulkPrep.eligibleRecords.map((rec) => (
                  <div
                    key={rec.borrowing_id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                  >
                    <span className="font-semibold text-[#142B4A]">
                      {rec.student_name} ({rec.student_code})
                    </span>
                    <span className="font-mono-tabular text-red-700">{rec.days_overdue}d overdue</span>
                  </div>
                ))
              )}
              {bulkPrep.skippedCooldownRecords.length > 0 && (
                <p className="pt-1 text-[11px] font-medium text-amber-900">
                  Skipped (recently reminded):{' '}
                  {bulkPrep.skippedCooldownRecords.map((r) => r.student_name).join(', ')}
                </p>
              )}
            </div>

            {reminderError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-900"
              >
                {reminderError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                disabled={isSendingReminder}
                onClick={() => {
                  setIsBulkConfirmOpen(false);
                  setReminderError(null);
                }}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingReminder || bulkPrep.dedupedBorrowingIds.length === 0}
                onClick={() => void handleConfirmBulkReminders()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
              >
                {isSendingReminder ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Send Reminders</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

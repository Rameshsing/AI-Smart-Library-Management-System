import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  BookOpen,
  History,
  Info,
  Loader2,
  RefreshCw,
  Repeat,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  formatStaffDateTime,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import type { CirculationPolicy, CirculationStudentStatus } from '../../utils/librarianCirculation';
import type { LibrarianReservationItem } from '../../utils/librarianReservations';
import {
  buildStudentsApiQueryParams,
  computeStudentDirectorySummary,
  computeStudentLibraryStats,
  createSampleStudentRecordsStore,
  deriveStudentRestrictionBanner,
  filterAndPaginateStudents,
  mapStudentRecordApiError,
  sanitizeStudentRecordForLibrarian,
  type LibrarianStudentDirectoryItem,
  type StudentBorrowingHistoryItem,
  type StudentCurrentBorrowingItem,
  type StudentFilterCriteria,
  type StudentRatingContextSummary,
  type StudentRecordsSupportedCapabilities,
} from '../../utils/librarianStudents';
import {
  CirculationAuthorizationBlocked,
  CirculationBookCover,
  CirculationStatusBadge,
} from './CirculationSharedComponents';

interface StudentRecordsPageProps {
  permissions: LibrarianPermissions;
  prefillStudentId?: number;
  prefillSearchQuery?: string;
  onNavigate: (route: AppRoute) => void;
}

type ProfileModalTab = 'overview' | 'reservations' | 'history' | 'stats';

const PAGE_SIZE = 8;

export function StudentRecordsPage({
  permissions,
  prefillStudentId,
  prefillSearchQuery,
  onNavigate,
}: StudentRecordsPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleStudentRecordsStore());
  const [policy, setPolicy] = useState<CirculationPolicy>(sampleStoreRef.current.policy);
  const [capabilities, setCapabilities] = useState<StudentRecordsSupportedCapabilities>(
    sampleStoreRef.current.capabilities
  );
  const [allSampleStudents] = useState<LibrarianStudentDirectoryItem[]>(
    sampleStoreRef.current.students
  );

  const [rows, setRows] = useState<LibrarianStudentDirectoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState(() =>
    computeStudentDirectorySummary(sampleStoreRef.current.students)
  );

  const [queryInput, setQueryInput] = useState(prefillSearchQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(prefillSearchQuery ?? '');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'All' | CirculationStudentStatus>(
    'All'
  );
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [onlyActiveLoans, setOnlyActiveLoans] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [onlyWithReservations, setOnlyWithReservations] = useState(false);
  const [page, setPage] = useState(1);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Selected Student Detail Modal (lazy-loaded sections)
  const [selectedStudent, setSelectedStudent] = useState<LibrarianStudentDirectoryItem | null>(
    null
  );
  const [modalTab, setModalTab] = useState<ProfileModalTab>('overview');

  const [currentBorrowings, setCurrentBorrowings] = useState<StudentCurrentBorrowingItem[]>([]);
  const [isLoadingBorrowings, setIsLoadingBorrowings] = useState(false);
  const [borrowingsError, setBorrowingsError] = useState<string | null>(null);

  const [studentReservations, setStudentReservations] = useState<LibrarianReservationItem[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);

  const [borrowingHistory, setBorrowingHistory] = useState<StudentBorrowingHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [ratingContext, setRatingContext] = useState<StudentRatingContextSummary>({
    permitted: false,
    ratings_count: 0,
    average_rating_given: null,
    rated_books: [],
  });

  // Account status change confirmation dialog
  const [statusConfirmAction, setStatusConfirmAction] = useState<'Block' | 'Unblock' | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusActionBusy, setStatusActionBusy] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (prefillSearchQuery !== undefined) {
      setQueryInput(prefillSearchQuery);
      setDebouncedQuery(prefillSearchQuery);
      setPage(1);
    }
  }, [prefillSearchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryInput);
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const filterCriteria: StudentFilterCriteria = useMemo(
    () => ({
      query: debouncedQuery,
      accountStatus: accountStatusFilter,
      department: departmentFilter,
      course: courseFilter,
      academicYear: yearFilter,
      onlyActiveLoans,
      onlyOverdue,
      onlyWithReservations,
    }),
    [
      accountStatusFilter,
      courseFilter,
      debouncedQuery,
      departmentFilter,
      onlyActiveLoans,
      onlyOverdue,
      onlyWithReservations,
      yearFilter,
    ]
  );

  const filterOptions = useMemo(() => {
    const departments = Array.from(new Set(allSampleStudents.map((s) => s.department))).sort();
    const courses = Array.from(
      new Set(allSampleStudents.map((s) => s.program.split('·')[0].trim()))
    ).sort();
    const years = Array.from(new Set(allSampleStudents.map((s) => s.academic_year))).sort();
    return { departments, courses, years };
  }, [allSampleStudents]);

  const loadStudentsDirectory = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);

    if (!hasBackendApi) {
      await new Promise((r) => window.setTimeout(r, 90));
      const result = filterAndPaginateStudents(allSampleStudents, filterCriteria, page, PAGE_SIZE);
      setRows(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setSummary(computeStudentDirectorySummary(allSampleStudents));
      setIsLoadingList(false);
      return;
    }

    try {
      const qs = buildStudentsApiQueryParams(filterCriteria, page, PAGE_SIZE).toString();
      const response = await apiFetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/students?${qs}`,
        { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
      );
      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = (await response.json()) as { message?: string; error?: string };
          serverMsg = errJson.message ?? errJson.error;
        } catch {
          // ignore
        }
        throw new Error(mapStudentRecordApiError(response.status, serverMsg));
      }

      const payload = (await response.json()) as {
        items?: Array<Record<string, unknown>>;
        total_count?: number;
        total_pages?: number;
        summary?: {
          total_students?: number;
          active_students?: number;
          with_active_loans?: number;
          with_overdue_books?: number;
          with_reservations?: number;
        };
        policy?: Partial<CirculationPolicy>;
        capabilities?: Partial<StudentRecordsSupportedCapabilities>;
      };

      const sanitizedItems = (payload.items ?? []).map(
        (raw) => sanitizeStudentRecordForLibrarian(raw) as unknown as LibrarianStudentDirectoryItem
      );

      if (payload.policy) setPolicy((prev) => ({ ...prev, ...payload.policy }));
      if (payload.capabilities) {
        setCapabilities((prev) => ({
          ...prev,
          ...payload.capabilities,
          supported_filters: {
            ...prev.supported_filters,
            ...payload.capabilities?.supported_filters,
          },
        }));
      }

      setRows(sanitizedItems);
      setTotalCount(payload.total_count ?? sanitizedItems.length);
      setTotalPages(Math.max(1, payload.total_pages ?? 1));

      if (payload.summary) {
        const fallback = computeStudentDirectorySummary(sanitizedItems);
        setSummary({
          totalStudents: payload.summary.total_students ?? fallback.totalStudents,
          activeStudents: payload.summary.active_students ?? fallback.activeStudents,
          withActiveLoans: payload.summary.with_active_loans ?? fallback.withActiveLoans,
          withOverdueBooks: payload.summary.with_overdue_books ?? fallback.withOverdueBooks,
          withReservations: payload.summary.with_reservations ?? fallback.withReservations,
        });
      } else {
        setSummary(computeStudentDirectorySummary(sanitizedItems));
      }
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : 'Unable to load student records. Please try again.'
      );
    } finally {
      setIsLoadingList(false);
    }
  }, [allSampleStudents, apiBaseUrl, filterCriteria, hasBackendApi, onNavigate, page]);

  useEffect(() => {
    void loadStudentsDirectory();
  }, [loadStudentsDirectory]);

  const openStudentProfile = useCallback(
    async (student: LibrarianStudentDirectoryItem, initialTab: ProfileModalTab = 'overview') => {
      setSelectedStudent(student);
      setModalTab(initialTab);
      setStatusConfirmAction(null);
      setStatusReason('');
      setStatusFeedback(null);

      setBorrowingsError(null);
      setReservationsError(null);
      setHistoryError(null);

      if (!hasBackendApi) {
        const profile = sampleStoreRef.current.profilesById[student.student_id];
        setCurrentBorrowings(profile?.current_borrowings ?? []);
        setStudentReservations(profile?.reservations ?? []);
        setBorrowingHistory(profile?.borrowing_history ?? []);
        setRatingContext(
          profile?.rating_context ?? {
            permitted: false,
            ratings_count: 0,
            average_rating_given: null,
            rated_books: [],
          }
        );
        return;
      }

      setIsLoadingBorrowings(true);
      setIsLoadingReservations(true);
      setIsLoadingHistory(true);

      const base = apiBaseUrl.replace(/\/+$/, '');
      const fetchJson = async <T,>(url: string): Promise<T> => {
        const res = await apiFetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          throw new Error('Authentication required.');
        }
        if (!res.ok) {
          throw new Error(mapStudentRecordApiError(res.status));
        }
        return (await res.json()) as T;
      };

      const [profileRes, borrowingsRes, resRes, historyRes] = await Promise.allSettled([
        fetchJson<{
          student?: Record<string, unknown>;
          rating_context?: StudentRatingContextSummary;
        }>(`${base}/api/librarian/students/${student.student_id}`),
        fetchJson<{ items?: StudentCurrentBorrowingItem[] }>(
          `${base}/api/librarian/students/${student.student_id}/borrowings`
        ),
        fetchJson<{ items?: LibrarianReservationItem[] }>(
          `${base}/api/librarian/students/${student.student_id}/reservations`
        ),
        fetchJson<{ items?: StudentBorrowingHistoryItem[] }>(
          `${base}/api/librarian/students/${student.student_id}/history`
        ),
      ]);

      if (profileRes.status === 'fulfilled') {
        if (profileRes.value.student) {
          setSelectedStudent(
            sanitizeStudentRecordForLibrarian(
              profileRes.value.student
            ) as unknown as LibrarianStudentDirectoryItem
          );
        }
        if (profileRes.value.rating_context) {
          setRatingContext(profileRes.value.rating_context);
        }
      }

      if (borrowingsRes.status === 'fulfilled') {
        setCurrentBorrowings(borrowingsRes.value.items ?? []);
      } else {
        setBorrowingsError(
          borrowingsRes.reason instanceof Error
            ? borrowingsRes.reason.message
            : 'Unable to load current loans.'
        );
      }
      setIsLoadingBorrowings(false);

      if (resRes.status === 'fulfilled') {
        setStudentReservations(resRes.value.items ?? []);
      } else {
        setReservationsError(
          resRes.reason instanceof Error
            ? resRes.reason.message
            : 'Unable to load student reservations.'
        );
      }
      setIsLoadingReservations(false);

      if (historyRes.status === 'fulfilled') {
        setBorrowingHistory(historyRes.value.items ?? []);
      } else {
        setHistoryError(
          historyRes.reason instanceof Error
            ? historyRes.reason.message
            : 'Unable to load borrowing history.'
        );
      }
      setIsLoadingHistory(false);
    },
    [apiBaseUrl, hasBackendApi, onNavigate]
  );

  // Auto-open student record when navigated via prefillStudentId
  const autoOpenedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!prefillStudentId || autoOpenedRef.current === prefillStudentId) return;
    const match =
      rows.find((s) => s.student_id === prefillStudentId) ??
      allSampleStudents.find((s) => s.student_id === prefillStudentId);
    if (match) {
      autoOpenedRef.current = prefillStudentId;
      void openStudentProfile(match);
    }
  }, [allSampleStudents, openStudentProfile, prefillStudentId, rows]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (statusConfirmAction) {
          setStatusConfirmAction(null);
        } else if (selectedStudent) {
          setSelectedStudent(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedStudent, statusConfirmAction]);

  if (!permissions.can_view_student_records) {
    return (
      <CirculationAuthorizationBlocked
        title="Student Records Restricted"
        message="Your librarian account does not currently have permission to inspect student library records."
        onNavigate={onNavigate}
      />
    );
  }

  const overdueLoans = currentBorrowings.filter((b) => b.display_status === 'Overdue');
  const restrictionBanner = selectedStudent
    ? deriveStudentRestrictionBanner(selectedStudent)
    : null;
  const computedStats = selectedStudent
    ? computeStudentLibraryStats({
        student: selectedStudent,
        history: borrowingHistory,
      })
    : null;

  const handleConfirmAccountStatusChange = async () => {
    if (!selectedStudent || !statusConfirmAction) return;
    setStatusFeedback(null);
    const nextStatus: CirculationStudentStatus =
      statusConfirmAction === 'Block' ? 'Blocked' : 'Active';

    if (!hasBackendApi) {
      setStatusFeedback({
        type: 'error',
        message: `Changing student account status to ${nextStatus} requires VITE_API_BASE_URL to be configured so POST /api/librarian/students/${selectedStudent.student_id}/status can enforce librarian authorization, record an audit log entry, and update circulation restrictions.`,
      });
      return;
    }

    setStatusActionBusy(true);
    try {
      const response = await apiFetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/students/${selectedStudent.student_id}/status`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            account_status: nextStatus,
            reason: statusReason.trim() || null,
          }),
        }
      );
      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errJson = (await response.json()) as { message?: string; error?: string };
          serverMsg = errJson.message ?? errJson.error;
        } catch {
          // ignore
        }
        throw new Error(mapStudentRecordApiError(response.status, serverMsg));
      }

      const data = (await response.json()) as {
        student?: Record<string, unknown>;
        message?: string;
      };
      if (data.student) {
        setSelectedStudent(
          sanitizeStudentRecordForLibrarian(
            data.student
          ) as unknown as LibrarianStudentDirectoryItem
        );
      }
      setStatusConfirmAction(null);
      setStatusFeedback({
        type: 'success',
        message: data.message ?? `Student account status updated to ${nextStatus}.`,
      });
      void loadStudentsDirectory();
    } catch (err) {
      setStatusFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to update student account status.',
      });
    } finally {
      setStatusActionBusy(false);
    }
  };

  const resetFilters = () => {
    setQueryInput('');
    setDebouncedQuery('');
    setAccountStatusFilter('All');
    setDepartmentFilter('All');
    setCourseFilter('All');
    setYearFilter('All');
    setOnlyActiveLoans(false);
    setOnlyOverdue(false);
    setOnlyWithReservations(false);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Student Records
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Search students and view their library activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadStudentsDirectory()}
            disabled={isLoadingList}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingList ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'librarian-dashboard' })}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
        </div>
      </section>

      {!hasBackendApi && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#142B4A] shadow-xs"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <p>
            Sample student records synchronized with active loans, overdue items, reservations, and
            borrowing history are displayed while{' '}
            <span className="font-mono-tabular font-semibold">VITE_API_BASE_URL</span> is
            unconfigured. Live student queries and status updates execute via{' '}
            <span className="font-mono-tabular font-semibold">GET /api/librarian/students</span>.
          </p>
        </div>
      )}

      {/* 5 Summary Cards */}
      <section aria-label="Student library statistics summary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Total Students</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
              {summary.totalStudents}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Active Students</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-emerald-700">
              {summary.activeStudents}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium text-[#64748B]">Students With Active Loans</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2563EB]">
              {summary.withActiveLoans}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-xs">
            <p className="text-xs font-medium text-red-900">Students With Overdue Books</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-red-700">
              {summary.withOverdueBooks}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-1">
            <p className="text-xs font-medium text-[#64748B]">Students With Reservations</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
              {summary.withReservations}
            </p>
          </div>
        </div>
      </section>

      {/* Search, Filters & Student Directory */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="students-directory-search" className="sr-only">
              Search students by name, student ID, roll number, email, department, or course
            </label>
            <Search
              className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="students-directory-search"
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by Student Name, Student ID (e.g. STU-2026-042), Roll Number, Email, Department, or Course..."
              className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.supported_filters.account_status && (
              <div>
                <label
                  htmlFor="stu-filter-status"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Account Status
                </label>
                <select
                  id="stu-filter-status"
                  value={accountStatusFilter}
                  onChange={(e) => {
                    setAccountStatusFilter(e.target.value as 'All' | CirculationStudentStatus);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Account Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            )}

            {capabilities.supported_filters.department && (
              <div>
                <label
                  htmlFor="stu-filter-department"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Department
                </label>
                <select
                  id="stu-filter-department"
                  value={departmentFilter}
                  onChange={(e) => {
                    setDepartmentFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Departments</option>
                  {filterOptions.departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {capabilities.supported_filters.course && (
              <div>
                <label
                  htmlFor="stu-filter-course"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Course / Program
                </label>
                <select
                  id="stu-filter-course"
                  value={courseFilter}
                  onChange={(e) => {
                    setCourseFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Courses</option>
                  {filterOptions.courses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {capabilities.supported_filters.academic_year && (
              <div>
                <label
                  htmlFor="stu-filter-year"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Academic Year
                </label>
                <select
                  id="stu-filter-year"
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Years</option>
                  {filterOptions.years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {capabilities.supported_filters.activity_flags && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 font-medium text-[#142B4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyActiveLoans}
                  onChange={(e) => {
                    setOnlyActiveLoans(e.target.checked);
                    setPage(1);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Students with active loans</span>
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 font-medium text-[#142B4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyOverdue}
                  onChange={(e) => {
                    setOnlyOverdue(e.target.checked);
                    setPage(1);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Students with overdue books</span>
              </label>

              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-1.5 font-medium text-[#142B4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyWithReservations}
                  onChange={(e) => {
                    setOnlyWithReservations(e.target.checked);
                    setPage(1);
                  }}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2563EB]"
                />
                <span>Students with reservations</span>
              </label>
            </div>
          )}
        </div>

        {listError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/70 p-8 text-center"
          >
            <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-[#142B4A]">
              Unable to load student records
            </p>
            <p className="mt-1 text-xs text-red-800">{listError}</p>
            <button
              type="button"
              onClick={() => void loadStudentsDirectory()}
              className="mt-4 min-h-[38px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isLoadingList ? (
          <div className="space-y-2.5 animate-pulse" aria-label="Loading student records">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[#142B4A]">No students found</p>
            <p className="mt-1 text-xs text-[#64748B]">
              No student library records matched your search or filter criteria.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 min-h-[36px] rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="bg-[#F5F8FC] text-[#64748B]">
                  <tr>
                    <th className="px-3.5 py-3 font-semibold">Student</th>
                    <th className="px-3.5 py-3 font-semibold">Student ID</th>
                    <th className="px-3.5 py-3 font-semibold">Department</th>
                    <th className="px-3.5 py-3 font-semibold">Active Loans</th>
                    <th className="px-3.5 py-3 font-semibold">Overdue</th>
                    <th className="px-3.5 py-3 font-semibold">Reservations</th>
                    <th className="px-3.5 py-3 font-semibold">Account Status</th>
                    <th className="px-3.5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((student) => (
                    <tr key={student.student_id} className="hover:bg-[#F5F8FC]/60">
                      <td className="px-3.5 py-3">
                        <p className="font-semibold text-[#142B4A]">{student.full_name}</p>
                        <p className="truncate text-[11px] text-[#64748B]">{student.email}</p>
                      </td>
                      <td className="font-mono-tabular px-3.5 py-3 font-semibold text-[#142B4A]">
                        <p>{student.student_code}</p>
                        <p className="text-[11px] font-normal text-[#64748B]">
                          {student.roll_number}
                        </p>
                      </td>
                      <td className="max-w-[200px] px-3.5 py-3">
                        <p className="truncate font-medium text-[#1E293B]">{student.department}</p>
                        <p className="truncate text-[11px] text-[#64748B]">{student.program}</p>
                      </td>
                      <td className="font-mono-tabular px-3.5 py-3 font-semibold text-[#142B4A]">
                        {student.active_loans_count} / {student.max_borrowing_limit}
                      </td>
                      <td className="font-mono-tabular px-3.5 py-3">
                        <span
                          className={`font-bold ${
                            student.overdue_count > 0 ? 'text-red-700' : 'text-[#64748B]'
                          }`}
                        >
                          {student.overdue_count}
                        </span>
                      </td>
                      <td className="font-mono-tabular px-3.5 py-3 font-semibold text-[#142B4A]">
                        {student.active_reservations_count}
                      </td>
                      <td className="px-3.5 py-3">
                        <CirculationStatusBadge status={student.account_status} />
                      </td>
                      <td className="px-3.5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void openStudentProfile(student)}
                          aria-label={`View student record for ${student.full_name} (${student.student_code})`}
                          className="min-h-[34px] rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((student) => (
                <div
                  key={student.student_id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#142B4A]">{student.full_name}</p>
                      <p className="font-mono-tabular mt-0.5 text-[11px] text-[#64748B]">
                        {student.student_code} · {student.department}
                      </p>
                    </div>
                    <CirculationStatusBadge status={student.account_status} />
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-lg bg-[#F5F8FC] p-2 text-center">
                    <div>
                      <p className="text-[10px] text-[#64748B]">Loans</p>
                      <p className="font-mono-tabular font-bold text-[#142B4A]">
                        {student.active_loans_count} / {student.max_borrowing_limit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748B]">Overdue</p>
                      <p
                        className={`font-mono-tabular font-bold ${
                          student.overdue_count > 0 ? 'text-red-700' : 'text-[#142B4A]'
                        }`}
                      >
                        {student.overdue_count}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#64748B]">Reserved</p>
                      <p className="font-mono-tabular font-bold text-[#142B4A]">
                        {student.active_reservations_count}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void openStudentProfile(student)}
                    aria-label={`View student record for ${student.full_name} (${student.student_code})`}
                    className="mt-3 min-h-[38px] w-full rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    View Student Profile
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#64748B] sm:flex-row">
              <p>
                Showing <span className="font-semibold text-[#142B4A]">{rows.length}</span> of{' '}
                <span className="font-semibold text-[#142B4A]">{totalCount}</span> students
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono-tabular font-medium text-[#142B4A]">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Detailed Student Library Profile Modal */}
      {selectedStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-record-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4 backdrop-blur-[1px]"
        >
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    id="student-record-modal-title"
                    className="font-display truncate text-lg font-bold text-[#142B4A]"
                  >
                    {selectedStudent.full_name}
                  </h3>
                  <CirculationStatusBadge status={selectedStudent.account_status} />
                </div>
                <p className="font-mono-tabular mt-0.5 text-xs text-[#64748B]">
                  {selectedStudent.student_code} · Roll: {selectedStudent.roll_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                aria-label="Close student record dialog"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        name: 'librarian-issue-books',
                        prefillStudentId: selectedStudent.student_id,
                      })
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Issue Book</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        name: 'librarian-return-books',
                        prefillSearchQuery: selectedStudent.student_code,
                      })
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Return Book</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        name: 'librarian-reservations',
                        prefillSearchQuery: selectedStudent.student_code,
                      })
                    }
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>View Reservations</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTab('history')}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Borrowing History</span>
                  </button>
                </div>

                {capabilities.can_block_unblock && (
                  <button
                    type="button"
                    onClick={() =>
                      setStatusConfirmAction(
                        selectedStudent.account_status === 'Active' ? 'Block' : 'Unblock'
                      )
                    }
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      selectedStudent.account_status === 'Active'
                        ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                        : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {selectedStudent.account_status === 'Active'
                        ? 'Block Account'
                        : 'Unblock Account'}
                    </span>
                  </button>
                )}
              </div>

              {statusFeedback && (
                <div
                  role={statusFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`rounded-xl border px-4 py-3 text-xs font-medium ${
                    statusFeedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  {statusFeedback.message}
                </div>
              )}

              {/* Block / Unblock Account Confirmation Dialog */}
              {statusConfirmAction && (
                <div
                  role="alertdialog"
                  aria-labelledby="student-status-confirm-title"
                  className="space-y-3 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs"
                >
                  <p id="student-status-confirm-title" className="font-bold text-red-950">
                    {statusConfirmAction === 'Block'
                      ? 'Block this student account?'
                      : 'Unblock this student account?'}
                  </p>
                  <p className="text-red-900">
                    {statusConfirmAction === 'Block'
                      ? 'Blocking this student account will prevent new book borrowing and reservation actions until a librarian clears the restriction.'
                      : 'Restoring Active status re-enables standard borrowing and reservation eligibility checks.'}
                  </p>
                  <div>
                    <label
                      htmlFor="student-status-reason"
                      className="mb-1 block font-semibold text-red-950"
                    >
                      Audit Note / Policy Reason (Optional)
                    </label>
                    <input
                      id="student-status-reason"
                      type="text"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      placeholder="e.g. Pending clearance of overdue items"
                      className="min-h-[38px] w-full rounded-lg border border-red-200 bg-white px-3 text-xs text-[#1E293B] focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setStatusConfirmAction(null)}
                      className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-[#142B4A] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={statusActionBusy}
                      onClick={() => void handleConfirmAccountStatusChange()}
                      className="min-h-[36px] rounded-lg bg-red-600 px-4 py-1.5 font-semibold text-white hover:bg-red-700 cursor-pointer"
                    >
                      Confirm {statusConfirmAction} Account
                    </button>
                  </div>
                </div>
              )}

              {/* Account Restrictions Notice */}
              {restrictionBanner && (restrictionBanner.restricted || restrictionBanner.reason) && (
                <div
                  role={restrictionBanner.restricted ? 'alert' : 'status'}
                  className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
                    restrictionBanner.restricted
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-bold">{restrictionBanner.title}</p>
                    {restrictionBanner.reason && <p className="mt-0.5">{restrictionBanner.reason}</p>}
                  </div>
                </div>
              )}

              {/* Highlighted Overdue Books Section */}
              {overdueLoans.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    <span>Overdue Books Requiring Follow-Up ({overdueLoans.length})</span>
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {overdueLoans.map((loan) => (
                      <div
                        key={loan.borrowing_id}
                        className="flex flex-col justify-between gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-semibold text-[#142B4A]">{loan.book_title}</p>
                          <p className="font-mono-tabular text-[11px] text-[#64748B]">
                            Due: {formatLibrarianShortDate(loan.due_date)} · Copy{' '}
                            {loan.accession_number}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-tabular rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                            {loan.days_overdue} day{loan.days_overdue === 1 ? '' : 's'} overdue
                          </span>
                          <span className="text-[11px] font-medium text-red-800">
                            {loan.fine_label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Sub-Navigation Tabs */}
              <div
                role="tablist"
                aria-label="Student record sections"
                className="flex flex-wrap gap-2 border-b border-slate-100 pb-3"
              >
                {(
                  [
                    { id: 'overview', label: 'Profile & Current Loans' },
                    { id: 'reservations', label: `Reservations (${studentReservations.length})` },
                    { id: 'history', label: `Borrowing History (${borrowingHistory.length})` },
                    { id: 'stats', label: 'Library Statistics' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={modalTab === t.id}
                    onClick={() => setModalTab(t.id)}
                    className={`min-h-[34px] rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      modalTab === t.id
                        ? 'border-[#142B4A] bg-[#142B4A] text-white'
                        : 'border-slate-300 bg-white text-[#1E293B] hover:border-[#2563EB]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: Profile & Current Loans */}
              {modalTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 text-xs">
                      <p className="font-bold text-[#142B4A]">Personal Information</p>
                      <dl className="mt-2.5 space-y-1.5">
                        <div>
                          <dt className="text-[#64748B]">Email</dt>
                          <dd className="font-medium text-[#1E293B]">{selectedStudent.email}</dd>
                        </div>
                        {selectedStudent.mobile && (
                          <div>
                            <dt className="text-[#64748B]">Mobile</dt>
                            <dd className="font-mono-tabular font-medium text-[#1E293B]">
                              {selectedStudent.mobile}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-[#64748B]">Institution</dt>
                          <dd className="font-medium text-[#1E293B]">
                            {selectedStudent.institution}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 text-xs">
                      <p className="font-bold text-[#142B4A]">Academic Information</p>
                      <dl className="mt-2.5 space-y-1.5">
                        <div>
                          <dt className="text-[#64748B]">Course / Program</dt>
                          <dd className="font-medium text-[#1E293B]">{selectedStudent.program}</dd>
                        </div>
                        <div>
                          <dt className="text-[#64748B]">Department</dt>
                          <dd className="font-medium text-[#1E293B]">
                            {selectedStudent.department}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[#64748B]">Year & Semester</dt>
                          <dd className="font-medium text-[#1E293B]">
                            {selectedStudent.academic_year} · {selectedStudent.semester}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 text-xs">
                      <p className="font-bold text-[#142B4A]">Library Account</p>
                      <dl className="mt-2.5 space-y-1.5">
                        <div className="flex justify-between">
                          <dt className="text-[#64748B]">Current Loans</dt>
                          <dd className="font-mono-tabular font-bold text-[#142B4A]">
                            {selectedStudent.active_loans_count} /{' '}
                            {selectedStudent.max_borrowing_limit}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[#64748B]">Overdue Count</dt>
                          <dd
                            className={`font-mono-tabular font-bold ${
                              selectedStudent.overdue_count > 0
                                ? 'text-red-700'
                                : 'text-[#142B4A]'
                            }`}
                          >
                            {selectedStudent.overdue_count}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[#64748B]">Active Reservations</dt>
                          <dd className="font-mono-tabular font-bold text-[#142B4A]">
                            {selectedStudent.active_reservations_count}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-[#64748B]">Total Books Borrowed</dt>
                          <dd className="font-mono-tabular font-bold text-[#142B4A]">
                            {selectedStudent.total_books_borrowed}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Current Borrowed Books */}
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#142B4A]">
                      Current Borrowed Books
                    </h4>
                    {isLoadingBorrowings ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                        <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                        <span>Loading active borrowings...</span>
                      </div>
                    ) : borrowingsError ? (
                      <div
                        role="alert"
                        className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                      >
                        {borrowingsError}
                      </div>
                    ) : currentBorrowings.length === 0 ? (
                      <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC] p-4 text-xs text-[#64748B]">
                        This student has no active loans.
                      </p>
                    ) : (
                      <div className="mt-2.5 space-y-2.5">
                        {currentBorrowings.map((loan) => (
                          <div
                            key={loan.borrowing_id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs sm:flex-row sm:items-center"
                          >
                            <div className="flex items-start gap-3">
                              <CirculationBookCover
                                src={loan.book_cover}
                                title={loan.book_title}
                                size="sm"
                              />
                              <div>
                                <p className="font-bold text-[#142B4A]">{loan.book_title}</p>
                                <p className="text-[#64748B]">{loan.book_author}</p>
                                <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                                  Copy #{loan.copy_id} ({loan.accession_number}) · Issued{' '}
                                  {formatLibrarianShortDate(loan.issue_date)} · Due{' '}
                                  {formatLibrarianShortDate(loan.due_date)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CirculationStatusBadge status={loan.display_status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Reservation Activity */}
              {modalTab === 'reservations' && (
                <div>
                  <h4 className="font-display text-sm font-bold text-[#142B4A]">
                    Reservation Activity
                  </h4>
                  {isLoadingReservations ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                      <span>Loading reservations...</span>
                    </div>
                  ) : reservationsError ? (
                    <div
                      role="alert"
                      className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                    >
                      {reservationsError}
                    </div>
                  ) : studentReservations.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC] p-4 text-xs text-[#64748B]">
                      This student has no reservations.
                    </p>
                  ) : (
                    <div className="mt-2.5 space-y-2.5">
                      {studentReservations.map((res) => (
                        <div
                          key={res.reservation_id}
                          className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-xs sm:flex-row sm:items-center"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-[#142B4A]">{res.book_title}</p>
                              <CirculationStatusBadge status={res.status} />
                            </div>
                            <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                              {res.reservation_code} · Reserved{' '}
                              {formatLibrarianShortDate(res.reservation_date)}
                              {res.queue_position ? ` · Position #${res.queue_position}` : ''}
                              {res.pickup_deadline
                                ? ` · Pickup by ${formatStaffDateTime(res.pickup_deadline)}`
                                : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({
                                name: 'librarian-reservations',
                                prefillSearchQuery: res.reservation_code,
                                prefillReservationId: res.reservation_id,
                              })
                            }
                            className="min-h-[34px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                          >
                            View Reservation
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Borrowing History */}
              {modalTab === 'history' && (
                <div>
                  <h4 className="font-display text-sm font-bold text-[#142B4A]">
                    Borrowing History (Synced with Student Reading History)
                  </h4>
                  {isLoadingHistory ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                      <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                      <span>Loading borrowing history...</span>
                    </div>
                  ) : historyError ? (
                    <div
                      role="alert"
                      className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                    >
                      {historyError}
                    </div>
                  ) : borrowingHistory.length === 0 ? (
                    <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC] p-4 text-xs text-[#64748B]">
                      No returned borrowing history recorded for this student yet.
                    </p>
                  ) : (
                    <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-[#F5F8FC] text-[#64748B]">
                          <tr>
                            <th className="px-3.5 py-2.5 font-semibold">Book</th>
                            <th className="px-3.5 py-2.5 font-semibold">Issue Date</th>
                            <th className="px-3.5 py-2.5 font-semibold">Return Date</th>
                            <th className="px-3.5 py-2.5 font-semibold">Duration</th>
                            <th className="px-3.5 py-2.5 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {borrowingHistory.map((h) => (
                            <tr key={h.borrowing_id}>
                              <td className="px-3.5 py-2.5">
                                <p className="font-semibold text-[#142B4A]">{h.book_title}</p>
                                <p className="text-[11px] text-[#64748B]">{h.book_author}</p>
                              </td>
                              <td className="font-mono-tabular px-3.5 py-2.5 text-[#64748B]">
                                {formatLibrarianShortDate(h.issue_date)}
                              </td>
                              <td className="font-mono-tabular px-3.5 py-2.5 text-[#64748B]">
                                {formatLibrarianShortDate(h.return_date)}
                              </td>
                              <td className="font-mono-tabular px-3.5 py-2.5 font-medium text-[#142B4A]">
                                {h.loan_duration_days} days
                              </td>
                              <td className="px-3.5 py-2.5">
                                <CirculationStatusBadge status={h.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Student Library Statistics & Read-Only Rating Context */}
              {modalTab === 'stats' && computedStats && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
                      <p className="text-[11px] font-medium text-[#64748B]">Total Books Borrowed</p>
                      <p className="font-mono-tabular mt-1 text-xl font-bold text-[#142B4A]">
                        {computedStats.totalBooksBorrowed}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
                      <p className="text-[11px] font-medium text-[#64748B]">Currently Borrowed</p>
                      <p className="font-mono-tabular mt-1 text-xl font-bold text-[#2563EB]">
                        {computedStats.currentlyBorrowed}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
                      <p className="text-[11px] font-medium text-[#64748B]">Completed Loans</p>
                      <p className="font-mono-tabular mt-1 text-xl font-bold text-emerald-700">
                        {computedStats.completedLoans}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
                      <p className="text-[11px] font-medium text-[#64748B]">Overdue Count</p>
                      <p
                        className={`font-mono-tabular mt-1 text-xl font-bold ${
                          computedStats.overdueCount > 0 ? 'text-red-700' : 'text-[#142B4A]'
                        }`}
                      >
                        {computedStats.overdueCount}
                      </p>
                    </div>
                  </div>

                  {(computedStats.averageLoanDurationDays !== null ||
                    computedStats.favoriteCategories.length > 0) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {computedStats.averageLoanDurationDays !== null && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                          <p className="font-bold text-[#142B4A]">Average Loan Duration</p>
                          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2563EB]">
                            {computedStats.averageLoanDurationDays} days
                          </p>
                        </div>
                      )}
                      {computedStats.favoriteCategories.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                          <p className="font-bold text-[#142B4A]">Top Borrowed Subjects</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {computedStats.favoriteCategories.map((cat) => (
                              <span
                                key={cat.category}
                                className="inline-flex items-center gap-1 rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2.5 py-1 text-[11px] font-semibold text-[#142B4A]"
                              >
                                <BookOpen className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                                <span>
                                  {cat.category} ({cat.count})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {capabilities.can_view_ratings && ratingContext.permitted && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <span className="flex items-center gap-1.5 font-bold text-[#142B4A]">
                          <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                          <span>Student Rating Summary (Read-Only)</span>
                        </span>
                        <span className="font-mono-tabular font-semibold text-[#64748B]">
                          {ratingContext.ratings_count} rating
                          {ratingContext.ratings_count === 1 ? '' : 's'}
                          {ratingContext.average_rating_given !== null
                            ? ` · Avg ${ratingContext.average_rating_given.toFixed(1)} / 5`
                            : ''}
                        </span>
                      </div>
                      {ratingContext.rated_books.length === 0 ? (
                        <p className="mt-2.5 text-[#64748B]">
                          No book ratings submitted by this student yet.
                        </p>
                      ) : (
                        <ul className="mt-2.5 space-y-1.5">
                          {ratingContext.rated_books.map((rb) => (
                            <li
                              key={`${rb.book_id}-${rb.rated_at}`}
                              className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F8FC] px-3 py-2"
                            >
                              <span className="font-medium text-[#142B4A]">{rb.book_title}</span>
                              <span className="font-mono-tabular font-bold text-amber-700">
                                {rb.rating} / 5 · {formatLibrarianShortDate(rb.rated_at)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

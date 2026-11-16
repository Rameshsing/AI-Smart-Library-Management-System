import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hourglass,
  Info,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import type { StudentProfile } from '../../utils/studentDashboard';
import {
  buildReservationsApiParams,
  computeReservationsSummary,
  createSampleReservationsPayload,
  DEFAULT_RESERVATIONS_PAGE_LIMIT,
  filterReservations,
  getAvailableReservationTabs,
  paginateReservations,
  type ReservationNotificationEvent,
  type ReservationRecord,
  type ReservationsPayload,
  type ReservationTabKey,
} from '../../utils/reservationsPage';
import { ReservationCard } from './ReservationCard';
import { CancelReservationModal, ReservationDetailsModal } from './ReservationModals';

interface ReservationsPageProps {
  student: StudentProfile;
  onReservationEvent?: (eventType: ReservationNotificationEvent, bookTitle: string) => void;
  onNavigate: (route: AppRoute) => void;
}

export function ReservationsPage({
  student,
  onReservationEvent,
  onNavigate,
}: ReservationsPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [payload, setPayload] = useState<ReservationsPayload | null>(null);
  const [activeTab, setActiveTab] = useState<ReservationTabKey>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [detailsReservation, setDetailsReservation] = useState<ReservationRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ReservationRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const onNavigateRef = React.useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const apiBaseUrl = getApiBaseUrl();
  const backendConnected = isBackendConnected();

  const loadReservations = useCallback(
    async (tabToLoad: ReservationTabKey, searchToLoad: string, pageToLoad: number) => {
      setIsLoading(true);
      setErrorMessage(null);

      if (backendConnected) {
        try {
          const params = buildReservationsApiParams(
            tabToLoad,
            searchToLoad,
            pageToLoad,
            DEFAULT_RESERVATIONS_PAGE_LIMIT
          );
          const response = await fetch(
            `${apiBaseUrl}/api/student/reservations?${params.toString()}`,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                Accept: 'application/json',
              },
            }
          );

          if (response.status === 401 || response.status === 403) {
            onNavigateRef.current({ name: 'login' });
            return;
          }

          if (!response.ok) {
            throw new Error(`Unable to load reservations (${response.status}).`);
          }

          const remotePayload = (await response.json()) as ReservationsPayload;
          setPayload({ ...remotePayload, is_prototype_sample: false });
          setIsLoading(false);
          return;
        } catch (err) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Something went wrong while retrieving your reservations.'
          );
          setIsLoading(false);
          return;
        }
      }

      // Prototype / development mode when VITE_API_BASE_URL is not configured
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      setPayload(createSampleReservationsPayload(referenceDate));
      setIsLoading(false);
    },
    [apiBaseUrl, backendConnected, referenceDate]
  );

  useEffect(() => {
    if (backendConnected) {
      void loadReservations(activeTab, searchQuery, page);
    }
  }, [backendConnected, activeTab, searchQuery, page, reloadNonce, loadReservations]);

  useEffect(() => {
    if (!backendConnected) {
      void loadReservations('all', '', 1);
    }
  }, [backendConnected, reloadNonce, loadReservations]);

  const allRecords = payload?.items ?? [];

  const availableTabs = useMemo(() => {
    if (!payload) return [];
    return getAvailableReservationTabs(allRecords, payload.supported_statuses);
  }, [payload, allRecords]);

  const filteredRecords = useMemo(() => {
    if (!payload) return [];
    if (!payload.is_prototype_sample) {
      return payload.items;
    }
    return filterReservations(allRecords, activeTab, searchQuery);
  }, [payload, allRecords, activeTab, searchQuery]);

  const pagination = useMemo(() => {
    if (!payload) {
      return {
        items: [],
        page: 1,
        limit: DEFAULT_RESERVATIONS_PAGE_LIMIT,
        total: 0,
        totalPages: 1,
      };
    }
    if (!payload.is_prototype_sample) {
      return {
        items: payload.items,
        page: payload.page,
        limit: payload.limit,
        total: payload.filtered_count,
        totalPages: Math.max(1, payload.total_pages),
      };
    }
    return paginateReservations(filteredRecords, page, DEFAULT_RESERVATIONS_PAGE_LIMIT);
  }, [payload, filteredRecords, page]);

  const dynamicSummary = useMemo(() => {
    if (!payload) {
      return {
        active_reservations: 0,
        ready_for_pickup: 0,
        waiting: 0,
        expiring_soon: 0,
      };
    }
    if (!payload.is_prototype_sample) {
      return payload.summary;
    }
    return computeReservationsSummary(payload.items, referenceDate);
  }, [payload, referenceDate]);

  const handleTabChange = (nextTab: ReservationTabKey) => {
    setActiveTab(nextTab);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleRequestCancel = (reservation: ReservationRecord) => {
    setCancelError(null);
    setCancelTarget(reservation);
  };

  const handleConfirmCancel = async (reservation: ReservationRecord) => {
    setCancelError(null);

    if (!backendConnected) {
      setCancelError(
        `Live backend server required to cancel reservation ${reservation.reference_code} (POST /api/reservations/${reservation.reservation_id}/cancel).`
      );
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/reservations/${reservation.reservation_id}/cancel`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        let message = `Unable to cancel reservation (${response.status}).`;
        try {
          const errBody = (await response.json()) as { message?: string; error?: string };
          message = errBody.message ?? errBody.error ?? message;
        } catch {
          // Keep default error message
        }
        throw new Error(message);
      }

      setCancelTarget(null);
      setDetailsReservation(null);
      setToastMessage(`Reservation for "${reservation.title}" has been cancelled.`);
      onReservationEvent?.('cancelled', reservation.title);
      setReloadNonce((prev) => prev + 1);
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : 'Unable to cancel this reservation right now.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRequestCollect = async (reservation: ReservationRecord) => {
    if (!backendConnected) {
      setToastMessage(
        `Server confirmation required to collect "${reservation.title}" online (POST /api/reservations/${reservation.reservation_id}/fulfill).`
      );
      return;
    }

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/reservations/${reservation.reservation_id}/fulfill`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to complete reservation collection (${response.status}).`);
      }

      setDetailsReservation(null);
      setToastMessage(`"${reservation.title}" has been collected and issued to your account.`);
      onReservationEvent?.('collected', reservation.title);
      setReloadNonce((prev) => prev + 1);
    } catch (err) {
      setToastMessage(
        err instanceof Error ? err.message : 'Unable to complete collection at this time.'
      );
    }
  };

  const hasAnyReservations = (payload?.total_count ?? 0) > 0;
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.total, pagination.page * pagination.limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#142B4A]">
              My Reservations
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Manage books you have reserved and track your position in the waiting queue.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-search' })}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <span>Browse Books</span>
          </button>
        </div>

        {/* Policy & Reservation Limit Strip (only when configured by backend/policy) */}
        {payload && !isLoading && !errorMessage && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#64748B]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {payload.policy.reservation_limit !== null && (
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular rounded-md bg-[#DBEAFE] px-2.5 py-1 font-semibold text-[#142B4A]">
                    Reservations: {dynamicSummary.active_reservations} /{' '}
                    {payload.policy.reservation_limit}
                  </span>
                  <span>
                    You can reserve up to {payload.policy.reservation_limit} books at a time.
                  </span>
                </div>
              )}

              {payload.policy.pickup_hold_days !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>
                    Pickup hold window:{' '}
                    <strong className="font-semibold text-[#142B4A]">
                      {payload.policy.pickup_hold_days} days
                    </strong>
                  </span>
                </span>
              )}
            </div>

            <span className="text-xs font-medium text-[#142B4A]">
              {payload.policy.priority_policy_label}
            </span>
          </div>
        )}
      </section>

      {/* Prototype Sample Notice */}
      {payload?.is_prototype_sample && !isLoading && !errorMessage && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Reservations Preview:
              </strong>{' '}
              Showing development reservation queue data for {student.name} ({student.student_code}
              ) structured for the library reservations API.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/student/reservations
          </span>
        </div>
      )}

      {/* Feedback Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#142B4A]"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-white hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <section aria-label="Reservation summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Active Reservations</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-[#142B4A]">
            {isLoading ? '—' : dynamicSummary.active_reservations}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Waiting or ready for collection</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Ready for Pickup</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-emerald-700">
            {isLoading ? '—' : dynamicSummary.ready_for_pickup}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Available at library desk</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Waiting</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Hourglass className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-[#142B4A]">
            {isLoading ? '—' : dynamicSummary.waiting}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">In return queue</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Expiring Soon</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-amber-700">
            {isLoading ? '—' : dynamicSummary.expiring_soon}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Hold ends within 2 days</p>
        </div>
      </section>

      {/* Main Content Area: Loading / Error / Empty / Tabs & Grid */}
      {isLoading ? (
        <section aria-label="Loading reservations" className="space-y-4">
          <div className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((skeleton) => (
              <div
                key={skeleton}
                className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex gap-4">
                  <div className="h-28 w-20 rounded-lg bg-slate-200" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-5 w-36 rounded bg-slate-200" />
                    <div className="h-5 w-3/4 rounded bg-slate-200" />
                    <div className="h-4 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-5 h-16 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </section>
      ) : errorMessage ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
            Unable to load reservations
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
            Something went wrong while retrieving your reservations.
          </p>
          <p className="mt-1 text-xs text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((prev) => prev + 1)}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Try Again
          </button>
        </section>
      ) : !hasAnyReservations ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-xs">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#142B4A]">
            <Bookmark className="h-7 w-7" aria-hidden="true" />
          </span>
          <h3 className="font-display mt-4 text-xl font-bold text-[#142B4A]">
            No reservations yet
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#64748B]">
            When a book you&apos;re interested in is unavailable, you can reserve it and we&apos;ll
            notify you when it becomes available.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-search' })}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              <span>Explore Books</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-recommendations' })}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>Recommended for You</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {/* Tabs + Search Bar */}
          <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
            <div
              role="tablist"
              aria-label="Reservation status filter tabs"
              className="flex flex-wrap items-center gap-1.5"
            >
              {availableTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(tab.key)}
                    className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#142B4A] text-white'
                        : 'bg-[#F5F8FC] text-[#1E293B] hover:bg-[#DBEAFE] hover:text-[#142B4A]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`font-mono-tabular rounded px-1.5 py-0.5 text-[11px] ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white text-[#64748B]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full lg:w-72">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Filter by book, author, or ID..."
                aria-label="Filter reservations"
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] py-2 pr-3 pl-9 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Filtered Results Grid or Empty Filtered Notice */}
          {pagination.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <p className="font-display text-base font-bold text-[#142B4A]">
                No reservations match this filter
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Try switching tabs or clearing your search query to view your other reservations.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="mt-4 inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                Show All Reservations
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {pagination.items.map((reservation) => (
                  <ReservationCard
                    key={reservation.reservation_id}
                    reservation={reservation}
                    referenceDate={referenceDate}
                    workflowMode={payload?.policy.workflow_mode ?? 'librarian_issue'}
                    onOpenDetails={(item) => setDetailsReservation(item)}
                    onRequestCancel={handleRequestCancel}
                    onRequestCollect={handleRequestCollect}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs shadow-xs sm:flex-row">
                <p className="text-[#64748B]">
                  Showing{' '}
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    {startItem}–{endItem}
                  </span>{' '}
                  of{' '}
                  <span className="font-mono-tabular font-semibold text-[#142B4A]">
                    {pagination.total}
                  </span>{' '}
                  reservations
                </p>

                <nav aria-label="Reservations pagination" className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Previous</span>
                  </button>

                  {Array.from({ length: pagination.totalPages }, (_, idx) => idx + 1).map(
                    (pageNumber) => {
                      const isCurrent = pageNumber === pagination.page;
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          aria-current={isCurrent ? 'page' : undefined}
                          onClick={() => setPage(pageNumber)}
                          className={`font-mono-tabular inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-[#2563EB] text-white'
                              : 'border border-slate-200 bg-white text-[#142B4A] hover:border-[#2563EB]'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    }
                  )}

                  <button
                    type="button"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      <ReservationDetailsModal
        reservation={detailsReservation}
        referenceDate={referenceDate}
        workflowMode={payload?.policy.workflow_mode ?? 'librarian_issue'}
        onClose={() => setDetailsReservation(null)}
        onRequestCancel={handleRequestCancel}
        onRequestCollect={handleRequestCollect}
        onNavigate={onNavigate}
      />

      <CancelReservationModal
        reservation={cancelTarget}
        isSubmitting={isCancelling}
        errorMessage={cancelError}
        onConfirm={handleConfirmCancel}
        onClose={() => {
          if (!isCancelling) {
            setCancelError(null);
            setCancelTarget(null);
          }
        }}
      />
    </div>
  );
}

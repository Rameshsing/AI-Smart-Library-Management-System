import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookmarkCheck,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  Repeat,
  Search,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  formatStaffDateTime,
  type LibrarianPermissions,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import type { InventoryPhysicalCopy } from '../../utils/librarianInventory';
import {
  buildReservationsApiQueryParams,
  canMarkReservationReady,
  computeReservationSummary,
  createSampleReservationsStore,
  filterAndPaginateReservations,
  formatPickupDeadlineStatus,
  formatQueuePositionLabel,
  isReservationExpiringSoon,
  mapReservationApiError,
  RESERVATION_TABS,
  type LibrarianReservationItem,
  type ReservationFilterCriteria,
  type ReservationFilterTab,
  type ReservationPickupFilter,
  type ReservationPolicyConfig,
  type ReservationSupportedActions,
  type ReservationSupportedFilters,
} from '../../utils/librarianReservations';
import {
  CirculationAuthorizationBlocked,
  CirculationBookCover,
  CirculationStatusBadge,
} from './CirculationSharedComponents';

interface ReservationsManagementPageProps {
  permissions: LibrarianPermissions;
  prefillSearchQuery?: string;
  prefillReservationId?: number;
  onNavigate: (route: AppRoute) => void;
}

const PAGE_SIZE = 6;

export function ReservationsManagementPage({
  permissions,
  prefillSearchQuery,
  prefillReservationId,
  onNavigate,
}: ReservationsManagementPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleReservationsStore());
  const [policy, setPolicy] = useState<ReservationPolicyConfig>(sampleStoreRef.current.policy);
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const [supportedFilters, setSupportedFilters] = useState<ReservationSupportedFilters>(
    sampleStoreRef.current.supportedFilters
  );
  const [supportedActions, setSupportedActions] = useState<ReservationSupportedActions>(
    sampleStoreRef.current.supportedActions
  );

  const [allSampleItems] = useState<LibrarianReservationItem[]>(sampleStoreRef.current.items);
  const [copies, setCopies] = useState<InventoryPhysicalCopy[]>(sampleStoreRef.current.copies);

  const [rows, setRows] = useState<LibrarianReservationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryCounts, setSummaryCounts] = useState(() =>
    computeReservationSummary(
      sampleStoreRef.current.items,
      sampleStoreRef.current.policy,
      new Date(sampleStoreRef.current.policy.server_reference_iso)
    )
  );

  const [tab, setTab] = useState<ReservationFilterTab>('all');
  const [queryInput, setQueryInput] = useState(prefillSearchQuery ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(prefillSearchQuery ?? '');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [pickupStatusFilter, setPickupStatusFilter] = useState<ReservationPickupFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected reservation modal & nested workflows
  const [selectedReservation, setSelectedReservation] =
    useState<LibrarianReservationItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [selectedReadyCopyId, setSelectedReadyCopyId] = useState<number | null>(null);
  const [showExtendConfirm, setShowExtendConfirm] = useState(false);
  const [showAssignedCopyModal, setShowAssignedCopyModal] = useState(false);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
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

  const filterCriteria: ReservationFilterCriteria = useMemo(
    () => ({
      tab,
      query: debouncedQuery,
      category: categoryFilter,
      subject: subjectFilter,
      branch: branchFilter,
      department: departmentFilter,
      pickupStatus: pickupStatusFilter,
      dateFrom,
      dateTo,
    }),
    [
      branchFilter,
      categoryFilter,
      dateFrom,
      dateTo,
      debouncedQuery,
      departmentFilter,
      pickupStatusFilter,
      subjectFilter,
      tab,
    ]
  );

  const filterOptions = useMemo(() => {
    const categories = Array.from(new Set(allSampleItems.map((i) => i.category))).sort();
    const subjects = Array.from(new Set(allSampleItems.map((i) => i.subject))).sort();
    const branches = Array.from(new Set(allSampleItems.map((i) => i.branch))).sort();
    const departments = Array.from(new Set(allSampleItems.map((i) => i.student_department))).sort();
    return { categories, subjects, branches, departments };
  }, [allSampleItems]);

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    if (!hasBackendApi) {
      await new Promise((r) => window.setTimeout(r, 90));
      const currentPolicy = policyRef.current;
      const refDate = new Date(currentPolicy.server_reference_iso);
      const result = filterAndPaginateReservations(
        allSampleItems,
        filterCriteria,
        currentPolicy,
        refDate,
        page,
        PAGE_SIZE
      );
      setRows(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setSummaryCounts(computeReservationSummary(allSampleItems, currentPolicy, refDate));
      setIsLoading(false);
      return;
    }

    try {
      const qs = buildReservationsApiQueryParams(filterCriteria, page, PAGE_SIZE).toString();
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reservations?${qs}`,
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
        throw new Error(mapReservationApiError(response.status, serverMsg));
      }

      const payload = (await response.json()) as {
        items?: LibrarianReservationItem[];
        total_count?: number;
        total_pages?: number;
        summary?: {
          active_reservations?: number;
          waiting?: number;
          ready_for_pickup?: number;
          expiring_soon?: number;
          expired?: number;
        };
        policy?: Partial<ReservationPolicyConfig>;
        supported_filters?: Partial<ReservationSupportedFilters>;
        supported_actions?: Partial<ReservationSupportedActions>;
        copies?: InventoryPhysicalCopy[];
      };

      const fetchedItems = payload.items ?? [];
      const mergedPolicy = payload.policy
        ? { ...policyRef.current, ...payload.policy }
        : policyRef.current;
      if (payload.policy) setPolicy(mergedPolicy);
      if (payload.supported_filters) {
        setSupportedFilters((prev) => ({ ...prev, ...payload.supported_filters }));
      }
      if (payload.supported_actions) {
        setSupportedActions((prev) => ({ ...prev, ...payload.supported_actions }));
      }
      if (payload.copies) setCopies(payload.copies);

      setRows(fetchedItems);
      setTotalCount(payload.total_count ?? fetchedItems.length);
      setTotalPages(Math.max(1, payload.total_pages ?? 1));

      if (payload.summary) {
        const refDate = new Date(mergedPolicy.server_reference_iso);
        const fallback = computeReservationSummary(fetchedItems, mergedPolicy, refDate);
        setSummaryCounts({
          activeReservations: payload.summary.active_reservations ?? fallback.activeReservations,
          waiting: payload.summary.waiting ?? fallback.waiting,
          readyForPickup: payload.summary.ready_for_pickup ?? fallback.readyForPickup,
          expiringSoon: payload.summary.expiring_soon ?? fallback.expiringSoon,
          expired: payload.summary.expired ?? fallback.expired,
        });
      } else {
        setSummaryCounts(
          computeReservationSummary(
            fetchedItems,
            mergedPolicy,
            new Date(mergedPolicy.server_reference_iso)
          )
        );
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to load reservations. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [allSampleItems, apiBaseUrl, filterCriteria, hasBackendApi, onNavigate, page]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const handleOpenDetails = useCallback(
    async (item: LibrarianReservationItem) => {
      setSelectedReservation(item);
      setDetailError(null);
      setActionFeedback(null);
      setShowCancelConfirm(false);
      setShowReadyConfirm(false);
      setShowExtendConfirm(false);
      setShowAssignedCopyModal(false);
      setCancelReason('');

      const readyEligibility = canMarkReservationReady(item, copies);
      setSelectedReadyCopyId(readyEligibility.availableCopies[0]?.copy_id ?? null);

      if (!hasBackendApi) return;

      setIsLoadingDetail(true);
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reservations/${item.reservation_id}`,
          { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          throw new Error(mapReservationApiError(res.status));
        }
        const detail = (await res.json()) as {
          reservation?: LibrarianReservationItem;
          available_copies?: InventoryPhysicalCopy[];
        };
        if (detail.reservation) {
          setSelectedReservation(detail.reservation);
        }
        if (detail.available_copies && detail.available_copies.length > 0) {
          setSelectedReadyCopyId(detail.available_copies[0].copy_id);
        }
      } catch (err) {
        setDetailError(
          err instanceof Error ? err.message : 'Unable to load full reservation details.'
        );
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [apiBaseUrl, copies, hasBackendApi, onNavigate]
  );

  // Open specific reservation automatically if navigated via prefillReservationId
  useEffect(() => {
    if (!prefillReservationId || rows.length === 0) return;
    const match = rows.find((r) => r.reservation_id === prefillReservationId);
    if (match) {
      void handleOpenDetails(match);
    }
  }, [handleOpenDetails, prefillReservationId, rows]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAssignedCopyModal) {
          setShowAssignedCopyModal(false);
        } else if (showCancelConfirm) {
          setShowCancelConfirm(false);
        } else if (showReadyConfirm) {
          setShowReadyConfirm(false);
        } else if (showExtendConfirm) {
          setShowExtendConfirm(false);
        } else if (selectedReservation) {
          setSelectedReservation(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    selectedReservation,
    showAssignedCopyModal,
    showCancelConfirm,
    showExtendConfirm,
    showReadyConfirm,
  ]);

  if (!permissions.can_manage_reservations) {
    return (
      <CirculationAuthorizationBlocked
        title="Reservations Management Restricted"
        message="Your librarian account does not currently have permission to manage student book reservations."
        onNavigate={onNavigate}
      />
    );
  }

  const refDate = new Date(policy.server_reference_iso);

  const selectedReadyCheck = selectedReservation
    ? canMarkReservationReady(selectedReservation, copies)
    : null;

  const selectedAssignedCopyObj =
    selectedReservation?.assigned_copy_id != null
      ? copies.find((c) => c.copy_id === selectedReservation.assigned_copy_id) ?? null
      : null;

  const handleConfirmMarkReady = async () => {
    if (!selectedReservation || !selectedReadyCheck?.allowed || !selectedReadyCopyId) return;
    setActionFeedback(null);

    if (!hasBackendApi) {
      setActionFeedback({
        type: 'error',
        message: `Pre-validation passed for copy #${selectedReadyCopyId}, but marking a reservation Ready for Pickup requires VITE_API_BASE_URL to be configured so POST /api/librarian/reservations/${selectedReservation.reservation_id}/ready can lock the physical copy, compute the pickup deadline, and notify the student.`,
      });
      return;
    }

    setActionBusy(true);
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reservations/${selectedReservation.reservation_id}/ready`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ copy_id: selectedReadyCopyId }),
        }
      );
      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errData = (await response.json()) as { message?: string; error?: string };
          serverMsg = errData.message ?? errData.error;
        } catch {
          // ignore
        }
        throw new Error(mapReservationApiError(response.status, serverMsg));
      }
      const data = (await response.json()) as {
        reservation?: LibrarianReservationItem;
        message?: string;
      };
      if (data.reservation) setSelectedReservation(data.reservation);
      setShowReadyConfirm(false);
      setActionFeedback({
        type: 'success',
        message:
          data.message ??
          'Reservation marked Ready for Pickup and pickup notification dispatched.',
      });
      void loadReservations();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to mark reservation Ready for Pickup.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedReservation) return;
    setActionFeedback(null);

    if (!hasBackendApi) {
      setActionFeedback({
        type: 'error',
        message: `Cancellation requires VITE_API_BASE_URL to be configured so POST /api/librarian/reservations/${selectedReservation.reservation_id}/cancel can release any held copy, recalculate queue order, and notify affected students.`,
      });
      return;
    }

    setActionBusy(true);
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reservations/${selectedReservation.reservation_id}/cancel`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ reason: cancelReason.trim() || null }),
        }
      );
      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errData = (await response.json()) as { message?: string; error?: string };
          serverMsg = errData.message ?? errData.error;
        } catch {
          // ignore
        }
        throw new Error(mapReservationApiError(response.status, serverMsg));
      }
      const data = (await response.json()) as {
        reservation?: LibrarianReservationItem;
        message?: string;
      };
      if (data.reservation) setSelectedReservation(data.reservation);
      setShowCancelConfirm(false);
      setActionFeedback({
        type: 'success',
        message:
          data.message ??
          'Reservation cancelled, queue positions updated, and student notification recorded.',
      });
      void loadReservations();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to cancel reservation.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmExtend = async () => {
    if (!selectedReservation) return;
    setActionFeedback(null);

    if (!hasBackendApi) {
      setActionFeedback({
        type: 'error',
        message: `Extending pickup deadlines requires VITE_API_BASE_URL to be configured so POST /api/librarian/reservations/${selectedReservation.reservation_id}/extend can apply library policy limits and update the student notification.`,
      });
      return;
    }

    setActionBusy(true);
    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/reservations/${selectedReservation.reservation_id}/extend`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({}),
        }
      );
      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!response.ok) {
        let serverMsg: string | undefined;
        try {
          const errData = (await response.json()) as { message?: string; error?: string };
          serverMsg = errData.message ?? errData.error;
        } catch {
          // ignore
        }
        throw new Error(mapReservationApiError(response.status, serverMsg));
      }
      const data = (await response.json()) as {
        reservation?: LibrarianReservationItem;
        message?: string;
      };
      if (data.reservation) setSelectedReservation(data.reservation);
      setShowExtendConfirm(false);
      setActionFeedback({
        type: 'success',
        message: data.message ?? 'Pickup deadline extended according to library policy.',
      });
      void loadReservations();
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to extend pickup deadline.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const resetFilters = () => {
    setTab('all');
    setQueryInput('');
    setDebouncedQuery('');
    setCategoryFilter('All');
    setSubjectFilter('All');
    setBranchFilter('All');
    setDepartmentFilter('All');
    setPickupStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Reservations
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Manage student book reservations, queues and pickup status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadReservations()}
            disabled={isLoading}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
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
            Sample reservation records aligned with the circulation and physical copy store are
            loaded for inspection while{' '}
            <span className="font-mono-tabular font-semibold">VITE_API_BASE_URL</span> is
            unconfigured. Authoritative queue promotions, cancellations, extensions, and student
            notifications commit via{' '}
            <span className="font-mono-tabular font-semibold">
              GET / POST /api/librarian/reservations
            </span>
            .
          </p>
        </div>
      )}

      {/* 5 Summary Cards */}
      <section aria-label="Reservation queue summary statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => {
              setTab('active');
              setPickupStatusFilter('all');
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-[#2563EB] cursor-pointer"
          >
            <p className="text-xs font-medium text-[#64748B]">Active Reservations</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
              {summaryCounts.activeReservations}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('waiting');
              setPickupStatusFilter('all');
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-[#2563EB] cursor-pointer"
          >
            <p className="text-xs font-medium text-[#64748B]">Waiting</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#2563EB]">
              {summaryCounts.waiting}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('ready_for_pickup');
              setPickupStatusFilter('all');
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-[#2563EB] cursor-pointer"
          >
            <p className="text-xs font-medium text-[#64748B]">Ready for Pickup</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-emerald-700">
              {summaryCounts.readyForPickup}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('ready_for_pickup');
              setPickupStatusFilter('expiring_soon');
              setPage(1);
            }}
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left shadow-xs transition-colors hover:border-amber-400 cursor-pointer"
          >
            <p className="text-xs font-medium text-amber-900">Expiring Soon</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-amber-900">
              {summaryCounts.expiringSoon}
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('expired');
              setPickupStatusFilter('all');
              setPage(1);
            }}
            className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-colors hover:border-red-300 sm:col-span-1 cursor-pointer"
          >
            <p className="text-xs font-medium text-[#64748B]">Expired</p>
            <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-red-700">
              {summaryCounts.expired}
            </p>
          </button>
        </div>
      </section>

      {/* Main Filter, Tabs, Table & Mobile Cards */}
      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        {/* Status Tabs */}
        <div
          role="tablist"
          aria-label="Reservation status filters"
          className="flex flex-wrap gap-2 border-b border-slate-100 pb-4"
        >
          {RESERVATION_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setTab(t.id);
                  if (t.id !== 'ready_for_pickup' && pickupStatusFilter === 'expiring_soon') {
                    setPickupStatusFilter('all');
                  }
                  setPage(1);
                }}
                className={`min-h-[36px] rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'border-[#142B4A] bg-[#142B4A] text-white'
                    : 'border-slate-300 bg-white text-[#1E293B] hover:border-[#2563EB] hover:text-[#2563EB]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Search + Supported Filters */}
        <div className="space-y-3">
          <div className="relative">
            <label htmlFor="reservations-search" className="sr-only">
              Search reservations by student name, student ID, book title, ISBN, reservation ID, or copy accession
            </label>
            <Search
              className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="reservations-search"
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search by Student Name, Student ID, Book Title, ISBN, Reservation ID, or Copy Accession..."
              className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white py-2 pr-4 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {supportedFilters.category && (
              <div>
                <label
                  htmlFor="res-filter-category"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Category
                </label>
                <select
                  id="res-filter-category"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  {filterOptions.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {supportedFilters.subject && (
              <div>
                <label
                  htmlFor="res-filter-subject"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Subject
                </label>
                <select
                  id="res-filter-subject"
                  value={subjectFilter}
                  onChange={(e) => {
                    setSubjectFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Subjects</option>
                  {filterOptions.subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {supportedFilters.branch && (
              <div>
                <label
                  htmlFor="res-filter-branch"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Branch
                </label>
                <select
                  id="res-filter-branch"
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="All">All Branches</option>
                  {filterOptions.branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {supportedFilters.student_department && (
              <div>
                <label
                  htmlFor="res-filter-dept"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Department
                </label>
                <select
                  id="res-filter-dept"
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

            {supportedFilters.pickup_status && (
              <div>
                <label
                  htmlFor="res-filter-pickup"
                  className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                >
                  Pickup Status
                </label>
                <select
                  id="res-filter-pickup"
                  value={pickupStatusFilter}
                  onChange={(e) => {
                    setPickupStatusFilter(e.target.value as ReservationPickupFilter);
                    setPage(1);
                  }}
                  className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="all">All Pickup States</option>
                  <option value="expiring_soon">Expiring Soon</option>
                  <option value="ready">Ready for Pickup</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            )}

            {supportedFilters.date_range && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="res-filter-date-from"
                    className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                  >
                    From Date
                  </label>
                  <input
                    id="res-filter-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="res-filter-date-to"
                    className="mb-1 block text-[11px] font-semibold text-[#64748B]"
                  >
                    To Date
                  </label>
                  <input
                    id="res-filter-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {loadError ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/70 p-8 text-center"
          >
            <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-bold text-[#142B4A]">
              Unable to load reservations
            </p>
            <p className="mt-1 text-xs text-red-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadReservations()}
              className="mt-4 min-h-[38px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2.5 animate-pulse" aria-label="Loading reservations">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-8 text-center">
            <BookmarkCheck className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[#142B4A]">
              No matching reservations found
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              No reservation records matched the current search or filter criteria.
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
                    <th className="px-3.5 py-3 font-semibold">Book</th>
                    <th className="px-3.5 py-3 font-semibold">Reservation Date</th>
                    <th className="px-3.5 py-3 font-semibold">Queue Position</th>
                    <th className="px-3.5 py-3 font-semibold">Status</th>
                    <th className="px-3.5 py-3 font-semibold">Pickup Deadline</th>
                    <th className="px-3.5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((item) => {
                    const queueInfo = formatQueuePositionLabel(
                      item.queue_position,
                      item.queue_total
                    );
                    const deadlineInfo = formatPickupDeadlineStatus(
                      item.pickup_deadline,
                      policy,
                      refDate
                    );
                    const expiring = isReservationExpiringSoon(item, policy, refDate);
                    return (
                      <tr
                        key={item.reservation_id}
                        className={`transition-colors hover:bg-[#F5F8FC]/60 ${
                          expiring ? 'bg-amber-50/35' : ''
                        }`}
                      >
                        <td className="px-3.5 py-3">
                          <p className="font-semibold text-[#142B4A]">{item.student_name}</p>
                          <p className="font-mono-tabular text-[11px] text-[#64748B]">
                            {item.student_code}
                          </p>
                        </td>
                        <td className="max-w-[230px] px-3.5 py-3">
                          <p className="truncate font-semibold text-[#142B4A]">
                            {item.book_title}
                          </p>
                          <p className="truncate text-[11px] text-[#64748B]">{item.book_author}</p>
                        </td>
                        <td className="font-mono-tabular px-3.5 py-3 text-[#64748B]">
                          <p>{formatLibrarianShortDate(item.reservation_date)}</p>
                          <p className="text-[11px]">{item.reservation_code}</p>
                        </td>
                        <td className="px-3.5 py-3">
                          <p className="font-semibold text-[#142B4A]">{queueInfo.primary}</p>
                          {queueInfo.aheadText && (
                            <p className="text-[11px] text-[#64748B]">{queueInfo.aheadText}</p>
                          )}
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CirculationStatusBadge status={item.status} />
                            {expiring && <CirculationStatusBadge status="Expiring Soon" />}
                          </div>
                        </td>
                        <td className="px-3.5 py-3">
                          {item.pickup_deadline ? (
                            <div>
                              <p className="font-mono-tabular font-medium text-[#142B4A]">
                                {formatStaffDateTime(item.pickup_deadline)}
                              </p>
                              <p
                                className={`text-[11px] font-medium ${
                                  deadlineInfo.isExpiringSoon
                                    ? 'text-amber-800'
                                    : deadlineInfo.isPastDeadline
                                      ? 'text-red-700'
                                      : 'text-[#64748B]'
                                }`}
                              >
                                {deadlineInfo.label}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[#64748B]">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleOpenDetails(item)}
                            aria-label={`Manage reservation ${item.reservation_code} for ${item.student_name}`}
                            className="min-h-[34px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {rows.map((item) => {
                const queueInfo = formatQueuePositionLabel(
                  item.queue_position,
                  item.queue_total
                );
                const deadlineInfo = formatPickupDeadlineStatus(
                  item.pickup_deadline,
                  policy,
                  refDate
                );
                const expiring = isReservationExpiringSoon(item, policy, refDate);
                return (
                  <div
                    key={item.reservation_id}
                    className={`rounded-xl border p-3.5 text-xs ${
                      expiring ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#142B4A]">{item.book_title}</p>
                        <p className="mt-0.5 text-[#64748B]">
                          {item.student_name} ·{' '}
                          <span className="font-mono-tabular">{item.student_code}</span>
                        </p>
                      </div>
                      <CirculationStatusBadge status={item.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                      <span className="font-mono-tabular">{item.reservation_code}</span>
                      <span>· {formatLibrarianShortDate(item.reservation_date)}</span>
                      {queueInfo.primary !== '—' && <span>· {queueInfo.primary}</span>}
                    </div>
                    {item.pickup_deadline && (
                      <p
                        className={`mt-1.5 text-[11px] font-medium ${
                          expiring ? 'text-amber-900' : 'text-[#64748B]'
                        }`}
                      >
                        Pickup Deadline: {formatStaffDateTime(item.pickup_deadline)} (
                        {deadlineInfo.label})
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleOpenDetails(item)}
                      aria-label={`Manage reservation ${item.reservation_code} for ${item.student_name}`}
                      className="mt-3 min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                    >
                      Inspect Reservation
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-[#64748B] sm:flex-row">
              <p>
                Showing <span className="font-semibold text-[#142B4A]">{rows.length}</span> of{' '}
                <span className="font-semibold text-[#142B4A]">{totalCount}</span> reservations
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

      {/* Reservation Details & Staff Action Modal */}
      {selectedReservation && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reservation-detail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4 backdrop-blur-[1px]"
        >
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                  {selectedReservation.reservation_code}
                </p>
                <h3
                  id="reservation-detail-modal-title"
                  className="font-display text-lg font-bold text-[#142B4A]"
                >
                  Reservation Queue & Pickup Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReservation(null)}
                aria-label="Close reservation details dialog"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {isLoadingDetail ? (
                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
                  <span>Loading live reservation details...</span>
                </div>
              ) : (
                detailError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900"
                  >
                    {detailError}
                  </div>
                )
              )}

              {actionFeedback && (
                <div
                  role={actionFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-medium ${
                    actionFeedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  }`}
                >
                  {actionFeedback.type === 'error' ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{actionFeedback.message}</span>
                </div>
              )}

              {/* Student + Book Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                      <UserCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                      <span>Student</span>
                    </span>
                    <CirculationStatusBadge status={selectedReservation.student_account_status} />
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Name</dt>
                      <dd className="font-semibold text-[#142B4A]">
                        {selectedReservation.student_name}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Student ID</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {selectedReservation.student_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Department</dt>
                      <dd className="text-right text-[#1E293B]">
                        {selectedReservation.student_department}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#64748B]">Email</dt>
                      <dd className="truncate text-[#1E293B]">
                        {selectedReservation.student_email}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        name: 'librarian-students',
                        prefillStudentId: selectedReservation.student_id,
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    <span>View Student Record</span>
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                      <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                      <span>Reserved Book</span>
                    </span>
                    <span className="text-[11px] font-medium text-[#64748B]">
                      {selectedReservation.category}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <CirculationBookCover
                      src={selectedReservation.book_cover}
                      title={selectedReservation.book_title}
                      size="sm"
                    />
                    <div className="min-w-0 text-xs">
                      <p className="font-bold text-[#142B4A]">
                        {selectedReservation.book_title}
                      </p>
                      <p className="mt-0.5 text-[#64748B]">{selectedReservation.book_author}</p>
                      <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                        ISBN: {selectedReservation.book_isbn}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate({ name: 'book-detail', slug: selectedReservation.book_slug })
                        }
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        <span>View Book Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reservation Lifecycle Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                    <CalendarClock className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <span>Reservation State & Policy Schedule</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CirculationStatusBadge status={selectedReservation.status} />
                    {isReservationExpiringSoon(selectedReservation, policy, refDate) && (
                      <CirculationStatusBadge status="Expiring Soon" />
                    )}
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Reservation ID</dt>
                    <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                      {selectedReservation.reservation_code}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Reservation Date</dt>
                    <dd className="font-mono-tabular text-[#1E293B]">
                      {formatLibrarianShortDate(selectedReservation.reservation_date)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Queue Position</dt>
                    <dd className="font-semibold text-[#142B4A]">
                      {
                        formatQueuePositionLabel(
                          selectedReservation.queue_position,
                          selectedReservation.queue_total
                        ).primary
                      }
                      {formatQueuePositionLabel(
                        selectedReservation.queue_position,
                        selectedReservation.queue_total
                      ).aheadText
                        ? ` (${
                            formatQueuePositionLabel(
                              selectedReservation.queue_position,
                              selectedReservation.queue_total
                            ).aheadText
                          })`
                        : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Ready Date</dt>
                    <dd className="font-mono-tabular text-[#1E293B]">
                      {selectedReservation.ready_date
                        ? formatStaffDateTime(selectedReservation.ready_date)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">
                      Pickup Deadline ({policy.pickup_window_hours}h window)
                    </dt>
                    <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                      {selectedReservation.pickup_deadline
                        ? formatStaffDateTime(selectedReservation.pickup_deadline)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#64748B]">Assigned Physical Copy</dt>
                    <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                      {selectedReservation.assigned_copy_accession ? (
                        <button
                          type="button"
                          onClick={() => setShowAssignedCopyModal((prev) => !prev)}
                          className="text-[#2563EB] hover:underline cursor-pointer"
                        >
                          {selectedReservation.assigned_copy_accession} (#
                          {selectedReservation.assigned_copy_id})
                        </button>
                      ) : (
                        'Not assigned yet'
                      )}
                    </dd>
                  </div>
                </dl>

                {showAssignedCopyModal && selectedAssignedCopyObj && (
                  <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] p-3 text-xs">
                    <p className="font-bold text-[#142B4A]">Assigned Physical Copy Snapshot</p>
                    <p className="mt-1 text-[#64748B]">
                      Accession:{' '}
                      <span className="font-mono-tabular font-semibold text-[#142B4A]">
                        {selectedAssignedCopyObj.accession_number}
                      </span>{' '}
                      · Barcode:{' '}
                      <span className="font-mono-tabular">{selectedAssignedCopyObj.barcode ?? '—'}</span>{' '}
                      · Location: {selectedAssignedCopyObj.branch}, {selectedAssignedCopyObj.floor},{' '}
                      Shelf {selectedAssignedCopyObj.shelf} · Condition:{' '}
                      {selectedAssignedCopyObj.condition} ({selectedAssignedCopyObj.status})
                    </p>
                  </div>
                )}

                {selectedReservation.notes && (
                  <p className="mt-3 rounded-lg bg-[#F5F8FC] px-3 py-2 text-xs text-[#64748B]">
                    <strong className="text-[#142B4A]">Queue Note:</strong>{' '}
                    {selectedReservation.notes}
                  </p>
                )}
              </div>

              {/* Mark Ready Panel */}
              {showReadyConfirm && selectedReservation.status === 'Waiting' && (
                <div className="space-y-3 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-4">
                  <div className="flex items-start gap-2">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                    <div className="text-xs">
                      <p className="font-bold text-[#142B4A]">
                        Assign Available Physical Copy & Notify Student
                      </p>
                      <p className="mt-0.5 text-[#64748B]">
                        Assigning a copy sets reservation status to{' '}
                        <strong>Ready for Pickup</strong> with a {policy.pickup_window_hours}-hour
                        collection deadline and dispatches the student pickup notification. This
                        does <strong>not</strong> create a borrowing record until the student
                        collects the book through <strong>Issue Books</strong>.
                      </p>
                    </div>
                  </div>

                  {selectedReadyCheck && !selectedReadyCheck.allowed ? (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{selectedReadyCheck.reason}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label
                        htmlFor="ready-copy-select"
                        className="block text-xs font-semibold text-[#142B4A]"
                      >
                        Select Available Physical Copy
                      </label>
                      <select
                        id="ready-copy-select"
                        value={selectedReadyCopyId ?? ''}
                        onChange={(e) => setSelectedReadyCopyId(Number(e.target.value))}
                        className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                      >
                        {selectedReadyCheck?.availableCopies.map((copy) => (
                          <option key={copy.copy_id} value={copy.copy_id}>
                            #{copy.copy_id} · {copy.accession_number} ({copy.branch} · {copy.floor}{' '}
                            · Shelf {copy.shelf})
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowReadyConfirm(false)}
                          className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy || !selectedReadyCopyId}
                          onClick={() => void handleConfirmMarkReady()}
                          className="min-h-[36px] rounded-lg bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                        >
                          Confirm Mark Ready
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extend Pickup Deadline Confirmation */}
              {showExtendConfirm && selectedReservation.status === 'Ready for Pickup' && (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs">
                  <p className="font-bold text-[#142B4A]">Extend Pickup Deadline?</p>
                  <p className="text-[#64748B]">
                    Extends the student&apos;s pickup hold window according to backend library
                    policy ({policy.pickup_window_hours}h window) and sends an updated pickup
                    reminder notification.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowExtendConfirm(false)}
                      className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-[#142B4A] cursor-pointer"
                    >
                      Keep Current Deadline
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleConfirmExtend()}
                      className="min-h-[36px] rounded-lg bg-[#142B4A] px-4 py-1.5 font-semibold text-white hover:bg-[#1e3d66] cursor-pointer"
                    >
                      Confirm Extension
                    </button>
                  </div>
                </div>
              )}

              {/* Cancel Reservation Confirmation Dialog */}
              {showCancelConfirm &&
                (selectedReservation.status === 'Waiting' ||
                  selectedReservation.status === 'Ready for Pickup') && (
                  <div
                    role="alertdialog"
                    aria-labelledby="cancel-res-confirm-title"
                    className="space-y-3 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs"
                  >
                    <p id="cancel-res-confirm-title" className="font-bold text-red-950">
                      Cancel this reservation?
                    </p>
                    <p className="text-red-900">
                      Cancelling this reservation releases any held physical copy, recalculates the
                      authoritative queue order for waiting students, and dispatches a cancellation
                      notification where configured.
                    </p>
                    <div>
                      <label
                        htmlFor="cancel-res-reason"
                        className="mb-1 block font-semibold text-red-950"
                      >
                        Cancellation Reason (Optional)
                      </label>
                      <input
                        id="cancel-res-reason"
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="e.g. Student requested cancellation at circulation desk"
                        className="min-h-[38px] w-full rounded-lg border border-red-200 bg-white px-3 text-xs text-[#1E293B] focus:border-red-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(false)}
                        className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 font-semibold text-[#142B4A] cursor-pointer"
                      >
                        Keep Reservation
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void handleConfirmCancel()}
                        className="min-h-[36px] rounded-lg bg-red-600 px-4 py-1.5 font-semibold text-white hover:bg-red-700 cursor-pointer"
                      >
                        Confirm Cancel Reservation
                      </button>
                    </div>
                  </div>
                )}

              {/* Bottom Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {supportedActions.can_mark_ready && selectedReservation.status === 'Waiting' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setShowExtendConfirm(false);
                        setShowReadyConfirm(true);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Mark Ready</span>
                    </button>
                  )}

                  {selectedReservation.status === 'Ready for Pickup' && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({
                          name: 'librarian-issue-books',
                          prefillStudentId: selectedReservation.student_id,
                          prefillBookId: selectedReservation.book_id,
                          prefillReservationId: selectedReservation.reservation_id,
                        })
                      }
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                    >
                      <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Proceed to Issue Books</span>
                    </button>
                  )}

                  {supportedActions.can_extend_deadline &&
                    selectedReservation.status === 'Ready for Pickup' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCancelConfirm(false);
                          setShowReadyConfirm(false);
                          setShowExtendConfirm(true);
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                      >
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Extend Pickup Deadline</span>
                      </button>
                    )}

                  {supportedActions.can_cancel &&
                    (selectedReservation.status === 'Waiting' ||
                      selectedReservation.status === 'Ready for Pickup') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReadyConfirm(false);
                          setShowExtendConfirm(false);
                          setShowCancelConfirm(true);
                        }}
                        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Cancel Reservation</span>
                      </button>
                    )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedReservation(null)}
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

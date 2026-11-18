import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  createSampleLibrarianDashboardBundles,
  verifyLibrarianSessionRole,
  type ExpectedReturnsPayload,
  type InventoryOverviewPayload,
  type LibrarianAlertsPayload,
  type LibrarianAnalyticsPayload,
  type LibrarianAnnouncementRecord,
  type LibrarianBorrowingRecord,
  type LibrarianProfile,
  type LibrarianReservationsOverviewPayload,
  type LibrarianSectionRoute,
  type LibrarianSessionCheckResponse,
  type LibrarianSummaryPayload,
  type RecentBorrowingsPayload,
  type StudentActivityPayload,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch, clearClientSessionToken  } from '../../utils/clientSession';
import { LibrarianShell } from './LibrarianShell';
import {
  LibrarianQuickActions,
  LibrarianSummaryCards,
  RecentBorrowingAndReturns,
  TransactionDetailsModal,
} from './LibrarianOverviewSections';
import {
  AlertsAndAnnouncementsRow,
  ReservationAndInventoryRow,
  StudentActivityAndAnalyticsRow,
} from './LibrarianOperationsSections';
import { LibrarianInventoryPage } from './LibrarianInventoryPage';
import { AddBookPage } from './AddBookPage';
import { IssueBooksPage } from './IssueBooksPage';
import { ReturnBooksPage } from './ReturnBooksPage';
import { ReservationsManagementPage } from './ReservationsManagementPage';
import { StudentRecordsPage } from './StudentRecordsPage';
import { OverdueBooksPage } from './OverdueBooksPage';
import { LibraryAnnouncementsPage } from './LibraryAnnouncementsPage';
import { ReportsAnalyticsPage } from './ReportsAnalyticsPage';
import { LibrarianProfilePage } from './LibrarianProfilePage';

interface LibrarianDashboardPageProps {
  activeRoute: LibrarianSectionRoute;
  routeState?: AppRoute;
  profileSection?: 'profile' | 'settings' | 'password';
  onNavigate: (route: AppRoute) => void;
}

function LibrarianDashboardSkeleton() {
  return (
    <div aria-label="Loading librarian dashboard" className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div key={idx} className="h-32 rounded-xl border border-slate-200 bg-white p-5" />
        ))}
      </div>
      <div className="h-32 rounded-xl border border-slate-200 bg-white p-6" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="h-72 rounded-xl border border-slate-200 bg-white p-6 xl:col-span-8" />
        <div className="h-72 rounded-xl border border-slate-200 bg-white p-6 xl:col-span-4" />
      </div>
    </div>
  );
}

export function LibrarianDashboardPage({
  activeRoute,
  routeState,
  profileSection,
  onNavigate,
}: LibrarianDashboardPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);

  // Core summary & staff identity
  const [summary, setSummary] = useState<LibrarianSummaryPayload | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Independent sections
  const [borrowings, setBorrowings] = useState<RecentBorrowingsPayload | null>(null);
  const [isLoadingBorrowings, setIsLoadingBorrowings] = useState<boolean>(true);
  const [borrowingsError, setBorrowingsError] = useState<string | null>(null);

  const [expectedReturns, setExpectedReturns] = useState<ExpectedReturnsPayload | null>(null);
  const [isLoadingReturns, setIsLoadingReturns] = useState<boolean>(true);
  const [returnsError, setReturnsError] = useState<string | null>(null);

  const [reservations, setReservations] =
    useState<LibrarianReservationsOverviewPayload | null>(null);
  const [isLoadingReservations, setIsLoadingReservations] = useState<boolean>(true);
  const [reservationsError, setReservationsError] = useState<string | null>(null);

  const [inventory, setInventory] = useState<InventoryOverviewPayload | null>(null);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<LibrarianAlertsPayload | null>(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState<boolean>(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  const [studentActivity, setStudentActivity] = useState<StudentActivityPayload | null>(null);
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<LibrarianAnnouncementRecord[] | null>(
    null
  );
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState<boolean>(true);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<LibrarianAnalyticsPayload | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [selectedTransaction, setSelectedTransaction] =
    useState<LibrarianBorrowingRecord | null>(null);

  const onNavigateRef = React.useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const unsavedLeaveGuardRef = React.useRef<((targetRoute: AppRoute) => boolean) | null>(null);
  const handleGuardedNavigate = useCallback(
    (targetRoute: AppRoute) => {
      if (unsavedLeaveGuardRef.current && !unsavedLeaveGuardRef.current(targetRoute)) {
        return;
      }
      onNavigate(targetRoute);
    },
    [onNavigate]
  );

  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const fetchJsonSection = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (!hasBackendApi) {
        throw new Error('Backend API URL is not configured.');
      }
      const response = await apiFetch(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401) {
        onNavigateRef.current({ name: 'admin-login' });
        throw new Error('Authentication required.');
      }
      if (response.status === 403) {
        throw new Error('Your staff role is not authorized to view this section.');
      }
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}).`);
      }
      return (await response.json()) as T;
    },
    [apiBaseUrl, hasBackendApi]
  );

  const loadSingleSection = useCallback(
    async <T,>(
      path: string,
      setLoading: (v: boolean) => void,
      setError: (v: string | null) => void,
      setData: (v: T | null) => void,
      sampleFallback?: () => T
    ) => {
      setLoading(true);
      setError(null);
      if (!hasBackendApi && sampleFallback) {
        await new Promise((r) => window.setTimeout(r, 90));
        setData(sampleFallback());
        setLoading(false);
        return;
      }
      try {
        const result = await fetchJsonSection<T>(path);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load section.');
      } finally {
        setLoading(false);
      }
    },
    [fetchJsonSection, hasBackendApi]
  );

  const loadAllDashboard = useCallback(async () => {
    setUnauthorizedMessage(null);
    setIsLoadingSummary(true);
    setSummaryError(null);
    setIsLoadingBorrowings(true);
    setBorrowingsError(null);
    setIsLoadingReturns(true);
    setReturnsError(null);
    setIsLoadingReservations(true);
    setReservationsError(null);
    setIsLoadingInventory(true);
    setInventoryError(null);
    setIsLoadingAlerts(true);
    setAlertsError(null);
    setIsLoadingActivity(true);
    setActivityError(null);
    setIsLoadingAnnouncements(true);
    setAnnouncementsError(null);
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);

    if (!hasBackendApi) {
      // Development preview mode when backend is unavailable
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const bundles = createSampleLibrarianDashboardBundles(referenceDate);
      setSummary(bundles.summary);
      setIsLoadingSummary(false);
      setBorrowings(bundles.recentBorrowings);
      setIsLoadingBorrowings(false);
      setExpectedReturns(bundles.expectedReturns);
      setIsLoadingReturns(false);
      setReservations(bundles.reservations);
      setIsLoadingReservations(false);
      setInventory(bundles.inventory);
      setIsLoadingInventory(false);
      setAlerts(bundles.alerts);
      setIsLoadingAlerts(false);
      setStudentActivity(bundles.studentActivity);
      setIsLoadingActivity(false);
      setAnnouncements(bundles.announcements);
      setIsLoadingAnnouncements(false);
      setAnalytics(bundles.analytics);
      setIsLoadingAnalytics(false);
      return;
    }

    try {
      // Step 1: Mandatory backend session + role verification
      const sessionCheck = await fetchJsonSection<LibrarianSessionCheckResponse>(
        '/api/auth/session'
      );
      const authResult = verifyLibrarianSessionRole(sessionCheck);
      if (!authResult.authorized) {
        setUnauthorizedMessage(authResult.reason ?? 'Unauthorized access.');
        setIsLoadingSummary(false);
        if (authResult.redirectRoute) {
          onNavigateRef.current(authResult.redirectRoute);
        }
        return;
      }

      // Step 2: Load summary + all independent operational sections in parallel
      const results = await Promise.allSettled([
        fetchJsonSection<LibrarianSummaryPayload>('/api/librarian/dashboard/summary'),
        fetchJsonSection<RecentBorrowingsPayload>(
          '/api/librarian/dashboard/recent-borrowings?page=1&limit=5'
        ),
        fetchJsonSection<ExpectedReturnsPayload>('/api/librarian/dashboard/expected-returns'),
        fetchJsonSection<LibrarianReservationsOverviewPayload>(
          '/api/librarian/dashboard/reservations'
        ),
        fetchJsonSection<InventoryOverviewPayload>(
          '/api/librarian/dashboard/inventory-overview'
        ),
        fetchJsonSection<LibrarianAlertsPayload>('/api/librarian/dashboard/alerts'),
        fetchJsonSection<StudentActivityPayload>('/api/librarian/dashboard/student-activity'),
        fetchJsonSection<{ items: LibrarianAnnouncementRecord[] }>(
          '/api/librarian/dashboard/announcements'
        ),
        fetchJsonSection<LibrarianAnalyticsPayload>('/api/librarian/dashboard/analytics'),
      ]);

      const [
        summaryRes,
        borrowingsRes,
        returnsRes,
        reservationsRes,
        inventoryRes,
        alertsRes,
        activityRes,
        announcementsRes,
        analyticsRes,
      ] = results;

      if (summaryRes.status === 'fulfilled') {
        setSummary({ ...summaryRes.value, is_prototype_sample: false });
      } else {
        setSummaryError(
          summaryRes.reason instanceof Error
            ? summaryRes.reason.message
            : 'Unable to load dashboard summary.'
        );
      }
      setIsLoadingSummary(false);

      if (borrowingsRes.status === 'fulfilled') {
        setBorrowings(borrowingsRes.value);
      } else {
        setBorrowingsError(
          borrowingsRes.reason instanceof Error
            ? borrowingsRes.reason.message
            : 'Unable to load recent borrowings.'
        );
      }
      setIsLoadingBorrowings(false);

      if (returnsRes.status === 'fulfilled') {
        setExpectedReturns(returnsRes.value);
      } else {
        setReturnsError(
          returnsRes.reason instanceof Error
            ? returnsRes.reason.message
            : 'Unable to load expected returns.'
        );
      }
      setIsLoadingReturns(false);

      if (reservationsRes.status === 'fulfilled') {
        setReservations(reservationsRes.value);
      } else {
        setReservationsError(
          reservationsRes.reason instanceof Error
            ? reservationsRes.reason.message
            : 'Unable to load reservations.'
        );
      }
      setIsLoadingReservations(false);

      if (inventoryRes.status === 'fulfilled') {
        setInventory(inventoryRes.value);
      } else {
        setInventoryError(
          inventoryRes.reason instanceof Error
            ? inventoryRes.reason.message
            : 'Unable to load inventory overview.'
        );
      }
      setIsLoadingInventory(false);

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value);
      } else {
        setAlertsError(
          alertsRes.reason instanceof Error ? alertsRes.reason.message : 'Unable to load alerts.'
        );
      }
      setIsLoadingAlerts(false);

      if (activityRes.status === 'fulfilled') {
        setStudentActivity(activityRes.value);
      } else {
        setActivityError(
          activityRes.reason instanceof Error
            ? activityRes.reason.message
            : 'Unable to load student activity.'
        );
      }
      setIsLoadingActivity(false);

      if (announcementsRes.status === 'fulfilled') {
        setAnnouncements(announcementsRes.value.items ?? []);
      } else {
        setAnnouncementsError(
          announcementsRes.reason instanceof Error
            ? announcementsRes.reason.message
            : 'Unable to load announcements.'
        );
      }
      setIsLoadingAnnouncements(false);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value);
      } else {
        setAnalyticsError(
          analyticsRes.reason instanceof Error
            ? analyticsRes.reason.message
            : 'Unable to load analytics preview.'
        );
      }
      setIsLoadingAnalytics(false);
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : "We couldn't retrieve the latest library information. Please try again."
      );
      setIsLoadingSummary(false);
      setIsLoadingBorrowings(false);
      setIsLoadingReturns(false);
      setIsLoadingReservations(false);
      setIsLoadingInventory(false);
      setIsLoadingAlerts(false);
      setIsLoadingActivity(false);
      setIsLoadingAnnouncements(false);
      setIsLoadingAnalytics(false);
    }
  }, [fetchJsonSection, hasBackendApi, referenceDate]);

  useEffect(() => {
    void loadAllDashboard();
  }, [loadAllDashboard]);

  const handleLogout = async () => {
    if (hasBackendApi) {
      try {
        await apiFetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Proceed to staff login
      }
    }
    clearClientSessionToken();
    onNavigate({ name: 'admin-login' });
  };

  const handleScrollToAlerts = () => {
    if (activeRoute !== 'librarian-dashboard') {
      onNavigate({ name: 'librarian-dashboard' });
      return;
    }
    const target = document.getElementById('librarian-alerts-panel');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fallbackProfile: LibrarianProfile =
    createSampleLibrarianDashboardBundles(referenceDate).summary.librarian;
  const activeLibrarian = summary?.librarian ?? fallbackProfile;

  if (unauthorizedMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] p-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="font-display mt-4 text-xl font-bold text-[#142B4A]">
            Librarian Authorization Required
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">{unauthorizedMessage}</p>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'admin-login' })}
            className="mt-6 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#142B4A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1e3d66] cursor-pointer"
          >
            Go to Staff Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <LibrarianShell
      activeRoute={activeRoute}
      librarian={activeLibrarian}
      unreadAlertsCount={alerts?.items.length ?? 0}
      referenceDate={referenceDate}
      onNavigate={handleGuardedNavigate}
      onAlertsClick={handleScrollToAlerts}
      onLogout={() => void handleLogout()}
    >
      {isLoadingSummary ? (
        <LibrarianDashboardSkeleton />
      ) : summaryError || !summary ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
            Unable to load dashboard information
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
            We couldn&apos;t retrieve the latest library information. Please try again.
          </p>
          {summaryError && <p className="mt-1 text-xs text-red-700">{summaryError}</p>}
          <button
            type="button"
            onClick={() => void loadAllDashboard()}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Retry
          </button>
        </section>
      ) : activeRoute === 'librarian-dashboard' ? (
        <div className="space-y-6">
          {summary.is_prototype_sample && (
            <div
              role="note"
              className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-2.5">
                <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-[#142B4A]">
                    Sample Librarian Workspace Preview:
                  </strong>{' '}
                  Showing staff operations data for {summary.librarian.full_name} (
                  {summary.librarian.staff_code}) prepared for the backend librarian dashboard
                  endpoints.
                </span>
              </div>
              <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
                GET /api/librarian/dashboard/summary
              </span>
            </div>
          )}

          {/* 5. Library Overview Statistics */}
          <LibrarianSummaryCards metrics={summary.metrics} onNavigate={onNavigate} />

          {/* 6. Quick Actions */}
          <LibrarianQuickActions
            permissions={summary.librarian.permissions}
            onNavigate={onNavigate}
          />

          {/* 7 & 8. Recent Borrowing Activity + Expected Returns */}
          <RecentBorrowingAndReturns
            borrowingsSection={{
              data: borrowings,
              isLoading: isLoadingBorrowings,
              error: borrowingsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/recent-borrowings?page=1&limit=5',
                  setIsLoadingBorrowings,
                  setBorrowingsError,
                  setBorrowings,
                  () => createSampleLibrarianDashboardBundles(referenceDate).recentBorrowings
                ),
            }}
            expectedReturnsSection={{
              data: expectedReturns,
              isLoading: isLoadingReturns,
              error: returnsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/expected-returns',
                  setIsLoadingReturns,
                  setReturnsError,
                  setExpectedReturns,
                  () => createSampleLibrarianDashboardBundles(referenceDate).expectedReturns
                ),
            }}
            permissions={summary.librarian.permissions}
            referenceDate={referenceDate}
            onOpenTransactionDetails={(txn) => setSelectedTransaction(txn)}
            onNavigate={onNavigate}
          />

          {/* 9 & 10. Reservation Overview + Book Inventory Overview */}
          <ReservationAndInventoryRow
            reservationsSection={{
              data: reservations,
              isLoading: isLoadingReservations,
              error: reservationsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/reservations',
                  setIsLoadingReservations,
                  setReservationsError,
                  setReservations,
                  () => createSampleLibrarianDashboardBundles(referenceDate).reservations
                ),
            }}
            inventorySection={{
              data: inventory,
              isLoading: isLoadingInventory,
              error: inventoryError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/inventory-overview',
                  setIsLoadingInventory,
                  setInventoryError,
                  setInventory,
                  () => createSampleLibrarianDashboardBundles(referenceDate).inventory
                ),
            }}
            permissions={summary.librarian.permissions}
            onNavigate={onNavigate}
          />

          {/* 12 & 13. Notifications/Alerts + Library Announcements Preview */}
          <AlertsAndAnnouncementsRow
            alertsSection={{
              data: alerts,
              isLoading: isLoadingAlerts,
              error: alertsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/alerts',
                  setIsLoadingAlerts,
                  setAlertsError,
                  setAlerts,
                  () => createSampleLibrarianDashboardBundles(referenceDate).alerts
                ),
            }}
            announcementsSection={{
              data: announcements,
              isLoading: isLoadingAnnouncements,
              error: announcementsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/announcements',
                  setIsLoadingAnnouncements,
                  setAnnouncementsError,
                  (res: { items?: LibrarianAnnouncementRecord[] } | LibrarianAnnouncementRecord[] | null) =>
                    setAnnouncements(Array.isArray(res) ? res : (res?.items ?? null)),
                  () => createSampleLibrarianDashboardBundles(referenceDate).announcements
                ),
            }}
            permissions={summary.librarian.permissions}
            onNavigate={onNavigate}
          />

          {/* 11 & 14. Recent Student Activity + Reports & Analytics Preview */}
          <StudentActivityAndAnalyticsRow
            activitySection={{
              data: studentActivity,
              isLoading: isLoadingActivity,
              error: activityError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/student-activity',
                  setIsLoadingActivity,
                  setActivityError,
                  setStudentActivity,
                  () => createSampleLibrarianDashboardBundles(referenceDate).studentActivity
                ),
            }}
            analyticsSection={{
              data: analytics,
              isLoading: isLoadingAnalytics,
              error: analyticsError,
              onRetry: () =>
                void loadSingleSection(
                  '/api/librarian/dashboard/analytics',
                  setIsLoadingAnalytics,
                  setAnalyticsError,
                  setAnalytics,
                  () => createSampleLibrarianDashboardBundles(referenceDate).analytics
                ),
            }}
            permissions={summary.librarian.permissions}
            onNavigate={onNavigate}
          />
        </div>
      ) : activeRoute === 'librarian-inventory' ? (
        <LibrarianInventoryPage
          permissions={summary.librarian.permissions}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-add-book' ? (
        <AddBookPage
          permissions={summary.librarian.permissions}
          onNavigate={onNavigate}
          onRegisterUnsavedGuard={(guard) => {
            unsavedLeaveGuardRef.current = guard;
          }}
        />
      ) : activeRoute === 'librarian-issue-books' ? (
        <IssueBooksPage
          permissions={summary.librarian.permissions}
          prefillStudentId={
            routeState?.name === 'librarian-issue-books' ? routeState.prefillStudentId : undefined
          }
          prefillBookId={
            routeState?.name === 'librarian-issue-books' ? routeState.prefillBookId : undefined
          }
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-return-books' ? (
        <ReturnBooksPage
          permissions={summary.librarian.permissions}
          prefillSearchQuery={
            routeState?.name === 'librarian-return-books'
              ? routeState.prefillSearchQuery
              : undefined
          }
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-reservations' ? (
        <ReservationsManagementPage
          permissions={summary.librarian.permissions}
          prefillSearchQuery={
            routeState?.name === 'librarian-reservations'
              ? routeState.prefillSearchQuery
              : undefined
          }
          prefillReservationId={
            routeState?.name === 'librarian-reservations'
              ? routeState.prefillReservationId
              : undefined
          }
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-students' ? (
        <StudentRecordsPage
          permissions={summary.librarian.permissions}
          prefillStudentId={
            routeState?.name === 'librarian-students' ? routeState.prefillStudentId : undefined
          }
          prefillSearchQuery={
            routeState?.name === 'librarian-students' ? routeState.prefillSearchQuery : undefined
          }
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-overdue' ? (
        <OverdueBooksPage
          permissions={summary.librarian.permissions}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-announcements' ? (
        <LibraryAnnouncementsPage
          permissions={summary.librarian.permissions}
          onNavigate={onNavigate}
        />
      ) : activeRoute === 'librarian-reports' ? (
        <ReportsAnalyticsPage
          permissions={summary.librarian.permissions}
          onNavigate={onNavigate}
        />
      ) : (
        <LibrarianProfilePage
          librarian={summary.librarian}
          activeSection={profileSection ?? 'profile'}
          onProfileUpdated={(updated) =>
            setSummary((prev) => (prev ? { ...prev, librarian: updated } : prev))
          }
          onRegisterUnsavedGuard={(guard) => {
            unsavedLeaveGuardRef.current = guard;
          }}
          onNavigate={handleGuardedNavigate}
        />
      )}

      <TransactionDetailsModal
        transaction={selectedTransaction}
        canViewStudentRecords={activeLibrarian.permissions.can_view_student_records}
        onClose={() => setSelectedTransaction(null)}
        onNavigate={onNavigate}
      />
    </LibrarianShell>
  );
}

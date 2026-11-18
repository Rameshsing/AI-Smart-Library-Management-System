import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import type { StudentProfile } from '../../utils/studentDashboard';
import {
  buildNotificationsApiParams,
  computeNotificationsSummary,
  createSampleNotificationsPayload,
  DEFAULT_NOTIFICATIONS_PAGE_LIMIT,
  filterAndSortNotifications,
  NOTIFICATION_CATEGORIES,
  paginateNotifications,
  type NotificationCategory,
  type NotificationFilterTab,
  type NotificationItem,
  type NotificationPreferencesPayload,
  type NotificationSortOption,
  type NotificationsPayload,
} from '../../utils/notificationsPage';
import {
  MarkAllReadConfirmModal,
  NotificationDetailsModal,
  NotificationSettingsModal,
} from './NotificationModals';
import { NotificationRowCard } from './NotificationRowCard';

interface NotificationsPageProps {
  student: StudentProfile;
  onUnreadCountChange?: (unreadCount: number) => void;
  onNavigate: (route: AppRoute) => void;
}

export function NotificationsPage({
  student,
  onUnreadCountChange,
  onNavigate,
}: NotificationsPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [payload, setPayload] = useState<NotificationsPayload | null>(null);
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | ''>('');
  const [sortOption, setSortOption] = useState<NotificationSortOption>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [detailsTarget, setDetailsTarget] = useState<NotificationItem | null>(null);
  const [markingReadId, setMarkingReadId] = useState<number | null>(null);
  const [actionAlertMessage, setActionAlertMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [markAllModalOpen, setMarkAllModalOpen] = useState<boolean>(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState<boolean>(false);
  const [markAllError, setMarkAllError] = useState<string | null>(null);

  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [isLoadingPrefs, setIsLoadingPrefs] = useState<boolean>(false);
  const [preferencesData, setPreferencesData] =
    useState<NotificationPreferencesPayload | null>(null);
  const [isSavingPrefs, setIsSavingPrefs] = useState<boolean>(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const onNavigateRef = React.useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const onUnreadCountChangeRef = React.useRef(onUnreadCountChange);
  useEffect(() => {
    onUnreadCountChangeRef.current = onUnreadCountChange;
  }, [onUnreadCountChange]);

  const apiBaseUrl = getApiBaseUrl();
  const backendConnected = isBackendConnected();

  const loadNotifications = useCallback(
    async (
      tabToLoad: NotificationFilterTab,
      categoryToLoad: NotificationCategory | '',
      searchToLoad: string,
      sortToLoad: NotificationSortOption,
      pageToLoad: number
    ) => {
      setIsLoading(true);
      setErrorMessage(null);

      if (backendConnected) {
        try {
          const params = buildNotificationsApiParams({
            tab: tabToLoad,
            category: categoryToLoad,
            search: searchToLoad,
            sort: sortToLoad,
            page: pageToLoad,
            limit: DEFAULT_NOTIFICATIONS_PAGE_LIMIT,
          });

          const [listResponse, unreadResponse] = await Promise.all([
            apiFetch(`${apiBaseUrl}/api/student/notifications?${params.toString()}`, {
              method: 'GET',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            }),
            apiFetch(`${apiBaseUrl}/api/student/notifications/unread-count`, {
              method: 'GET',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            }).catch(() => null),
          ]);

          if (listResponse.status === 401 || listResponse.status === 403) {
            onNavigateRef.current({ name: 'login' });
            return;
          }

          if (!listResponse.ok) {
            throw new Error(`Unable to load notifications (${listResponse.status}).`);
          }

          const remotePayload = (await listResponse.json()) as NotificationsPayload;
          let resolvedUnreadCount = remotePayload.unread_count ?? remotePayload.summary.unread;

          if (unreadResponse && unreadResponse.ok) {
            try {
              const unreadJson = (await unreadResponse.json()) as { unread_count?: number };
              if (typeof unreadJson.unread_count === 'number') {
                resolvedUnreadCount = unreadJson.unread_count;
              }
            } catch {
              // Fallback to list response unread count
            }
          }

          setPayload({
            ...remotePayload,
            is_prototype_sample: false,
            unread_count: resolvedUnreadCount,
          });
          setPreferencesData(remotePayload.preferences ?? null);
          onUnreadCountChangeRef.current?.(resolvedUnreadCount);
          setIsLoading(false);
          return;
        } catch (err) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "We couldn't retrieve your notifications. Please try again."
          );
          setIsLoading(false);
          return;
        }
      }

      // Prototype / development mode when VITE_API_BASE_URL is unset
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const sample = createSampleNotificationsPayload(referenceDate);
      setPayload(sample);
      setPreferencesData(sample.preferences);
      onUnreadCountChangeRef.current?.(sample.unread_count);
      setIsLoading(false);
    },
    [apiBaseUrl, backendConnected, referenceDate]
  );

  useEffect(() => {
    if (backendConnected) {
      void loadNotifications(activeTab, selectedCategory, searchQuery, sortOption, page);
    }
  }, [backendConnected, activeTab, selectedCategory, searchQuery, sortOption, page, reloadNonce, loadNotifications]);

  useEffect(() => {
    if (!backendConnected) {
      void loadNotifications('all', '', '', 'newest', 1);
    }
  }, [backendConnected, reloadNonce, loadNotifications]);

  const allRecords = payload?.items ?? [];

  const dynamicSummary = useMemo(() => {
    if (!payload) {
      return {
        total_notifications: 0,
        unread: 0,
        important: 0,
        recent: 0,
      };
    }
    if (!payload.is_prototype_sample) {
      return payload.summary;
    }
    return computeNotificationsSummary(payload.items, referenceDate);
  }, [payload, referenceDate]);

  const tabCounts = useMemo(() => {
    if (!payload) {
      return { all: 0, unread: 0, read: 0, important: 0 };
    }
    const allCount = payload.is_prototype_sample ? allRecords.length : payload.total_count;
    const unreadCount = payload.is_prototype_sample
      ? dynamicSummary.unread
      : payload.unread_count;
    const readCount = Math.max(0, allCount - unreadCount);
    const importantCount = dynamicSummary.important;
    return {
      all: allCount,
      unread: unreadCount,
      read: readCount,
      important: importantCount,
    };
  }, [payload, allRecords.length, dynamicSummary]);

  const filteredRecords = useMemo(() => {
    if (!payload) return [];
    if (!payload.is_prototype_sample) {
      return payload.items;
    }
    return filterAndSortNotifications(allRecords, {
      tab: activeTab,
      category: selectedCategory,
      search: searchQuery,
      sort: sortOption,
    });
  }, [payload, allRecords, activeTab, selectedCategory, searchQuery, sortOption]);

  const pagination = useMemo(() => {
    if (!payload) {
      return {
        items: [],
        page: 1,
        limit: DEFAULT_NOTIFICATIONS_PAGE_LIMIT,
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
    return paginateNotifications(filteredRecords, page, DEFAULT_NOTIFICATIONS_PAGE_LIMIT);
  }, [payload, filteredRecords, page]);

  const hasActiveFilters =
    activeTab !== 'all' ||
    selectedCategory !== '' ||
    searchQuery.trim() !== '' ||
    sortOption !== 'newest';

  const handleClearFilters = () => {
    setActiveTab('all');
    setSelectedCategory('');
    setSearchQuery('');
    setSortOption('newest');
    setPage(1);
  };

  const handleMarkAsRead = async (notification: NotificationItem): Promise<boolean> => {
    if (notification.is_read) return true;
    setActionAlertMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        `Live backend server required to persist read status (PATCH /api/notifications/${notification.notification_id}/read).`
      );
      return false;
    }

    setMarkingReadId(notification.notification_id);
    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/notifications/${notification.notification_id}/read`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return false;
      }

      if (!response.ok) {
        throw new Error(`Unable to mark notification as read (${response.status}).`);
      }

      setDetailsTarget((prev) =>
        prev && prev.notification_id === notification.notification_id
          ? { ...prev, is_read: true, read_at: new Date().toISOString() }
          : prev
      );
      setToastMessage(`Marked "${notification.title}" as read.`);
      setReloadNonce((prev) => prev + 1);
      return true;
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to update read status right now.'
      );
      return false;
    } finally {
      setMarkingReadId(null);
    }
  };

  const handleOpenDetails = (notification: NotificationItem) => {
    setActionAlertMessage(null);
    setDetailsTarget(notification);
  };

  const handleNavigateAction = async (notification: NotificationItem, route: AppRoute) => {
    if (!notification.is_read && backendConnected) {
      await handleMarkAsRead(notification);
    }
    setDetailsTarget(null);
    onNavigate(route);
  };

  const handleConfirmMarkAllRead = async () => {
    setMarkAllError(null);

    if (!backendConnected) {
      setMarkAllError(
        'Live backend server required to mark all notifications as read (PATCH /api/notifications/mark-all-read).'
      );
      return;
    }

    setIsMarkingAllRead(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/notifications/mark-all-read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to mark all notifications as read (${response.status}).`);
      }

      setMarkAllModalOpen(false);
      setToastMessage('All unread notifications have been marked as read.');
      setReloadNonce((prev) => prev + 1);
    } catch (err) {
      setMarkAllError(
        err instanceof Error
          ? err.message
          : 'Unable to mark all notifications as read right now.'
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleOpenSettings = async () => {
    setPrefsError(null);
    setSettingsModalOpen(true);

    if (!backendConnected) {
      setPreferencesData((prev) => prev ?? payload?.preferences ?? null);
      return;
    }

    setIsLoadingPrefs(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/notification-preferences`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to load notification preferences (${response.status}).`);
      }

      const remotePrefs = (await response.json()) as NotificationPreferencesPayload;
      setPreferencesData(remotePrefs);
    } catch (err) {
      setPrefsError(
        err instanceof Error ? err.message : 'Unable to load notification settings.'
      );
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  const handleSaveSettings = async (updatedPrefs: NotificationPreferencesPayload) => {
    setPrefsError(null);

    if (!backendConnected) {
      setPrefsError(
        'Live backend server required to save notification preferences (PUT /api/student/notification-preferences).'
      );
      return;
    }

    setIsSavingPrefs(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/notification-preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: updatedPrefs.categories,
          reminder_timings: updatedPrefs.reminder_timings,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to save notification settings (${response.status}).`);
      }

      const savedPrefs = (await response.json()) as NotificationPreferencesPayload;
      setPreferencesData(savedPrefs);
      setSettingsModalOpen(false);
      setToastMessage('Notification preferences saved.');
    } catch (err) {
      setPrefsError(
        err instanceof Error ? err.message : 'Unable to save notification preferences.'
      );
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleDeleteNotification = async (notification: NotificationItem) => {
    setActionAlertMessage(null);
    if (!backendConnected) {
      setActionAlertMessage(
        `Live backend server required to delete notifications (DELETE /api/notifications/${notification.notification_id}).`
      );
      return;
    }

    try {
      const response = await apiFetch(
        `${apiBaseUrl}/api/notifications/${notification.notification_id}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to delete notification (${response.status}).`);
      }

      setToastMessage('Notification removed.');
      setReloadNonce((prev) => prev + 1);
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to delete notification right now.'
      );
    }
  };

  const hasAnyNotifications = (payload?.total_count ?? 0) > 0;
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.total, pagination.page * pagination.limit);

  const filterTabs: Array<{ key: NotificationFilterTab; label: string; count: number }> = [
    { key: 'all', label: 'All', count: tabCounts.all },
    { key: 'unread', label: 'Unread', count: tabCounts.unread },
    { key: 'read', label: 'Read', count: tabCounts.read },
    { key: 'important', label: 'Important', count: tabCounts.important },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#142B4A]">
              Notifications
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Stay updated with your borrowing activity, due dates, reservations, and important
              library announcements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isLoading || tabCounts.unread === 0}
              onClick={() => {
                setMarkAllError(null);
                setMarkAllModalOpen(true);
              }}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>Mark All as Read</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleOpenSettings}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Settings className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <span>Notification Settings</span>
            </button>
          </div>
        </div>
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
                Sample Notifications Preview:
              </strong>{' '}
              Showing development notification events for {student.name} ({student.student_code})
              structured for the library notification API.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/student/notifications
          </span>
        </div>
      )}

      {/* Backend-Required / Error Action Alert */}
      {actionAlertMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span className="font-medium leading-relaxed">{actionAlertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlertMessage(null)}
            aria-label="Dismiss error alert"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Confirmation Toast Banner */}
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
            aria-label="Dismiss notification banner"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-white hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Notification Summary Cards */}
      <section
        aria-label="Notification summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Total Notifications</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-[#142B4A]">
            {isLoading ? '—' : dynamicSummary.total_notifications}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">All account &amp; library alerts</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Unread</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-[#2563EB]">
            {isLoading ? '—' : dynamicSummary.unread}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Pending review</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Important</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-amber-700">
            {isLoading ? '—' : dynamicSummary.important}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Important &amp; urgent alerts</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Recent Notifications</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[#142B4A]">
              <Clock className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <p className="font-mono-tabular mt-3 text-2xl font-bold text-[#142B4A]">
            {isLoading ? '—' : dynamicSummary.recent}
          </p>
          <p className="mt-1 text-xs text-[#64748B]">Delivered in last 7 days</p>
        </div>
      </section>

      {/* Main Content Area */}
      {isLoading ? (
        <section aria-label="Loading notifications" className="space-y-4">
          <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-48 rounded bg-slate-200" />
                  <div className="h-5 w-2/3 rounded bg-slate-200" />
                  <div className="h-4 w-5/6 rounded bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
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
            Unable to load notifications
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
            We couldn&apos;t retrieve your notifications. Please try again.
          </p>
          <p className="mt-1 text-xs text-red-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setReloadNonce((prev) => prev + 1)}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Retry
          </button>
        </section>
      ) : !hasAnyNotifications ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-xs">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DBEAFE] text-[#142B4A]">
            <BellOff className="h-7 w-7" aria-hidden="true" />
          </span>
          <h3 className="font-display mt-4 text-xl font-bold text-[#142B4A]">
            You&apos;re all caught up!
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#64748B]">
            You don&apos;t have any notifications right now. We&apos;ll let you know when there are
            updates about your books, reservations, or library activity.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {/* Filter Tabs + Category + Sort + Search Toolbar */}
          <section
            aria-label="Notification filters"
            className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div
                role="tablist"
                aria-label="Notification status tabs"
                className="flex flex-wrap items-center gap-1.5"
              >
                {filterTabs.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setPage(1);
                      }}
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

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex min-h-[36px] items-center justify-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] lg:self-auto whitespace-nowrap cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-12">
              {/* Search */}
              <div className="relative lg:col-span-5">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search notifications..."
                  aria-label="Search notifications"
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] py-2 pr-3 pl-9 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="lg:col-span-4">
                <label htmlFor="notification-category-filter" className="sr-only">
                  Filter by category
                </label>
                <select
                  id="notification-category-filter"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value as NotificationCategory | '');
                    setPage(1);
                  }}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] px-3 py-2 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                >
                  <option value="">All Categories</option>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order */}
              <div className="lg:col-span-3">
                <label htmlFor="notification-sort-select" className="sr-only">
                  Sort notifications
                </label>
                <select
                  id="notification-sort-select"
                  value={sortOption}
                  onChange={(e) => {
                    setSortOption(e.target.value as NotificationSortOption);
                    setPage(1);
                  }}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] px-3 py-2 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
            </div>
          </section>

          {/* Notification List */}
          {pagination.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <p className="font-display text-base font-bold text-[#142B4A]">
                No matching notifications
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                No notifications matched your current tab, category, or search filter.
              </p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {pagination.items.map((item) => (
                  <NotificationRowCard
                    key={item.notification_id}
                    notification={item}
                    allowDeletePolicy={payload?.allow_delete ?? false}
                    isMarkingRead={markingReadId === item.notification_id}
                    onOpenDetails={handleOpenDetails}
                    onMarkAsRead={(target) => void handleMarkAsRead(target)}
                    onDelete={(target) => void handleDeleteNotification(target)}
                    onNavigateAction={(target, route) => void handleNavigateAction(target, route)}
                  />
                ))}
              </div>

              {/* Pagination Bar */}
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
                  notifications
                </p>

                <nav aria-label="Notifications pagination" className="flex items-center gap-1.5">
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
      <NotificationDetailsModal
        notification={detailsTarget}
        isMarkingRead={detailsTarget !== null && markingReadId === detailsTarget.notification_id}
        actionError={actionAlertMessage}
        onClose={() => setDetailsTarget(null)}
        onMarkAsRead={(target) => void handleMarkAsRead(target)}
        onNavigateAction={(target, route) => void handleNavigateAction(target, route)}
      />

      <MarkAllReadConfirmModal
        isOpen={markAllModalOpen}
        unreadCount={tabCounts.unread}
        isSubmitting={isMarkingAllRead}
        errorMessage={markAllError}
        onConfirm={() => void handleConfirmMarkAllRead()}
        onClose={() => {
          if (!isMarkingAllRead) {
            setMarkAllError(null);
            setMarkAllModalOpen(false);
          }
        }}
      />

      <NotificationSettingsModal
        isOpen={settingsModalOpen}
        initialPreferences={preferencesData}
        isLoadingPreferences={isLoadingPrefs}
        isSaving={isSavingPrefs}
        errorMessage={prefsError}
        onSave={(updated) => void handleSaveSettings(updated)}
        onClose={() => {
          if (!isSavingPrefs) {
            setPrefsError(null);
            setSettingsModalOpen(false);
          }
        }}
      />
    </div>
  );
}

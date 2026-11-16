import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  BookOpen,
  Calendar,
  Check,
  CheckCheck,
  Loader2,
  Lock,
  Mail,
  Settings,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatNotificationDateTime,
  toggleReminderTiming,
  updatePreferenceCategoryToggle,
  validateSafeNotificationActionRoute,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPreferencesPayload,
  type ReminderTimingOption,
} from '../../utils/notificationsPage';
import { getNotificationCategoryIcon, getPriorityBadgeConfig } from './NotificationRowCard';

interface NotificationDetailsModalProps {
  notification: NotificationItem | null;
  isMarkingRead: boolean;
  actionError: string | null;
  onClose: () => void;
  onMarkAsRead: (notification: NotificationItem) => void;
  onNavigateAction: (notification: NotificationItem, route: AppRoute) => void;
}

export function NotificationDetailsModal({
  notification,
  isMarkingRead,
  actionError,
  onClose,
  onMarkAsRead,
  onNavigateAction,
}: NotificationDetailsModalProps) {
  useEffect(() => {
    if (!notification) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [notification, onClose]);

  if (!notification) return null;

  const safeRoute = validateSafeNotificationActionRoute(
    notification.action_url,
    notification.action_route
  );
  const priorityBadge = getPriorityBadgeConfig(notification.priority);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-details-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              {getNotificationCategoryIcon(notification.category)}
            </span>
            <div>
              <p className="text-xs font-semibold text-[#2563EB]">{notification.category}</p>
              <h2
                id="notification-details-modal-title"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                {notification.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification details modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Status + Priority + Timestamp */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${
                notification.is_read
                  ? 'border-slate-200 bg-slate-100 text-slate-600'
                  : 'border-[#2563EB]/30 bg-[#DBEAFE] text-[#142B4A]'
              }`}
            >
              {notification.is_read ? 'Read' : 'Unread'}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${priorityBadge.className}`}
            >
              {priorityBadge.icon}
              <span>Priority: {priorityBadge.label}</span>
            </span>

            <span className="font-mono-tabular inline-flex items-center gap-1.5 text-xs text-[#64748B]">
              <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>{formatNotificationDateTime(notification.created_at)}</span>
            </span>
          </div>

          {/* Full Message */}
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
            <p className="text-sm leading-relaxed text-[#1E293B]">{notification.message}</p>
            {notification.announcement_author && (
              <p className="mt-3 border-t border-slate-200 pt-2.5 text-xs font-medium text-[#64748B]">
                Published by {notification.announcement_author}
              </p>
            )}
          </div>

          {/* Related Book / Metadata */}
          {notification.related_book_title && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <BookOpen className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#64748B]">Related Book</p>
                <p className="truncate text-sm font-semibold text-[#142B4A]">
                  {notification.related_book_title}
                </p>
              </div>
            </div>
          )}

          {notification.is_read && notification.read_at && (
            <p className="font-mono-tabular text-xs text-[#64748B]">
              Marked read on {formatNotificationDateTime(notification.read_at)}
            </p>
          )}

          {actionError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{actionError}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {safeRoute && (
              <button
                type="button"
                onClick={() => onNavigateAction(notification, safeRoute)}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
              >
                <span>{notification.action_label ?? 'Open Related Page'}</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}

            {!notification.is_read && (
              <button
                type="button"
                disabled={isMarkingRead}
                onClick={() => onMarkAsRead(notification)}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {isMarkingRead ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Mark as Read</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface MarkAllReadConfirmModalProps {
  isOpen: boolean;
  unreadCount: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function MarkAllReadConfirmModal({
  isOpen,
  unreadCount,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: MarkAllReadConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-all-read-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="mark-all-read-modal-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Mark all notifications as read?
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close mark all read confirmation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-[#1E293B]">
            This will mark all{' '}
            <strong className="font-mono-tabular text-[#142B4A]">{unreadCount}</strong> unread{' '}
            {unreadCount === 1 ? 'notification' : 'notifications'} in your account as read while
            preserving every notification record in your history.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Confirm Mark All as Read</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationSettingsModalProps {
  isOpen: boolean;
  initialPreferences: NotificationPreferencesPayload | null;
  isLoadingPreferences: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  onSave: (preferences: NotificationPreferencesPayload) => void;
  onClose: () => void;
}

const REMINDER_OPTIONS: Array<{ value: ReminderTimingOption; label: string; helper: string }> = [
  {
    value: '2_days_before',
    label: '2 days before due date',
    helper: 'Early notice calculated from each loan’s configured due date',
  },
  {
    value: '1_day_before',
    label: '1 day before due date',
    helper: 'Final day advance reminder before return deadline',
  },
  {
    value: 'on_due_date',
    label: 'On the due date',
    helper: 'Same-day return notice on the morning the book is due',
  },
];

interface NotificationPreferencesPanelProps {
  preferences: NotificationPreferencesPayload | null;
  isLoadingPreferences?: boolean;
  isDisabled?: boolean;
  onChange: (next: NotificationPreferencesPayload) => void;
}

export function NotificationPreferencesPanel({
  preferences,
  isLoadingPreferences = false,
  isDisabled = false,
  onChange,
}: NotificationPreferencesPanelProps) {
  if (isLoadingPreferences || !preferences) {
    return (
      <div className="space-y-3 py-6">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    );
  }

  const handleCategoryToggle = (
    category: NotificationCategory,
    channel: 'in_app_enabled' | 'email_enabled',
    value: boolean
  ) => {
    onChange(updatePreferenceCategoryToggle(preferences, category, channel, value));
  };

  const handleTimingToggle = (option: ReminderTimingOption) => {
    onChange({
      ...preferences,
      reminder_timings: toggleReminderTiming(preferences.reminder_timings, option),
    });
  };

  return (
    <div className="space-y-6">
      {/* Email Delivery Status Note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-3.5 text-xs text-[#1E293B]">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <div>
          <p className="font-semibold text-[#142B4A]">
            {preferences.email_delivery_configured
              ? 'Backend Email Delivery Active'
              : 'Email Delivery Service Status'}
          </p>
          <p className="mt-0.5 text-[#64748B]">
            {preferences.email_delivery_configured
              ? 'Supported email categories are dispatched through the configured library mail service and respect mandatory policy alerts.'
              : 'Email preferences are saved per category and will only dispatch emails once the library backend mail service is configured and confirms delivery.'}
          </p>
        </div>
      </div>

      {/* Channel Matrix */}
      <div>
        <h3 className="font-display text-sm font-bold text-[#142B4A]">
          In-App &amp; Email Channels
        </h3>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Operational library alerts marked mandatory cannot be disabled.
        </p>

        <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-12 bg-[#F5F8FC] px-4 py-2.5 text-[11px] font-semibold text-[#64748B]">
            <span className="col-span-6 sm:col-span-7">Notification Category</span>
            <span className="col-span-3 text-center sm:col-span-2">In-App</span>
            <span className="col-span-3 text-center">Email</span>
          </div>

          {preferences.categories.map((pref) => (
            <div
              key={pref.category}
              className="grid grid-cols-12 items-center gap-2 bg-white px-4 py-3 text-xs"
            >
              <div className="col-span-6 min-w-0 sm:col-span-7">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[#142B4A]">{pref.category}</span>
                  {pref.is_mandatory && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                      <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>Mandatory</span>
                    </span>
                  )}
                </div>
                {pref.mandatory_reason && (
                  <p className="mt-0.5 text-[11px] text-[#64748B]">{pref.mandatory_reason}</p>
                )}
              </div>

              <div className="col-span-3 flex justify-center sm:col-span-2">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pref.in_app_enabled}
                    disabled={pref.is_mandatory || isDisabled}
                    onChange={(e) =>
                      handleCategoryToggle(pref.category, 'in_app_enabled', e.target.checked)
                    }
                    aria-label={`${pref.category} in-app notifications`}
                    className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="col-span-3 flex justify-center">
                {pref.email_supported ? (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pref.email_enabled}
                      disabled={(pref.is_mandatory && pref.email_enabled) || isDisabled}
                      onChange={(e) =>
                        handleCategoryToggle(pref.category, 'email_enabled', e.target.checked)
                      }
                      aria-label={`${pref.category} email notifications`}
                      className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                ) : (
                  <span className="text-[11px] text-[#64748B]">In-app only</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reminder Timing Preferences */}
      {preferences.allow_reminder_customization && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-sm font-bold text-[#142B4A]">
              Due-Date Reminder Timing
            </h3>
            {preferences.configured_loan_period_days !== null && (
              <span className="font-mono-tabular text-[11px] font-medium text-[#64748B]">
                Current library loan period: {preferences.configured_loan_period_days} days
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Exact reminder dates are calculated server-side from each borrowing&apos;s actual issue
            and due dates.
          </p>

          <div className="mt-3 space-y-2">
            {REMINDER_OPTIONS.map((opt) => {
              const checked = preferences.reminder_timings.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs transition-colors cursor-pointer ${
                    checked
                      ? 'border-[#2563EB]/40 bg-[#EFF6FF]/60'
                      : 'border-slate-200 bg-white hover:bg-[#F5F8FC]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDisabled}
                    onChange={() => handleTimingToggle(opt.value)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                  />
                  <div>
                    <span className="font-semibold text-[#142B4A]">{opt.label}</span>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">{opt.helper}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationSettingsModal({
  isOpen,
  initialPreferences,
  isLoadingPreferences,
  isSaving,
  errorMessage,
  onSave,
  onClose,
}: NotificationSettingsModalProps) {
  const [draft, setDraft] = useState<NotificationPreferencesPayload | null>(initialPreferences);

  useEffect(() => {
    setDraft(initialPreferences);
  }, [initialPreferences, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSaving ? undefined : onClose}
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Settings className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="notification-settings-modal-title"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                Notification Settings
              </h2>
              <p className="text-xs text-[#64748B]">
                Manage your in-app alerts, supported email updates, and due-date reminder timing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close notification settings modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <NotificationPreferencesPanel
            preferences={draft}
            isLoadingPreferences={isLoadingPreferences}
            isDisabled={isSaving}
            onChange={(next) => setDraft(next)}
          />

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => draft && onSave(draft)}
            disabled={isSaving || isLoadingPreferences || !draft}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
}

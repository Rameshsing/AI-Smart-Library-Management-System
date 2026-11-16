import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bookmark,
  BookOpen,
  Check,
  Clock,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatNotificationDateTime,
  validateSafeNotificationActionRoute,
  type NotificationCategory,
  type NotificationItem,
  type NotificationPriority,
} from '../../utils/notificationsPage';

interface NotificationRowCardProps {
  notification: NotificationItem;
  allowDeletePolicy: boolean;
  isMarkingRead: boolean;
  onOpenDetails: (notification: NotificationItem) => void;
  onMarkAsRead: (notification: NotificationItem) => void;
  onDelete?: (notification: NotificationItem) => void;
  onNavigateAction: (notification: NotificationItem, route: AppRoute) => void;
}

export function getNotificationCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'Borrowing':
      return <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
    case 'Due Date Reminders':
      return <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    case 'Overdue':
      return <AlertOctagon className="h-4 w-4 text-red-600" aria-hidden="true" />;
    case 'Reservations':
      return <Bookmark className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
    case 'Recommendations':
      return <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
    case 'Reviews & Feedback':
      return <Star className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    case 'Library Announcements':
      return <Megaphone className="h-4 w-4 text-[#142B4A]" aria-hidden="true" />;
    case 'Account & Security':
      return <ShieldCheck className="h-4 w-4 text-[#142B4A]" aria-hidden="true" />;
    default:
      return <Bell className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />;
  }
}

export function getPriorityBadgeConfig(priority: NotificationPriority): {
  label: string;
  className: string;
  icon: React.ReactNode | null;
} {
  switch (priority) {
    case 'Urgent':
      return {
        label: 'Urgent',
        className: 'border-red-200 bg-red-50 text-red-700',
        icon: <AlertOctagon className="h-3 w-3 shrink-0 text-red-600" aria-hidden="true" />,
      };
    case 'Important':
      return {
        label: 'Important',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />,
      };
    case 'Normal':
      return {
        label: 'Normal',
        className: 'border-slate-200 bg-slate-50 text-[#64748B]',
        icon: null,
      };
  }
}

export function NotificationRowCard({
  notification,
  allowDeletePolicy,
  isMarkingRead,
  onOpenDetails,
  onMarkAsRead,
  onDelete,
  onNavigateAction,
}: NotificationRowCardProps) {
  const safeRoute = validateSafeNotificationActionRoute(
    notification.action_url,
    notification.action_route
  );
  const priorityBadge = getPriorityBadgeConfig(notification.priority);
  const formattedTimestamp = formatNotificationDateTime(notification.created_at);

  return (
    <article
      aria-label={`${notification.is_read ? 'Read' : 'Unread'} notification: ${notification.title}`}
      className={`rounded-xl border p-4 transition-colors sm:p-5 ${
        notification.is_read
          ? 'border-slate-200 bg-white hover:border-slate-300'
          : 'border-[#2563EB]/35 bg-[#EFF6FF]/55 hover:border-[#2563EB]/60'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: Icon + Body */}
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <div
            className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              notification.is_read
                ? 'border-slate-200 bg-[#F5F8FC]'
                : 'border-[#DBEAFE] bg-white'
            }`}
          >
            {getNotificationCategoryIcon(notification.category)}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Metadata & Accessible Read/Priority Indicators */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  notification.is_read
                    ? 'border-slate-200 bg-slate-100 text-slate-600'
                    : 'border-[#2563EB]/30 bg-[#DBEAFE] text-[#142B4A]'
                }`}
              >
                <span>{notification.is_read ? 'Read' : 'Unread'}</span>
              </span>

              {notification.priority !== 'Normal' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${priorityBadge.className}`}
                >
                  {priorityBadge.icon}
                  <span>{priorityBadge.label}</span>
                </span>
              )}

              <span className="font-medium text-[#142B4A]">{notification.category}</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <time
                dateTime={notification.created_at}
                className="font-mono-tabular text-[#64748B]"
              >
                {formattedTimestamp}
              </time>
            </div>

            {/* Notification Title (Interactive Button) */}
            <h3 className="font-display text-base leading-snug text-[#142B4A]">
              <button
                type="button"
                onClick={() => onOpenDetails(notification)}
                className={`text-left transition-colors hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                  notification.is_read ? 'font-semibold' : 'font-bold'
                }`}
              >
                {notification.title}
              </button>
            </h3>

            {/* Description */}
            <p className="text-sm leading-relaxed text-[#1E293B]">{notification.message}</p>

            {/* Related Book Context */}
            {notification.related_book_title && (
              <p className="text-xs text-[#64748B]">
                Related book:{' '}
                <strong className="font-semibold text-[#142B4A]">
                  {notification.related_book_title}
                </strong>
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          {safeRoute && notification.action_label ? (
            <button
              type="button"
              onClick={() => onNavigateAction(notification, safeRoute)}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
            >
              <span>{notification.action_label}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenDetails(notification)}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#142B4A] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E3A63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
            >
              <span>{notification.action_label ?? 'View Details'}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5">
            {!notification.is_read && (
              <button
                type="button"
                disabled={isMarkingRead}
                onClick={() => onMarkAsRead(notification)}
                aria-label={`Mark "${notification.title}" as read`}
                className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-55 whitespace-nowrap cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Mark as Read</span>
              </button>
            )}

            {safeRoute && (
              <button
                type="button"
                onClick={() => onOpenDetails(notification)}
                aria-label={`View details for ${notification.title}`}
                className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#64748B] transition-colors hover:border-[#2563EB] hover:text-[#142B4A] whitespace-nowrap cursor-pointer"
              >
                Details
              </button>
            )}

            {allowDeletePolicy && notification.can_delete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(notification)}
                aria-label={`Delete notification "${notification.title}"`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

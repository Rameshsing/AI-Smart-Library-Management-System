import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  BookmarkCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  Info,
  Megaphone,
  MessageSquare,
  Plus,
  Repeat,
  RotateCcw,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  deriveInventoryStatus,
  filterAuthorizedStudentActivity,
  formatStaffDateTime,
  type AlertPriority,
  type InventoryOverviewPayload,
  type LibrarianAlertsPayload,
  type LibrarianAnalyticsPayload,
  type LibrarianAnnouncementRecord,
  type LibrarianPermissions,
  type LibrarianReservationsOverviewPayload,
  type LibrarianReservationStatus,
  type StudentActivityPayload,
  type StudentActivityType,
} from '../../utils/librarianDashboard';
import { SectionErrorBox, type SectionState } from './LibrarianOverviewSections';

function LazyBookCover({
  src,
  alt,
  title,
}: {
  src: string;
  alt: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        title={title}
        className="flex h-12 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-[#142B4A] text-white"
      >
        <BookOpen className="h-4 w-4 text-[#DBEAFE]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-12 w-9 shrink-0 rounded border border-slate-200 object-cover"
    />
  );
}

function getReservationStatusBadge(status: LibrarianReservationStatus) {
  switch (status) {
    case 'Ready for Pickup':
      return {
        classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3 w-3 text-emerald-700" aria-hidden="true" />,
      };
    case 'Expiring Soon':
      return {
        classes: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <AlertTriangle className="h-3 w-3 text-amber-700" aria-hidden="true" />,
      };
    case 'Waiting':
      return {
        classes: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#142B4A]',
        icon: <Clock className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />,
      };
    case 'Fulfilled':
      return {
        classes: 'border-slate-200 bg-slate-100 text-slate-700',
        icon: <CheckCircle2 className="h-3 w-3 text-slate-600" aria-hidden="true" />,
      };
  }
}

export function ReservationAndInventoryRow({
  reservationsSection,
  inventorySection,
  permissions,
  onNavigate,
}: {
  reservationsSection: SectionState<LibrarianReservationsOverviewPayload>;
  inventorySection: SectionState<InventoryOverviewPayload>;
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Reservation Overview */}
      <section
        aria-labelledby="librarian-reservations-overview-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              id="librarian-reservations-overview-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Reservation Overview
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Queue holds, pickups ready, and expiring windows.
            </p>
          </div>
          {permissions.can_manage_reservations && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-reservations' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>Manage Reservations</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex-1">
          {reservationsSection.isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-16 rounded-xl bg-slate-100" />
              <div className="h-20 rounded-xl bg-slate-100" />
              <div className="h-20 rounded-xl bg-slate-100" />
            </div>
          ) : reservationsSection.error ? (
            <SectionErrorBox
              title="Unable to load reservation overview"
              message={reservationsSection.error}
              onRetry={reservationsSection.onRetry}
            />
          ) : !reservationsSection.data ||
            (reservationsSection.data.items.length === 0 &&
              reservationsSection.data.counts.active_waiting === 0 &&
              reservationsSection.data.counts.ready_for_pickup === 0) ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center">
              <BookmarkCheck className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-2.5 font-display text-sm font-bold text-[#142B4A]">
                No pending reservations
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                There are currently no reservations requiring attention.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[#64748B]">Active Waiting</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#142B4A]">
                    {reservationsSection.data.counts.active_waiting}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-emerald-800">Ready for Pickup</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-emerald-900">
                    {reservationsSection.data.counts.ready_for_pickup}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-amber-800">Expiring Soon</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-amber-900">
                    {reservationsSection.data.counts.expiring_soon}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[#64748B]">Recently Fulfilled</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#142B4A]">
                    {reservationsSection.data.counts.recently_fulfilled}
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2.5">
                {reservationsSection.data.items.map((res) => {
                  const badge = getReservationStatusBadge(res.status);
                  return (
                    <li
                      key={res.reservation_id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 font-bold text-[#142B4A]">{res.book_title}</p>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badge.classes}`}
                        >
                          {badge.icon}
                          <span>{res.status}</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B]">
                        <span>
                          {res.student_name} ·{' '}
                          <span className="font-mono-tabular">{res.student_code}</span>
                        </span>
                        <span className="font-mono-tabular">
                          {res.reservation_date}
                          {reservationsSection.data?.supports_queue_position &&
                          res.queue_position !== null
                            ? ` · Queue #${res.queue_position}`
                            : ''}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Book Inventory Overview */}
      <section
        aria-labelledby="librarian-inventory-overview-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="librarian-inventory-overview-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Book Inventory Overview
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Recently added titles, low-copy alerts, and copy counts across the catalogue.
            </p>
          </div>
          {permissions.can_manage_inventory && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-inventory' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>View Full Inventory</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex-1">
          {inventorySection.isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-12 rounded-xl bg-slate-100" />
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : inventorySection.error ? (
            <SectionErrorBox
              title="Unable to load book inventory overview"
              message={inventorySection.error}
              onRetry={inventorySection.onRetry}
            />
          ) : !inventorySection.data || inventorySection.data.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center text-xs text-[#64748B]">
              No inventory titles returned by the library catalogue service.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2">
                  <p className="text-[11px] font-medium text-[#64748B]">Recently Added</p>
                  <p className="font-mono-tabular text-base font-bold text-[#142B4A]">
                    {inventorySection.data.counts.recently_added}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                  <p className="text-[11px] font-medium text-emerald-800">Available Titles</p>
                  <p className="font-mono-tabular text-base font-bold text-emerald-900">
                    {inventorySection.data.counts.available_titles}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2">
                  <p className="text-[11px] font-medium text-amber-800">
                    {inventorySection.data.configured_low_stock_threshold !== null
                      ? `Low Copy (≤${inventorySection.data.configured_low_stock_threshold})`
                      : 'Low Copy Threshold'}
                  </p>
                  <p className="font-mono-tabular text-base font-bold text-amber-900">
                    {inventorySection.data.configured_low_stock_threshold !== null &&
                    inventorySection.data.counts.low_copy_titles !== null
                      ? inventorySection.data.counts.low_copy_titles
                      : 'Not set'}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2">
                  <p className="text-[11px] font-medium text-red-800">Unavailable Titles</p>
                  <p className="font-mono-tabular text-base font-bold text-red-900">
                    {inventorySection.data.counts.unavailable_titles}
                  </p>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {inventorySection.data.items.slice(0, 5).map((book) => {
                  const invStatus = deriveInventoryStatus(
                    book.available_copies,
                    book.total_copies,
                    inventorySection.data?.configured_low_stock_threshold ?? null
                  );
                  return (
                    <div
                      key={book.book_id}
                      className="flex flex-col justify-between gap-3 px-4 py-3 text-xs sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <LazyBookCover
                          src={book.cover_image}
                          alt={`Cover of ${book.title}`}
                          title={book.title}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-bold text-[#142B4A]">{book.title}</p>
                            {book.is_recently_added && (
                              <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                                New
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[#64748B]">
                            {book.author} ·{' '}
                            <span className="font-mono-tabular">{book.isbn}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                        <span className="font-mono-tabular text-[#1E293B]">
                          <strong>{book.available_copies}</strong>/{book.total_copies} copies
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                            invStatus === 'Unavailable'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : invStatus === 'Low Stock'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {invStatus === 'Unavailable' ? (
                            <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          ) : invStatus === 'Low Stock' ? (
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{invStatus}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function getAlertPriorityStyle(priority: AlertPriority) {
  if (priority === 'Urgent') {
    return {
      border: 'border-red-200 bg-red-50/60',
      badge: 'bg-red-100 text-red-800',
      icon: <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />,
    };
  }
  if (priority === 'High') {
    return {
      border: 'border-amber-200 bg-amber-50/60',
      badge: 'bg-amber-100 text-amber-800',
      icon: <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />,
    };
  }
  return {
    border: 'border-[#DBEAFE] bg-[#F5F8FC]',
    badge: 'bg-[#DBEAFE] text-[#142B4A]',
    icon: <Info className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
  };
}

export function AlertsAndAnnouncementsRow({
  alertsSection,
  announcementsSection,
  permissions,
  onNavigate,
}: {
  alertsSection: SectionState<LibrarianAlertsPayload>;
  announcementsSection: SectionState<LibrarianAnnouncementRecord[]>;
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}) {
  return (
    <div id="librarian-alerts-panel" className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Operational Notifications & Alerts */}
      <section
        aria-labelledby="librarian-alerts-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <h2
              id="librarian-alerts-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Notifications &amp; Operational Alerts
            </h2>
          </div>
          {alertsSection.data && (
            <span className="font-mono-tabular text-xs font-semibold text-[#64748B]">
              {alertsSection.data.items.length} active
            </span>
          )}
        </div>

        <div className="mt-4">
          {alertsSection.isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : alertsSection.error ? (
            <SectionErrorBox
              title="Unable to load operational alerts"
              message={alertsSection.error}
              onRetry={alertsSection.onRetry}
            />
          ) : !alertsSection.data || alertsSection.data.items.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              All library queues and due dates are currently clear.
            </div>
          ) : (
            <div className="space-y-2.5">
              {alertsSection.data.items.map((alert) => {
                const style = getAlertPriorityStyle(alert.priority);
                return (
                  <div
                    key={alert.alert_id}
                    className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 text-xs sm:flex-row sm:items-center ${style.border}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="mt-0.5 shrink-0">{style.icon}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-[#142B4A]">{alert.title}</p>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                          >
                            {alert.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-[#1E293B]">{alert.description}</p>
                        {alert.timestamp && (
                          <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                            {formatStaffDateTime(alert.timestamp)}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onNavigate({ name: alert.action_route })}
                      className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
                    >
                      {alert.action_label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Library Announcements Preview */}
      <section
        aria-labelledby="librarian-announcements-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <h2
              id="librarian-announcements-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Library Announcements
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'librarian-announcements' })}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
          >
            {permissions.can_manage_announcements && (
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Manage Announcements</span>
          </button>
        </div>

        <div className="mt-4 flex-1">
          {announcementsSection.isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-24 rounded-xl bg-slate-100" />
              <div className="h-24 rounded-xl bg-slate-100" />
            </div>
          ) : announcementsSection.error ? (
            <SectionErrorBox
              title="Unable to load announcements"
              message={announcementsSection.error}
              onRetry={announcementsSection.onRetry}
            />
          ) : !announcementsSection.data || announcementsSection.data.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              No active library announcements posted.
            </div>
          ) : (
            <div className="space-y-3">
              {announcementsSection.data.map((ann) => (
                <article
                  key={ann.announcement_id}
                  className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-display text-sm font-bold text-[#142B4A]">
                      {ann.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${
                        ann.status === 'Attention Required'
                          ? 'bg-amber-100 text-amber-800'
                          : ann.status === 'Published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {ann.status}
                    </span>
                  </div>
                  <p className="mt-1.5 leading-relaxed text-[#1E293B]">{ann.description}</p>
                  <p className="mt-2 text-[11px] text-[#64748B]">
                    {ann.author_department} ·{' '}
                    <span className="font-mono-tabular">{ann.published_at}</span>
                  </p>
                </article>
              ))}
              {!permissions.can_manage_announcements && (
                <p className="text-[11px] text-[#64748B]">
                  Publishing or editing official announcements requires admin-assigned permissions.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getStudentActivityIcon(type: StudentActivityType) {
  switch (type) {
    case 'new_registration':
      return <UserPlus className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />;
    case 'borrowing':
      return <Repeat className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />;
    case 'return':
      return <RotateCcw className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />;
    case 'reservation':
      return <BookmarkCheck className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />;
    case 'feedback':
      return <MessageSquare className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />;
  }
}

export function StudentActivityAndAnalyticsRow({
  activitySection,
  analyticsSection,
  permissions,
  onNavigate,
}: {
  activitySection: SectionState<StudentActivityPayload>;
  analyticsSection: SectionState<LibrarianAnalyticsPayload>;
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
}) {
  const authorizedActivity = activitySection.data
    ? filterAuthorizedStudentActivity(activitySection.data.items, permissions)
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Recent Student Activity */}
      <section
        aria-labelledby="librarian-student-activity-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <h2
              id="librarian-student-activity-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Recent Student Activity
            </h2>
          </div>
          {permissions.can_view_student_records && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-students' })}
              className="text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              Student Records
            </button>
          )}
        </div>

        <div className="mt-4 flex-1">
          {!permissions.can_view_student_records ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              Student activity viewing is restricted for your staff role.
            </div>
          ) : activitySection.isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="h-14 rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : activitySection.error ? (
            <SectionErrorBox
              title="Unable to load student activity"
              message={activitySection.error}
              onRetry={activitySection.onRetry}
            />
          ) : authorizedActivity.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              No recent student library events recorded.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {authorizedActivity.map((item) => (
                <li key={item.activity_id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC]">
                    {getStudentActivityIcon(item.type)}
                  </span>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-semibold text-[#142B4A]">
                      {item.student_name}{' '}
                      <span className="font-mono-tabular font-normal text-[#64748B]">
                        ({item.student_code})
                      </span>
                    </p>
                    <p className="mt-0.5 text-[#1E293B]">{item.summary}</p>
                    <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                      {formatStaffDateTime(item.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Reports & Analytics Preview */}
      <section
        aria-labelledby="librarian-analytics-preview-heading"
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            <div>
              <h2
                id="librarian-analytics-preview-heading"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                Reports &amp; Analytics Preview
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Monthly circulation volume and top-demand categories.
              </p>
            </div>
          </div>

          {permissions.can_view_reports && (
            <button
              type="button"
              onClick={() => onNavigate({ name: 'librarian-reports' })}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
            >
              <span>View Reports</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-4 flex-1">
          {!permissions.can_view_reports ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
              Circulation analytics are restricted by your assigned librarian permissions.
            </div>
          ) : analyticsSection.isLoading ? (
            <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
          ) : analyticsSection.error ? (
            <SectionErrorBox
              title="Unable to load circulation analytics"
              message={analyticsSection.error}
              onRetry={analyticsSection.onRetry}
            />
          ) : !analyticsSection.data || !analyticsSection.data.has_sufficient_data ? (
            <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center text-xs text-[#64748B]">
              Insufficient circulation records yet to display monthly borrowing trends.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Top Monthly KPI Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[#64748B]">Issued This Month</p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-[#142B4A]">
                    {analyticsSection.data.books_issued_this_month}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[#64748B]">Returned This Month</p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-emerald-700">
                    {analyticsSection.data.books_returned_this_month}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2.5">
                  <p className="text-[11px] font-medium text-[#64748B]">Reservations</p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-[#2563EB]">
                    {analyticsSection.data.reservation_activity_this_month}
                  </p>
                </div>
              </div>

              {/* Monthly Borrowing Bar Chart + Category Breakdown */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-4">
                  <div className="mb-3 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[#142B4A]">
                      Monthly Issued vs Returned
                    </span>
                    <span className="flex items-center gap-2 text-[#64748B]">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-xs bg-[#2563EB]" /> Issued
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-xs bg-[#142B4A]" /> Returned
                      </span>
                    </span>
                  </div>

                  {(() => {
                    const points = analyticsSection.data.monthly_borrowing_activity;
                    const maxVal = Math.max(
                      1,
                      ...points.map((p) => Math.max(p.issued, p.returned))
                    );
                    return (
                      <div
                        role="img"
                        aria-label="Monthly books issued and returned bar chart"
                        className="grid grid-cols-6 items-end gap-2 pt-2"
                      >
                        {points.map((pt) => {
                          const issuedH = Math.max(10, Math.round((pt.issued / maxVal) * 100));
                          const returnedH = Math.max(
                            10,
                            Math.round((pt.returned / maxVal) * 100)
                          );
                          return (
                            <div key={pt.month} className="flex flex-col items-center gap-1">
                              <span className="font-mono-tabular text-[10px] font-semibold text-[#142B4A]">
                                {pt.issued}
                              </span>
                              <div className="flex h-20 w-full items-end justify-center gap-1">
                                <div
                                  className="w-2.5 rounded-t bg-[#2563EB]"
                                  style={{ height: `${issuedH}%` }}
                                />
                                <div
                                  className="w-2.5 rounded-t bg-[#142B4A]"
                                  style={{ height: `${returnedH}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-[#64748B]">
                                {pt.month}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Most Borrowed Categories */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-[#142B4A]">
                    Most Borrowed Categories
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {(() => {
                      const cats = analyticsSection.data.most_borrowed_categories;
                      const maxCat = Math.max(1, ...cats.map((c) => c.borrow_count));
                      return cats.map((cat) => {
                        const pct = Math.round((cat.borrow_count / maxCat) * 100);
                        return (
                          <div key={cat.category} className="text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium text-[#1E293B]">
                                {cat.category}
                              </span>
                              <span className="font-mono-tabular text-[#64748B]">
                                {cat.borrow_count}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-[#2563EB]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

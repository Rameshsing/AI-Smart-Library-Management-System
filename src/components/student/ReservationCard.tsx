import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Hourglass,
  MapPin,
  XCircle,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatPeopleAheadLabel,
  formatPickupCountdownLabel,
  formatReservationDate,
  isReservationExpiringSoon,
  type ReservationRecord,
  type ReservationStatus,
  type ReservationWorkflowMode,
} from '../../utils/reservationsPage';

interface ReservationCardProps {
  reservation: ReservationRecord;
  referenceDate: Date;
  workflowMode: ReservationWorkflowMode;
  onOpenDetails: (reservation: ReservationRecord) => void;
  onRequestCancel: (reservation: ReservationRecord) => void;
  onRequestCollect?: (reservation: ReservationRecord) => void;
  onNavigate: (route: AppRoute) => void;
}

function getStatusBadgeConfig(status: ReservationStatus): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'Ready for Pickup':
      return {
        label: 'Ready for Pickup — Available',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />,
      };
    case 'Waiting':
      return {
        label: 'Waiting in Queue',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        icon: <Hourglass className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />,
      };
    case 'Borrowed':
      return {
        label: 'Borrowed',
        className: 'border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]',
        icon: <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />,
      };
    case 'Completed':
      return {
        label: 'Completed',
        className: 'border-slate-200 bg-slate-100 text-[#142B4A]',
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#142B4A]" aria-hidden="true" />,
      };
    case 'Cancelled':
      return {
        label: 'Cancelled',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
        icon: <XCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />,
      };
    case 'Expired':
      return {
        label: 'Expired',
        className: 'border-red-200 bg-red-50 text-red-700',
        icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden="true" />,
      };
  }
}

export function ReservationCard({
  reservation,
  referenceDate,
  workflowMode,
  onOpenDetails,
  onRequestCancel,
  onRequestCollect,
  onNavigate,
}: ReservationCardProps) {
  const [imageError, setImageError] = useState(false);

  const badge = getStatusBadgeConfig(reservation.status);
  const expiringSoon = isReservationExpiringSoon(reservation, referenceDate);
  const pickupCountdown =
    reservation.status === 'Ready for Pickup'
      ? formatPickupCountdownLabel(reservation.pickup_deadline, referenceDate)
      : null;
  const peopleAheadText =
    reservation.status === 'Waiting'
      ? formatPeopleAheadLabel(reservation.queue_position)
      : null;

  const bookRoute: AppRoute = {
    name: 'book-detail',
    slug: String(reservation.book_id),
  };

  return (
    <article
      aria-label={`${reservation.title} reservation card`}
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-colors hover:border-[#2563EB]/40"
    >
      <div className="space-y-4">
        {/* Top Row: Cover + Title + Status */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => onNavigate(bookRoute)}
            aria-label={`View book details for ${reservation.title}`}
            className="group relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-linear-to-br from-[#142B4A] to-[#2563EB] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            {reservation.cover_image && !imageError ? (
              <img
                src={reservation.cover_image}
                alt={`Cover of ${reservation.title}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-white">
                <BookOpen className="h-5 w-5 opacity-80" aria-hidden="true" />
                <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight">
                  {reservation.title}
                </span>
              </div>
            )}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
              >
                {badge.icon}
                <span>{badge.label}</span>
              </span>

              <span className="font-mono-tabular text-[11px] font-medium text-[#64748B]">
                {reservation.reference_code}
              </span>
            </div>

            <h3 className="font-display text-base font-bold leading-snug text-[#142B4A]">
              <button
                type="button"
                onClick={() => onNavigate(bookRoute)}
                className="text-left transition-colors hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
              >
                {reservation.title}
              </button>
            </h3>

            <p className="text-xs font-medium text-[#64748B]">
              by <span className="text-[#1E293B]">{reservation.author}</span>
            </p>

            <p className="text-xs text-[#64748B]">
              {reservation.category} · {reservation.subject}
            </p>
          </div>
        </div>

        {/* Status-Specific Highlight Banner */}
        {reservation.status === 'Ready for Pickup' && (
          <div
            className={`rounded-lg border p-3.5 text-xs ${
              expiringSoon
                ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                : 'border-emerald-200 bg-emerald-50/75 text-emerald-950'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">
                Your reserved copy of {reservation.title} is now available.
              </p>
              {pickupCountdown && (
                <span
                  className={`font-mono-tabular shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    expiringSoon
                      ? 'bg-amber-200/70 text-amber-950'
                      : 'bg-emerald-200/70 text-emerald-950'
                  }`}
                >
                  {pickupCountdown}
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-2">
              {reservation.pickup_deadline && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                  <span>
                    Collect by{' '}
                    <strong className="font-mono-tabular">
                      {formatReservationDate(reservation.pickup_deadline)}
                    </strong>
                  </span>
                </div>
              )}
              {reservation.location_summary && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                  <span className="truncate">{reservation.location_summary}</span>
                </div>
              )}
            </div>

            <p className="mt-2 text-[11px] font-medium opacity-90">
              {workflowMode === 'student_borrow' && reservation.can_collect_online
                ? 'Confirm collection online or visit the library circulation desk before your hold expires.'
                : 'Visit Library to Collect — bring your Student ID to the circulation desk before the pickup deadline.'}
            </p>
          </div>
        )}

        {reservation.status === 'Waiting' && (
          <div className="rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[#64748B]">Queue Position:</span>
                <span className="font-mono-tabular rounded-md bg-[#DBEAFE] px-2 py-0.5 text-xs font-bold text-[#142B4A]">
                  {reservation.queue_position !== null ? `#${reservation.queue_position}` : 'Queued'}
                </span>
              </div>
              {peopleAheadText && (
                <span className="text-[11px] font-medium text-[#1E293B]">
                  {peopleAheadText}
                </span>
              )}
            </div>

            {reservation.estimated_availability && (
              <p className="mt-2 text-[11px] text-[#64748B]">
                {reservation.estimated_availability}
              </p>
            )}
          </div>
        )}

        {/* Metadata Strip */}
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 bg-[#F5F8FC] px-3.5 py-2.5 text-xs sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
              <Calendar className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
              <span>Reserved On</span>
            </dt>
            <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
              {formatReservationDate(reservation.reservation_date)}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-medium text-[#64748B]">Copy Status</dt>
            <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
              {reservation.available_copies} of {reservation.total_copies} available
            </dd>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <dt className="text-[11px] font-medium text-[#64748B]">
              {reservation.status === 'Ready for Pickup'
                ? 'Ready Since'
                : reservation.status === 'Completed' || reservation.status === 'Borrowed'
                  ? 'Collected On'
                  : reservation.status === 'Cancelled'
                    ? 'Cancelled On'
                    : reservation.status === 'Expired'
                      ? 'Expired On'
                      : 'Location'}
            </dt>
            <dd className="mt-0.5 truncate font-semibold text-[#142B4A]">
              {reservation.status === 'Ready for Pickup' ? (
                <span className="font-mono-tabular">
                  {formatReservationDate(reservation.ready_date)}
                </span>
              ) : reservation.status === 'Completed' || reservation.status === 'Borrowed' ? (
                <span className="font-mono-tabular">
                  {formatReservationDate(reservation.fulfilled_date)}
                </span>
              ) : reservation.status === 'Cancelled' ? (
                <span className="font-mono-tabular">
                  {formatReservationDate(reservation.cancelled_date)}
                </span>
              ) : reservation.status === 'Expired' ? (
                <span className="font-mono-tabular">
                  {formatReservationDate(reservation.expired_date)}
                </span>
              ) : (
                <span>{reservation.location_summary ?? 'Main Library'}</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate(bookRoute)}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View Book</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDetails(reservation)}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>View Details</span>
          </button>

          {reservation.status === 'Ready for Pickup' &&
            workflowMode === 'student_borrow' &&
            reservation.can_collect_online &&
            onRequestCollect && (
              <button
                type="button"
                onClick={() => onRequestCollect(reservation)}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#142B4A] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1E3A63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Borrow / Collect</span>
              </button>
            )}
        </div>

        {reservation.can_cancel && (
          <button
            type="button"
            onClick={() => onRequestCancel(reservation)}
            className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 whitespace-nowrap cursor-pointer"
          >
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cancel Reservation</span>
          </button>
        )}
      </div>
    </article>
  );
}

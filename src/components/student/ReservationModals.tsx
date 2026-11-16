import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  X,
  XCircle,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatPeopleAheadLabel,
  formatPickupCountdownLabel,
  formatReservationDate,
  isReservationExpiringSoon,
  type ReservationRecord,
  type ReservationWorkflowMode,
} from '../../utils/reservationsPage';

interface ReservationDetailsModalProps {
  reservation: ReservationRecord | null;
  referenceDate: Date;
  workflowMode: ReservationWorkflowMode;
  onClose: () => void;
  onRequestCancel: (reservation: ReservationRecord) => void;
  onRequestCollect?: (reservation: ReservationRecord) => void;
  onNavigate: (route: AppRoute) => void;
}

export function ReservationDetailsModal({
  reservation,
  referenceDate,
  workflowMode,
  onClose,
  onRequestCancel,
  onRequestCollect,
  onNavigate,
}: ReservationDetailsModalProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [reservation?.reservation_id]);

  useEffect(() => {
    if (!reservation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reservation, onClose]);

  if (!reservation) return null;

  const peopleAheadText =
    reservation.status === 'Waiting'
      ? formatPeopleAheadLabel(reservation.queue_position)
      : null;
  const expiringSoon = isReservationExpiringSoon(reservation, referenceDate);
  const pickupCountdown =
    reservation.status === 'Ready for Pickup'
      ? formatPickupCountdownLabel(reservation.pickup_deadline, referenceDate)
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-details-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="reservation-details-modal-title"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                Reservation Details
              </h2>
              <p className="font-mono-tabular text-xs text-[#64748B]">
                Reference {reservation.reference_code}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation details modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Book Overview */}
          <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-linear-to-br from-[#142B4A] to-[#2563EB]">
              {reservation.cover_image && !imageError ? (
                <img
                  src={reservation.cover_image}
                  alt={`Cover of ${reservation.title}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-white">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2563EB]">
                {reservation.category} · {reservation.subject}
              </p>
              <h3 className="font-display text-base font-bold text-[#142B4A]">
                {reservation.title}
              </h3>
              <p className="text-xs text-[#64748B]">
                by <span className="font-medium text-[#1E293B]">{reservation.author}</span>
              </p>
            </div>
          </div>

          {/* Structured Fields */}
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-medium text-[#64748B]">Current Status</dt>
              <dd className="mt-1 text-sm font-bold text-[#142B4A]">{reservation.status}</dd>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>Reservation Date</span>
              </dt>
              <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                {formatReservationDate(reservation.reservation_date)}
              </dd>
            </div>

            {reservation.status === 'Waiting' && (
              <>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-[11px] font-medium text-[#64748B]">Queue Position</dt>
                  <dd className="font-mono-tabular mt-1 text-sm font-bold text-[#2563EB]">
                    {reservation.queue_position !== null
                      ? `#${reservation.queue_position}`
                      : 'Queued'}
                  </dd>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <dt className="text-[11px] font-medium text-[#64748B]">Queue Ahead</dt>
                  <dd className="mt-1 text-sm font-semibold text-[#142B4A]">
                    {peopleAheadText ?? 'Calculated on server'}
                  </dd>
                </div>
              </>
            )}

            {reservation.ready_date && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <dt className="text-[11px] font-medium text-[#64748B]">Ready for Pickup Since</dt>
                <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                  {formatReservationDate(reservation.ready_date)}
                </dd>
              </div>
            )}

            {reservation.pickup_deadline && (
              <div
                className={`rounded-lg border px-4 py-3 ${
                  expiringSoon
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                  <Clock className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>Pickup Deadline</span>
                </dt>
                <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                  {formatReservationDate(reservation.pickup_deadline)}
                  {pickupCountdown && (
                    <span className="ml-2 text-xs font-medium text-amber-800">
                      ({pickupCountdown})
                    </span>
                  )}
                </dd>
              </div>
            )}

            {reservation.fulfilled_date && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <dt className="text-[11px] font-medium text-[#64748B]">Collection / Issue Date</dt>
                <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                  {formatReservationDate(reservation.fulfilled_date)}
                </dd>
              </div>
            )}

            {reservation.cancelled_date && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <dt className="text-[11px] font-medium text-[#64748B]">Cancelled Date</dt>
                <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                  {formatReservationDate(reservation.cancelled_date)}
                </dd>
              </div>
            )}

            {reservation.expired_date && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <dt className="text-[11px] font-medium text-[#64748B]">Expired Date</dt>
                <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                  {formatReservationDate(reservation.expired_date)}
                </dd>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-medium text-[#64748B]">Copy Availability</dt>
              <dd className="font-mono-tabular mt-1 text-sm font-semibold text-[#142B4A]">
                {reservation.available_copies} of {reservation.total_copies} copies available
              </dd>
            </div>

            {reservation.location_summary && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                  <MapPin className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>Library Desk / Shelf</span>
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#142B4A]">
                  {reservation.location_summary}
                </dd>
              </div>
            )}
          </dl>

          {reservation.estimated_availability && (
            <div className="rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-xs text-[#1E293B]">
              <strong className="font-semibold text-[#142B4A]">Estimated Availability: </strong>
              {reservation.estimated_availability}
            </div>
          )}

          {reservation.instructions && (
            <div className="rounded-lg border border-slate-200 bg-[#F5F8FC] px-4 py-3 text-xs leading-relaxed text-[#1E293B]">
              <strong className="font-semibold text-[#142B4A]">Library Instructions: </strong>
              {reservation.instructions}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate({ name: 'book-detail', slug: String(reservation.book_id) });
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Book</span>
            </button>

            {reservation.status === 'Ready for Pickup' &&
              workflowMode === 'student_borrow' &&
              reservation.can_collect_online &&
              onRequestCollect && (
                <button
                  type="button"
                  onClick={() => onRequestCollect(reservation)}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A63] whitespace-nowrap cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Borrow / Collect</span>
                </button>
              )}

            {reservation.can_cancel && (
              <button
                type="button"
                onClick={() => onRequestCancel(reservation)}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cancel Reservation</span>
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

interface CancelReservationModalProps {
  reservation: ReservationRecord | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: (reservation: ReservationRecord) => void;
  onClose: () => void;
}

export function CancelReservationModal({
  reservation,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: CancelReservationModalProps) {
  useEffect(() => {
    if (!reservation) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reservation, isSubmitting, onClose]);

  if (!reservation) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-reservation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="cancel-reservation-modal-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Cancel this reservation?
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close cancel reservation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 space-y-1.5">
            <p className="text-xs font-medium text-[#64748B]">
              Reservation <span className="font-mono-tabular">{reservation.reference_code}</span>
            </p>
            <p className="text-sm font-bold text-[#142B4A]">{reservation.title}</p>
            <p className="text-xs text-[#64748B]">by {reservation.author}</p>
          </div>

          <p className="text-sm leading-relaxed text-[#1E293B]">
            You will lose your current position in the waiting queue.
          </p>

          {reservation.status === 'Ready for Pickup' && (
            <p className="text-xs leading-relaxed text-[#64748B]">
              Cancelling this hold immediately releases the available copy to the next eligible
              student in the queue.
            </p>
          )}

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
            Keep Reservation
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reservation)}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Cancel Reservation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { AlertCircle, Bookmark, BookOpen, Calendar, Loader2, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/bookDetails';

interface BorrowConfirmationModalProps {
  isOpen: boolean;
  bookTitle: string;
  issueDateIso: string;
  dueDateIso: string;
  loanPeriodDays: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function BorrowConfirmationModal({
  isOpen,
  bookTitle,
  issueDateIso,
  dueDateIso,
  loanPeriodDays,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: BorrowConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="borrow-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="borrow-modal-title" className="font-display text-lg font-bold text-[#142B4A]">
              Confirm Borrowing
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close borrow confirmation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 space-y-3">
            <div>
              <p className="text-xs font-medium text-[#64748B]">Book</p>
              <p className="mt-0.5 text-sm font-semibold text-[#142B4A]">{bookTitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
                  <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>Issue Date</span>
                </p>
                <p className="font-mono-tabular mt-0.5 text-sm font-semibold text-[#142B4A]">
                  {formatDisplayDate(issueDateIso)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
                  <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>Due Date</span>
                </p>
                <p className="font-mono-tabular mt-0.5 text-sm font-semibold text-[#142B4A]">
                  {formatDisplayDate(dueDateIso)}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#64748B]">
            Calculated using the configured {loanPeriodDays}-day library loan period. Your active
            account status, borrowing limit, and live copy availability are verified on the server
            before issuing.
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
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Confirm Borrowing</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReserveConfirmationModalProps {
  isOpen: boolean;
  bookTitle: string;
  availabilityLabel: string;
  expectedQueuePosition: number | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ReserveConfirmationModal({
  isOpen,
  bookTitle,
  availabilityLabel,
  expectedQueuePosition,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}: ReserveConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 id="reserve-modal-title" className="font-display text-lg font-bold text-[#142B4A]">
              Reserve Book
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close reservation confirmation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 space-y-2.5">
            <div>
              <p className="text-xs font-medium text-[#64748B]">Book</p>
              <p className="mt-0.5 text-sm font-semibold text-[#142B4A]">{bookTitle}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-xs">
              <span className="text-[#64748B]">
                Current status: <strong className="text-[#142B4A]">{availabilityLabel}</strong>
              </span>
              {expectedQueuePosition !== null && (
                <span className="font-mono-tabular font-semibold text-[#2563EB]">
                  Queue position #{expectedQueuePosition}
                </span>
              )}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#1E293B]">
            You will be notified when a copy becomes available for pickup.
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
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A63] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Confirm Reservation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

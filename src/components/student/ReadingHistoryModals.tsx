import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Star,
  X,
} from 'lucide-react';
import { validateReviewInput } from '../../utils/bookDetails';
import { formatHistoryDate, type ReadingHistoryRecord } from '../../utils/readingHistory';

interface HistoryBookDetailsModalProps {
  record: ReadingHistoryRecord | null;
  onClose: () => void;
  onViewBook: (bookId: number) => void;
  onOpenRateModal: (record: ReadingHistoryRecord) => void;
}

export function HistoryBookDetailsModal({
  record,
  onClose,
  onViewBook,
  onOpenRateModal,
}: HistoryBookDetailsModalProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [record?.borrowing_id]);

  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, onClose]);

  if (!record) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            </span>
            <h2
              id="history-detail-modal-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Borrowing Record Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close borrowing details modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Book Header */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex h-40 w-28 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC] p-2">
              {!imageError ? (
                <img
                  src={record.cover_image}
                  alt={`Cover of ${record.title}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="h-full w-auto rounded object-contain shadow-xs"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-2 text-center text-white">
                  <BookOpen className="h-5 w-5 text-[#DBEAFE]" aria-hidden="true" />
                  <span className="mt-1.5 line-clamp-3 text-[10px] font-semibold">
                    {record.title}
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <span className="font-semibold text-[#2563EB]">{record.category}</span>
                {record.subject && record.subject !== record.category && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{record.subject}</span>
                  </>
                )}
              </div>

              <h3 className="font-display mt-1 text-lg font-bold leading-snug text-[#142B4A]">
                {record.title}
              </h3>
              <p className="mt-0.5 text-sm font-medium text-[#64748B]">{record.author}</p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#64748B]">
                <span>
                  ISBN:{' '}
                  <strong className="font-mono-tabular font-semibold text-[#142B4A]">
                    {record.isbn}
                  </strong>
                </span>
                <span>
                  Copy ID:{' '}
                  <strong className="font-mono-tabular font-semibold text-[#142B4A]">
                    {record.copy_barcode}
                  </strong>
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Status: {record.status}</span>
                </span>
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-[#F5F8FC] px-2.5 py-0.5 text-[11px] font-medium text-[#142B4A]">
                  {record.availability_label}
                </span>
              </div>
            </div>
          </div>

          {/* Dates & Duration Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 sm:grid-cols-4">
            <div>
              <p className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
                <Calendar className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>Issue Date</span>
              </p>
              <p className="font-mono-tabular mt-1 text-xs font-semibold text-[#142B4A]">
                {formatHistoryDate(record.issue_date)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
                <Calendar className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                <span>Due Date</span>
              </p>
              <p className="font-mono-tabular mt-1 text-xs font-semibold text-[#142B4A]">
                {formatHistoryDate(record.due_date)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                <span>Returned On</span>
              </p>
              <p className="font-mono-tabular mt-1 text-xs font-semibold text-[#142B4A]">
                {formatHistoryDate(record.return_date)}
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
                <Clock className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>Loan Duration</span>
              </p>
              <p className="font-mono-tabular mt-1 text-xs font-semibold text-[#142B4A]">
                {record.loan_duration_days} {record.loan_duration_days === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>

          {/* Student Rating & Review */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-sm font-bold text-[#142B4A]">
                Your Rating &amp; Review
              </h4>
              <span className="text-xs font-medium text-[#64748B]">{record.review_status}</span>
            </div>

            {record.student_rating !== null ? (
              <div className="mt-2.5 space-y-2">
                <div
                  className="flex items-center gap-1"
                  aria-label={`Your rating: ${record.student_rating} out of 5 stars`}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= record.student_rating!
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                      aria-hidden="true"
                    />
                  ))}
                  <span className="font-mono-tabular ml-1.5 text-xs font-semibold text-[#142B4A]">
                    {record.student_rating} / 5
                  </span>
                </div>
                {record.student_review ? (
                  <p className="text-sm leading-relaxed text-[#1E293B]">
                    &ldquo;{record.student_review}&rdquo;
                  </p>
                ) : (
                  <p className="text-xs text-[#64748B]">
                    Star rating submitted without written review text.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[#64748B]">
                You haven&apos;t rated this book yet. Sharing a rating helps refine your personalised
                recommendations.
              </p>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {record.can_review && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRateModal(record);
                }}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#2563EB] bg-white px-4 py-2 text-xs font-semibold text-[#2563EB] hover:bg-[#DBEAFE]/40 cursor-pointer"
              >
                <Star className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{record.student_rating !== null ? 'Edit Rating & Review' : 'Rate & Review'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const bookId = record.book_id;
                onClose();
                onViewBook(bookId);
              }}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <span>{record.can_borrow_again ? 'Borrow Again / View Book' : 'View Availability'}</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HistoryRateReviewModalProps {
  record: ReadingHistoryRecord | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (record: ReadingHistoryRecord, rating: number, reviewText: string) => void;
  onClose: () => void;
}

export function HistoryRateReviewModal({
  record,
  isSubmitting,
  errorMessage,
  onSubmit,
  onClose,
}: HistoryRateReviewModalProps) {
  const [selectedRating, setSelectedRating] = useState<number>(record?.student_rating ?? 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(record?.student_review ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRating(record?.student_rating ?? 0);
    setReviewText(record?.student_review ?? '');
    setHoverRating(0);
    setValidationError(null);
  }, [record]);

  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, isSubmitting, onClose]);

  if (!record) return null;

  const isEditing = record.student_rating !== null;
  const displayedRating = hoverRating || selectedRating;

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validateReviewInput(selectedRating, reviewText, false);
    if (!validation.valid) {
      setValidationError(validation.error ?? 'Please select a star rating between 1 and 5.');
      return;
    }
    setValidationError(null);
    onSubmit(record, selectedRating, reviewText.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-rate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={isSubmitting ? undefined : onClose}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Star className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            </span>
            <h2 id="history-rate-modal-title" className="font-display text-lg font-bold text-[#142B4A]">
              {isEditing ? 'Update Rating & Review' : 'Rate this book'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close rating modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] disabled:opacity-50 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5">
            <p className="font-display text-sm font-bold text-[#142B4A]">{record.title}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {record.author} · Returned {formatHistoryDate(record.return_date)}
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#142B4A]">
              Your Star Rating <span className="text-red-600">*</span>
            </span>
            <div
              role="radiogroup"
              aria-label="Rate this book from 1 to 5 stars"
              className="mt-2 flex items-center gap-1.5"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={selectedRating === star}
                  aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => {
                    setSelectedRating(star);
                    setValidationError(null);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC] transition-colors hover:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= displayedRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
              {selectedRating > 0 && (
                <span className="font-mono-tabular ml-2 text-xs font-semibold text-[#142B4A]">
                  {selectedRating} / 5
                </span>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="history-review-textarea"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Written Review (optional)
            </label>
            <textarea
              id="history-review-textarea"
              rows={3}
              maxLength={1000}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share how useful this book was for your coursework or study..."
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>

          {(validationError || errorMessage) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{validationError ?? errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{isEditing ? 'Save Review Changes' : 'Submit Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  Star,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { getBookAvailabilityInfo } from '../../utils/bookCatalog';
import {
  calculateDueDateIso,
  createSampleBookDetailData,
  formatDisplayDate,
  toIsoDateString,
  type BookDetailPayload,
} from '../../utils/bookDetails';
import { BorrowConfirmationModal, ReserveConfirmationModal } from './BookActionModals';
import { BookRatingsSection } from './BookRatingsSection';
import { CatalogBookCard } from './CatalogBookCard';

interface BookDetailsPageProps {
  bookIdentifier: string;
  isStudentContext: boolean;
  onNavigate: (route: AppRoute) => void;
}

interface ConfirmedBorrowResult {
  bookTitle: string;
  issueDate: string;
  dueDate: string;
}

function BookDetailsSkeleton() {
  return (
    <div aria-label="Loading book details" className="space-y-6 animate-pulse">
      <div className="h-5 w-64 rounded bg-slate-200" />
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="h-96 rounded-xl bg-slate-100 md:col-span-4" />
          <div className="space-y-4 md:col-span-8">
            <div className="h-8 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-100" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded bg-slate-100" />
              ))}
            </div>
            <div className="h-40 rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookDetailsPage({
  bookIdentifier,
  isStudentContext,
  onNavigate,
}: BookDetailsPageProps) {
  const [data, setData] = useState<BookDetailPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [coverError, setCoverError] = useState<boolean>(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState<boolean>(false);
  const [metadataExpanded, setMetadataExpanded] = useState<boolean>(true);

  const [borrowModalOpen, setBorrowModalOpen] = useState<boolean>(false);
  const [reserveModalOpen, setReserveModalOpen] = useState<boolean>(false);
  const [isSubmittingBorrow, setIsSubmittingBorrow] = useState<boolean>(false);
  const [isSubmittingReserve, setIsSubmittingReserve] = useState<boolean>(false);
  const [isCancellingReserve, setIsCancellingReserve] = useState<boolean>(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [cancelReserveError, setCancelReserveError] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmedBorrow, setConfirmedBorrow] = useState<ConfirmedBorrowResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    const apiBaseUrl = getApiBaseUrl();
    const backendConnected = isBackendConnected();

    async function fetchBookDetails() {
      setIsLoading(true);
      setNotFound(false);
      setErrorMessage(null);
      setCoverError(false);
      setDescriptionExpanded(false);
      setConfirmedBorrow(null);
      setBorrowError(null);
      setReserveError(null);
      setCancelReserveError(null);
      setReviewError(null);

      if (backendConnected) {
        try {
          const response = await fetch(
            `${apiBaseUrl}/api/books/${encodeURIComponent(bookIdentifier)}`,
            {
              method: 'GET',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            }
          );

          if (response.status === 404) {
            if (isMounted) {
              setNotFound(true);
              setIsLoading(false);
            }
            return;
          }

          if (!response.ok) {
            throw new Error(`Unable to fetch book (${response.status}).`);
          }

          const payload = (await response.json()) as BookDetailPayload;
          if (isMounted) {
            setData({ ...payload, is_prototype_sample: false });
            setIsLoading(false);
          }
          return;
        } catch (err) {
          if (isMounted) {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : 'Something went wrong while loading this book.'
            );
            setIsLoading(false);
          }
          return;
        }
      }

      // Development / prototype mode when VITE_API_BASE_URL is not configured
      await new Promise((resolve) => window.setTimeout(resolve, 110));
      const sample = createSampleBookDetailData(bookIdentifier, {
        isAuthenticated: isStudentContext,
      });

      if (!isMounted) return;
      if (!sample) {
        setNotFound(true);
      } else {
        setData(sample);
      }
      setIsLoading(false);
    }

    void fetchBookDetails();
    return () => {
      isMounted = false;
    };
  }, [bookIdentifier, isStudentContext, reloadNonce]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmittingBorrow) setBorrowModalOpen(false);
        if (!isSubmittingReserve) setReserveModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSubmittingBorrow, isSubmittingReserve]);

  const browseRoute: AppRoute = isStudentContext ? { name: 'student-search' } : { name: 'books' };

  const handleConfirmBorrow = async () => {
    if (!data) return;
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setBorrowError(
        'Backend API is not connected. Real borrowing transactions require server verification via POST /api/borrowings.'
      );
      return;
    }

    setIsSubmittingBorrow(true);
    setBorrowError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/borrowings`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ book_id: data.book.book_id }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        issue_date?: string;
        due_date?: string;
        transaction_id?: number;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? body.message ?? `Borrowing request failed (${response.status}).`
        );
      }

      const todayIso = body.issue_date ?? toIsoDateString(new Date());
      const dueIso =
        body.due_date ?? calculateDueDateIso(new Date(), data.loan_period_days);

      setConfirmedBorrow({
        bookTitle: data.book.title,
        issueDate: todayIso,
        dueDate: dueIso,
      });
      setBorrowModalOpen(false);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setBorrowError(
        err instanceof Error
          ? err.message
          : 'Unable to complete borrowing right now. Please try again.'
      );
    } finally {
      setIsSubmittingBorrow(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (!data) return;
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setReserveError(
        'Backend API is not connected. Reservations require server storage and queue verification via POST /api/reservations.'
      );
      return;
    }

    setIsSubmittingReserve(true);
    setReserveError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/reservations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ book_id: data.book.book_id }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? body.message ?? `Reservation request failed (${response.status}).`
        );
      }

      setReserveModalOpen(false);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setReserveError(
        err instanceof Error
          ? err.message
          : 'Unable to place reservation right now. Please try again.'
      );
    } finally {
      setIsSubmittingReserve(false);
    }
  };

  const handleCancelReservation = async (reservationId: number) => {
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setCancelReserveError(
        'Backend API is not connected. Cancelling a reservation requires server verification via DELETE /api/reservations.'
      );
      return;
    }

    setIsCancellingReserve(true);
    setCancelReserveError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/reservations/${encodeURIComponent(String(reservationId))}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? body.message ?? `Unable to cancel reservation (${response.status}).`
        );
      }

      setReloadNonce((n) => n + 1);
    } catch (err) {
      setCancelReserveError(
        err instanceof Error ? err.message : 'Failed to cancel reservation.'
      );
    } finally {
      setIsCancellingReserve(false);
    }
  };

  const handleSubmitReview = async (rating: number, reviewText: string) => {
    if (!data) return;
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setReviewError(
        'Backend API is not connected. Submitting ratings and reviews requires server verification via POST /api/books/<id>/reviews.'
      );
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      const method = data.student_eligibility.existing_review ? 'PUT' : 'POST';
      const response = await fetch(
        `${apiBaseUrl}/api/books/${encodeURIComponent(String(data.book.book_id))}/reviews`,
        {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ rating, review: reviewText }),
        }
      );

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? body.message ?? `Review submission failed (${response.status}).`
        );
      }

      setReloadNonce((n) => n + 1);
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : 'Unable to save your review right now.'
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return <BookDetailsSkeleton />;
  }

  if (notFound) {
    return (
      <section
        aria-label="Book not found"
        className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs sm:p-12"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F8FC]">
          <BookOpen className="h-6 w-6 text-[#2563EB]" aria-hidden="true" />
        </div>
        <h2 className="font-display mt-4 text-2xl font-bold text-[#142B4A]">Book Not Found</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">
          The book you&apos;re looking for may have been removed or is no longer available.
        </p>
        <button
          type="button"
          onClick={() => onNavigate(browseRoute)}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Library</span>
        </button>
      </section>
    );
  }

  if (errorMessage || !data) {
    return (
      <section
        role="alert"
        className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs sm:p-12"
      >
        <AlertCircle className="mx-auto h-9 w-9 text-red-600" aria-hidden="true" />
        <h2 className="font-display mt-3 text-xl font-bold text-[#142B4A]">
          Unable to Load Book
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Something went wrong while loading this book.
        </p>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
        >
          Try Again
        </button>
      </section>
    );
  }

  const { book, issued_copies, loan_period_days, student_eligibility } = data;
  const availability = getBookAvailabilityInfo(book);
  const today = new Date();
  const issueDateIso = toIsoDateString(today);
  const dueDateIso = calculateDueDateIso(today, loan_period_days);

  const isLongDescription = book.description.length > 210;
  const displayedDescription =
    isLongDescription && !descriptionExpanded
      ? `${book.description.slice(0, 210).trimEnd()}…`
      : book.description;

  const availabilityUi =
    book.available_copies > 0
      ? {
          statusTitle: 'Available',
          statusDetail:
            book.total_copies === 1
              ? 'Available now (1 copy)'
              : `${book.available_copies} of ${book.total_copies} copies available`,
          badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />,
        }
      : book.reserved_copies > 0
        ? {
            statusTitle: 'Reserved',
            statusDetail: 'Available copies are reserved',
            badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
            icon: <Bookmark className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />,
          }
        : issued_copies > 0
          ? {
              statusTitle: 'Currently Issued',
              statusDetail: 'All copies are currently issued',
              badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
              icon: <Clock className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />,
            }
          : {
              statusTitle: 'Unavailable',
              statusDetail: 'No copies currently available',
              badgeClass: 'border-red-200 bg-red-50 text-red-800',
              icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />,
            };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
        <button
          type="button"
          onClick={() => onNavigate(browseRoute)}
          className="font-medium text-[#2563EB] hover:underline cursor-pointer"
        >
          Library
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <button
          type="button"
          onClick={() => onNavigate(browseRoute)}
          className="font-medium text-[#2563EB] hover:underline cursor-pointer"
        >
          Books
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="truncate font-semibold text-[#142B4A]" aria-current="page">
          {book.title}
        </span>
      </nav>

      {/* Prototype / Backend Readiness Note */}
      {data.is_prototype_sample && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Book Record:
              </strong>{' '}
              Showing development data structured for database verification; live borrowing,
              reservations, and reviews commit via the Flask + MySQL API.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/books/{book.book_id}
          </span>
        </div>
      )}

      {/* Main Two-Column Book Information Section */}
      <section
        aria-labelledby="book-detail-title"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-8"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Large Cover + Availability Indicator */}
          <div className="flex flex-col items-center lg:col-span-4">
            <div className="flex aspect-[3/4] w-full max-w-[300px] items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] p-5">
              {!coverError && book.cover_image ? (
                <img
                  src={book.cover_image}
                  alt={`Cover of ${book.title}`}
                  referrerPolicy="no-referrer"
                  onError={() => setCoverError(true)}
                  className="h-full w-auto max-w-full rounded-md object-contain shadow-sm"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-6 text-center text-white">
                  <BookOpen className="h-12 w-12 text-[#DBEAFE]" aria-hidden="true" />
                  <p className="font-display mt-3 text-base font-bold leading-snug">
                    {book.title}
                  </p>
                  <p className="mt-1 text-xs text-[#DBEAFE]">{book.author}</p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${availabilityUi.badgeClass}`}
              >
                {availabilityUi.icon}
                <span>{availability.label}</span>
              </span>
            </div>
          </div>

          {/* Right Column: Metadata + Availability & Action Card */}
          <div className="flex flex-col justify-between space-y-6 lg:col-span-8">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2563EB]">
                <span>{book.category}</span>
                {book.subject && book.subject !== book.category && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{book.subject}</span>
                  </>
                )}
              </div>

              <h2
                id="book-detail-title"
                className="font-display mt-1.5 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl"
              >
                {book.title}
              </h2>
              <p className="mt-1 text-base font-medium text-[#64748B]">{book.author}</p>

              {/* Rating Summary Inline */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {book.rating_count > 0 ? (
                  <>
                    <div
                      className="flex items-center gap-0.5"
                      aria-label={`Rated ${book.rating_average.toFixed(1)} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= Math.round(book.rating_average)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    <span className="font-mono-tabular font-bold text-[#142B4A]">
                      {book.rating_average.toFixed(1)}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      ({book.rating_count.toLocaleString()}{' '}
                      {book.rating_count === 1 ? 'rating' : 'ratings'})
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-[#64748B]">No student ratings yet</span>
                )}
              </div>

              {/* Key Metadata Grid */}
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-4 text-xs sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-[#64748B]">Category</dt>
                  <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.category}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#64748B]">Subject</dt>
                  <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.subject}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#64748B]">Published</dt>
                  <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                    {book.publication_year}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[#64748B]">ISBN</dt>
                  <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">
                    {book.isbn}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-[#64748B]">Language</dt>
                  <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.language}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#64748B]">Format</dt>
                  <dd className="mt-0.5 font-semibold text-[#142B4A]">{book.format}</dd>
                </div>
              </dl>
            </div>

            {/* Prominent Availability & Action Card */}
            <div
              aria-label="Availability and borrowing actions"
              className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-5"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                    Availability
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    {availabilityUi.icon}
                    <span className="font-display text-lg font-bold text-[#142B4A]">
                      {availabilityUi.statusTitle}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[#1E293B]">{availabilityUi.statusDetail}</p>
                </div>

                {/* Copy Breakdown */}
                <dl className="grid grid-cols-2 gap-x-5 gap-y-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[#64748B]">Total</dt>
                    <dd className="font-mono-tabular font-bold text-[#142B4A]">
                      {book.total_copies}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">Available</dt>
                    <dd className="font-mono-tabular font-bold text-emerald-700">
                      {book.available_copies}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">Issued</dt>
                    <dd className="font-mono-tabular font-bold text-[#142B4A]">{issued_copies}</dd>
                  </div>
                  <div>
                    <dt className="text-[#64748B]">Reserved</dt>
                    <dd className="font-mono-tabular font-bold text-amber-700">
                      {book.reserved_copies}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Action Workflows */}
              <div className="mt-5 border-t border-slate-200 pt-4">
                {confirmedBorrow ? (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <h3 className="font-display text-sm font-bold text-emerald-900">
                          Book Borrowed Successfully
                        </h3>
                        <p className="mt-0.5 text-xs text-emerald-800">
                          Your book has been added to My Books.
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                          <div>
                            <span className="text-emerald-700">Book:</span>{' '}
                            <strong className="text-emerald-950">
                              {confirmedBorrow.bookTitle}
                            </strong>
                          </div>
                          <div>
                            <span className="text-emerald-700">Issue date:</span>{' '}
                            <strong className="font-mono-tabular text-emerald-950">
                              {formatDisplayDate(confirmedBorrow.issueDate)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-emerald-700">Due date:</span>{' '}
                            <strong className="font-mono-tabular text-emerald-950">
                              {formatDisplayDate(confirmedBorrow.dueDate)}
                            </strong>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => onNavigate({ name: 'student-my-books' })}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1E3A63] cursor-pointer"
                          >
                            View My Books
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigate(browseRoute)}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
                          >
                            Continue Browsing
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : student_eligibility.already_borrowed && student_eligibility.active_borrowing ? (
                  <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#DBEAFE] bg-white p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-xs font-semibold text-[#142B4A]">
                        You currently have this book borrowed
                      </p>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Issued{' '}
                        <span className="font-mono-tabular text-[#1E293B]">
                          {formatDisplayDate(student_eligibility.active_borrowing.issue_date)}
                        </span>{' '}
                        · Due{' '}
                        <span className="font-mono-tabular font-semibold text-[#142B4A]">
                          {formatDisplayDate(student_eligibility.active_borrowing.due_date)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate({ name: 'student-my-books' })}
                      className="inline-flex min-h-[42px] w-full items-center justify-center rounded-lg bg-[#142B4A] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1E3A63] sm:w-auto cursor-pointer"
                    >
                      View My Books
                    </button>
                  </div>
                ) : student_eligibility.active_reservation ? (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-white p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[#142B4A]">
                          You have already reserved this book.
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                          <span>
                            Reserved on:{' '}
                            <strong className="font-mono-tabular text-[#142B4A]">
                              {formatDisplayDate(
                                student_eligibility.active_reservation.reservation_date
                              )}
                            </strong>
                          </span>
                          {student_eligibility.active_reservation.queue_position !== null && (
                            <span>
                              Queue position:{' '}
                              <strong className="font-mono-tabular text-[#142B4A]">
                                #{student_eligibility.active_reservation.queue_position}
                              </strong>
                            </span>
                          )}
                          <span>
                            Status:{' '}
                            <strong className="text-[#2563EB]">
                              {student_eligibility.active_reservation.status}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCancellingReserve}
                        onClick={() =>
                          handleCancelReservation(
                            student_eligibility.active_reservation!.reservation_id
                          )
                        }
                        className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 sm:w-auto cursor-pointer"
                      >
                        {isCancellingReserve && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        )}
                        <span>Cancel Reservation</span>
                      </button>
                    </div>

                    {cancelReserveError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                        <span>{cancelReserveError}</span>
                      </div>
                    )}
                  </div>
                ) : !student_eligibility.is_authenticated ? (
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs text-[#64748B]">
                      Sign in with your student account to borrow or reserve this book.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate({ name: 'login' })}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] sm:w-auto cursor-pointer"
                    >
                      Sign in to Borrow
                    </button>
                  </div>
                ) : book.available_copies > 0 ? (
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs text-[#64748B]">
                      Standard loan period: <strong className="text-[#142B4A]">{loan_period_days} days</strong>{' '}
                      (verified on server at confirmation).
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setBorrowError(null);
                        setBorrowModalOpen(true);
                      }}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:w-auto cursor-pointer"
                    >
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                      <span>Borrow Book</span>
                    </button>
                  </div>
                ) : book.total_copies > 0 ? (
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs text-[#64748B]">
                      Currently out on loan. Place a reservation to be notified when returned.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setReserveError(null);
                        setReserveModalOpen(true);
                      }}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E3A63] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] sm:w-auto cursor-pointer"
                    >
                      <Bookmark className="h-4 w-4" aria-hidden="true" />
                      <span>Reserve Book</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-xs text-red-700">No copies currently available for borrowing.</p>
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed sm:w-auto"
                    >
                      Unavailable
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Recommendation Explanation (Shown Only When Book Was Recommended) */}
      {data.recommendation_reason && (
        <section
          aria-labelledby="why-recommended-heading"
          className="rounded-xl border border-[#DBEAFE] bg-white p-5 shadow-xs"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="why-recommended-heading"
                className="font-display text-sm font-bold text-[#142B4A]"
              >
                Why We Recommended This
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-[#1E293B]">
                &ldquo;{data.recommendation_reason}&rdquo;
              </p>
            </div>
          </div>
        </section>
      )}

      {/* About This Book + Expandable Metadata & Physical Location */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="about-book-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7"
        >
          <h2 id="about-book-heading" className="font-display text-lg font-bold text-[#142B4A]">
            About This Book
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#1E293B]">{displayedDescription}</p>
          {isLongDescription && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              <span>{descriptionExpanded ? 'Read Less' : 'Read More'}</span>
              {descriptionExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}
        </section>

        {/* Expandable Book Information & Physical Library Location */}
        <section
          aria-labelledby="book-info-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-5"
        >
          <button
            type="button"
            onClick={() => setMetadataExpanded((prev) => !prev)}
            aria-expanded={metadataExpanded}
            aria-controls="book-information-panel"
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <h2 id="book-info-heading" className="font-display text-lg font-bold text-[#142B4A]">
              Book Information
            </h2>
            {metadataExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
            )}
          </button>

          {metadataExpanded && (
            <div id="book-information-panel" className="mt-4 space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-[#64748B]">Book ID</dt>
                  <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                    #{book.book_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">ISBN</dt>
                  <dd className="font-mono-tabular font-semibold text-[#142B4A]">{book.isbn}</dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Publisher</dt>
                  <dd className="font-semibold text-[#142B4A]">{book.publisher}</dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Edition</dt>
                  <dd className="font-semibold text-[#142B4A]">{book.edition}</dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Pages</dt>
                  <dd className="font-mono-tabular font-semibold text-[#142B4A]">{book.pages}</dd>
                </div>
                <div>
                  <dt className="text-[#64748B]">Language</dt>
                  <dd className="font-semibold text-[#142B4A]">{book.language}</dd>
                </div>
              </dl>

              {book.location && (
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#142B4A]">
                    <MapPin className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                    <span>Library Location</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <dt className="text-[#64748B]">Branch</dt>
                      <dd className="font-semibold text-[#142B4A]">{book.location.branch}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Shelf</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {book.location.shelf}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Section</dt>
                      <dd className="font-semibold text-[#142B4A]">{book.location.section}</dd>
                    </div>
                    <div>
                      <dt className="text-[#64748B]">Floor</dt>
                      <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                        {book.location.floor}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Student Ratings & Reviews */}
      <BookRatingsSection
        ratingAverage={book.rating_average}
        ratingCount={book.rating_count}
        distribution={data.rating_distribution}
        reviews={data.reviews}
        eligibility={student_eligibility}
        isSubmittingReview={isSubmittingReview}
        reviewError={reviewError}
        onSubmitReview={handleSubmitReview}
      />

      {/* You May Also Like (Similar Books by Content/Metadata) */}
      {data.related_books.length > 0 && (
        <section
          aria-labelledby="you-may-also-like-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold text-[#2563EB]">
                Similar Books · Category &amp; Subject Match
              </p>
              <h2
                id="you-may-also-like-heading"
                className="font-display mt-0.5 text-lg font-bold text-[#142B4A]"
              >
                You May Also Like
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate(browseRoute)}
              className="self-start text-xs font-semibold text-[#2563EB] hover:underline sm:self-auto cursor-pointer"
            >
              Browse Full Catalogue
            </button>
          </div>

          <div
            data-testid="related-books-grid"
            className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {data.related_books.map((related) => (
              <CatalogBookCard
                key={`related-${related.book_id}`}
                book={related}
                onOpenDetails={(id) => onNavigate({ name: 'book-detail', slug: String(id) })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Borrow & Reservation Confirmation Modals */}
      <BorrowConfirmationModal
        isOpen={borrowModalOpen}
        bookTitle={book.title}
        issueDateIso={issueDateIso}
        dueDateIso={dueDateIso}
        loanPeriodDays={loan_period_days}
        isSubmitting={isSubmittingBorrow}
        errorMessage={borrowError}
        onConfirm={handleConfirmBorrow}
        onClose={() => setBorrowModalOpen(false)}
      />

      <ReserveConfirmationModal
        isOpen={reserveModalOpen}
        bookTitle={book.title}
        availabilityLabel={availability.label}
        expectedQueuePosition={book.reserved_copies + 1}
        isSubmitting={isSubmittingReserve}
        errorMessage={reserveError}
        onConfirm={handleConfirmReservation}
        onClose={() => setReserveModalOpen(false)}
      />
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  History,
  Info,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { buildPaginationTokens } from '../../utils/bookCatalog';
import type { StudentProfile } from '../../utils/studentDashboard';
import {
  applySubmittedReviewToHistory,
  buildReadingHistoryApiParams,
  countActiveReadingHistoryFilters,
  createSampleReadingHistoryRecords,
  DEFAULT_READING_HISTORY_FILTERS,
  formatHistoryDate,
  parseReadingHistoryFiltersFromSearch,
  querySampleReadingHistory,
  serializeReadingHistoryFiltersToSearch,
  type DateRangePreset,
  type ReadingHistoryFilterState,
  type ReadingHistoryPayload,
  type ReadingHistoryRatingFilter,
  type ReadingHistoryRecord,
  type ReadingHistorySortOption,
} from '../../utils/readingHistory';
import { ReadingHistoryInsights } from './ReadingHistoryInsights';
import { HistoryBookDetailsModal, HistoryRateReviewModal } from './ReadingHistoryModals';

interface ReadingHistoryPageProps {
  student: StudentProfile;
  onFeedbackSubmitted?: (bookTitle: string) => void;
  onNavigate: (route: AppRoute) => void;
}

const DATE_RANGE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date Range' },
];

const SORT_OPTIONS: Array<{ value: ReadingHistorySortOption; label: string }> = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'title_desc', label: 'Title Z–A' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'longest_duration', label: 'Longest Reading Duration' },
];

export function ReadingHistoryPage({
  student,
  onFeedbackSubmitted,
  onNavigate,
}: ReadingHistoryPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [filters, setFilters] = useState<ReadingHistoryFilterState>(() =>
    parseReadingHistoryFiltersFromSearch(window.location.search)
  );
  const [searchInput, setSearchInput] = useState<string>(filters.search);
  const [draftFilters, setDraftFilters] = useState<ReadingHistoryFilterState>(filters);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  const [sampleSourceRecords, setSampleSourceRecords] = useState<ReadingHistoryRecord[]>(() =>
    createSampleReadingHistoryRecords()
  );
  const [payload, setPayload] = useState<ReadingHistoryPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const [detailRecord, setDetailRecord] = useState<ReadingHistoryRecord | null>(null);
  const [rateRecord, setRateRecord] = useState<ReadingHistoryRecord | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [feedbackSuccessBanner, setFeedbackSuccessBanner] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  // Listen to Back/Forward navigation on /student/history
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseReadingHistoryFiltersFromSearch(window.location.search);
      setFilters(parsed);
      setSearchInput(parsed.search);
      setDraftFilters(parsed);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Close mobile filter drawer on Escape
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileFiltersOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileFiltersOpen]);

  const commitFilters = useCallback((nextFilters: ReadingHistoryFilterState) => {
    setFilters(nextFilters);
    setDraftFilters(nextFilters);
    setSearchInput(nextFilters.search);
    const nextSearch = serializeReadingHistoryFiltersToSearch(nextFilters);
    const targetUrl = `${window.location.pathname}${nextSearch}`;
    if (`${window.location.pathname}${window.location.search}` !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, []);

  // Fetch from GET /api/student/reading-history when VITE_API_BASE_URL is configured; otherwise query sample data
  useEffect(() => {
    let isMounted = true;
    const apiBaseUrl = getApiBaseUrl();
    const backendConnected = isBackendConnected();

    async function loadReadingHistory() {
      setIsLoading(true);
      setErrorMessage(null);

      if (backendConnected) {
        try {
          const params = buildReadingHistoryApiParams(filters);
          const response = await fetch(
            `${apiBaseUrl}/api/student/reading-history?${params.toString()}`,
            {
              method: 'GET',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            }
          );

          if (response.status === 401 || response.status === 403) {
            if (isMounted) {
              onNavigateRef.current({ name: 'login' });
            }
            return;
          }

          if (!response.ok) {
            throw new Error(`Unable to fetch reading history (${response.status}).`);
          }

          const remotePayload = (await response.json()) as ReadingHistoryPayload;
          if (isMounted) {
            setPayload({ ...remotePayload, is_prototype_sample: false });
            setIsLoading(false);
          }
          return;
        } catch (err) {
          if (isMounted) {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "We couldn't retrieve your reading history right now. Please try again."
            );
            setIsLoading(false);
          }
          return;
        }
      }

      // Development / prototype mode when VITE_API_BASE_URL is not configured
      await new Promise((resolve) => window.setTimeout(resolve, 110));
      if (isMounted) {
        setPayload(querySampleReadingHistory(sampleSourceRecords, filters, referenceDate));
        setIsLoading(false);
      }
    }

    void loadReadingHistory();
    return () => {
      isMounted = false;
    };
  }, [filters, referenceDate, reloadNonce, sampleSourceRecords]);

  const activeFilterCount = useMemo(
    () => countActiveReadingHistoryFilters(filters),
    [filters]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    commitFilters({
      ...filters,
      search: searchInput.trim(),
      page: 1,
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    commitFilters({
      ...filters,
      search: '',
      page: 1,
    });
    searchInputRef.current?.focus();
  };

  const handleClearAllFilters = () => {
    setSearchInput('');
    commitFilters({ ...DEFAULT_READING_HISTORY_FILTERS });
  };

  const handleSubmitReview = async (
    record: ReadingHistoryRecord,
    rating: number,
    reviewText: string
  ) => {
    const apiBaseUrl = getApiBaseUrl();

    if (!isBackendConnected()) {
      setReviewError(
        'Backend API is not connected. Saving ratings and reviews requires server verification via POST /api/books/<id>/reviews.'
      );
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      const isEdit = record.student_rating !== null;
      const response = await fetch(
        `${apiBaseUrl}/api/books/${encodeURIComponent(String(record.book_id))}/reviews`,
        {
          method: isEdit ? 'PUT' : 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ rating, review: reviewText }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      const body = (await response.json().catch(() => ({}))) as {
        rating_id?: number;
        updated_at?: string;
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error ?? body.message ?? `Unable to save your review (${response.status}).`
        );
      }

      const submittedAt = body.updated_at ?? new Date().toISOString().slice(0, 10);
      const ratingId = body.rating_id ?? record.rating_id ?? Date.now();

      setSampleSourceRecords((prev) =>
        applySubmittedReviewToHistory(prev, record.book_id, rating, reviewText, submittedAt, ratingId)
      );
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              items: applySubmittedReviewToHistory(
                prev.items,
                record.book_id,
                rating,
                reviewText,
                submittedAt,
                ratingId
              ),
            }
          : prev
      );
      setRateRecord(null);
      setFeedbackSuccessBanner(
        `Feedback submitted — Your rating and review for "${record.title}" have been saved.`
      );
      onFeedbackSubmitted?.(record.title);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      setReviewError(
        err instanceof Error
          ? err.message
          : 'Unable to submit your rating and review right now. Please try again.'
      );
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenBookPage = (bookId: number) => {
    onNavigate({ name: 'book-detail', slug: String(bookId) });
  };

  const paginationTokens = useMemo(() => {
    if (!payload) return [];
    return buildPaginationTokens(payload.page, payload.total_pages);
  }, [payload]);

  const startRange =
    payload && payload.filtered_count > 0 ? (payload.page - 1) * payload.limit + 1 : 0;
  const endRange =
    payload && payload.filtered_count > 0
      ? Math.min(payload.filtered_count, payload.page * payload.limit)
      : 0;

  return (
    <div className="space-y-6">
      {/* 1. Page Header + Compact Search */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
              <History className="h-4 w-4" aria-hidden="true" />
              <span>Completed Loans &amp; Reading Timeline</span>
            </div>
            <h2 className="font-display mt-1 text-xl font-bold text-[#142B4A] sm:text-2xl">
              Reading History
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#64748B]">
              View the books you have borrowed and returned, track your reading activity, and see
              how your reading history helps improve your personalized recommendations.
            </p>
          </div>

          {/* Compact Search Form */}
          <form onSubmit={handleSearchSubmit} className="w-full lg:w-[380px] xl:w-[410px]">
            <label htmlFor="reading-history-search" className="sr-only">
              Search your reading history
            </label>
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-3 h-4 w-4 text-[#64748B]"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="reading-history-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search your reading history..."
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-24 text-xs text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Clear reading history search"
                  className="absolute right-14 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-[#142B4A] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 inline-flex h-8 items-center justify-center rounded-md bg-[#2563EB] px-2.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Feedback Confirmation Notification */}
      {feedbackSuccessBanner && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{feedbackSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccessBanner(null)}
            aria-label="Dismiss feedback notice"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Honest Sample Preview Banner */}
      {payload?.is_prototype_sample && !isLoading && !errorMessage && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Reading History Preview:
              </strong>{' '}
              Showing structured development records for {student.name} ready for the live library
              history endpoint.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/student/reading-history
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <ReadingHistorySkeleton />
      ) : errorMessage || !payload ? (
        /* Error State */
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-6 shadow-xs sm:p-8"
        >
          <div className="flex items-start gap-3.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <h3 className="font-display text-lg font-bold text-[#142B4A]">
                Unable to load your reading history
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                We couldn&apos;t retrieve your reading history right now. Please try again.
              </p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      ) : payload.total_count === 0 ? (
        /* Empty History State */
        <>
          <SummaryCardsGrid summary={payload.summary} />
          <section
            data-testid="empty-reading-history"
            className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs sm:p-12"
          >
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]">
              <BookOpen className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
              Your reading history is empty
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
              Once you borrow and return books, your reading activity will appear here.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate({ name: 'student-search' })}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Explore Books
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'student-recommendations' })}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                Get Recommendations
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          {/* 2. Reading Summary Cards */}
          <SummaryCardsGrid summary={payload.summary} />

          {/* 3. History Filters & Sorting Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono-tabular text-xs font-semibold text-[#142B4A]">
                  {payload.filtered_count}{' '}
                  {payload.filtered_count === 1 ? 'record' : 'records'}
                </span>
                {activeFilterCount > 0 && (
                  <span className="rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                    {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:border-slate-300 hover:text-[#142B4A] cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}

                {/* Sort Select */}
                <div className="flex items-center gap-2">
                  <label htmlFor="history-sort-select" className="sr-only">
                    Sort reading history
                  </label>
                  <select
                    id="history-sort-select"
                    value={filters.sort}
                    onChange={(e) =>
                      commitFilters({
                        ...filters,
                        sort: e.target.value as ReadingHistorySortOption,
                        page: 1,
                      })
                    }
                    className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        Sort: {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desktop Filter Toggle */}
                <button
                  type="button"
                  onClick={() => setDesktopFiltersOpen((prev) => !prev)}
                  aria-expanded={desktopFiltersOpen}
                  className="hidden min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] md:inline-flex cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{desktopFiltersOpen ? 'Hide Filters' : 'Filters'}</span>
                </button>

                {/* Mobile Filter Drawer Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setDraftFilters(filters);
                    setMobileFiltersOpen(true);
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] md:hidden cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Desktop Filter Controls */}
            {desktopFiltersOpen && (
              <div className="mt-4 hidden space-y-3 border-t border-slate-100 pt-4 md:block">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <div>
                    <label
                      htmlFor="history-filter-date-range"
                      className="block text-[11px] font-semibold text-[#64748B]"
                    >
                      Date Range
                    </label>
                    <select
                      id="history-filter-date-range"
                      value={filters.dateRange}
                      onChange={(e) =>
                        commitFilters({
                          ...filters,
                          dateRange: e.target.value as DateRangePreset,
                          page: 1,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    >
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <HistorySelect
                    id="history-filter-category"
                    label="Category"
                    value={filters.category}
                    options={payload.facets.categories}
                    placeholder="All Categories"
                    onChange={(value) => commitFilters({ ...filters, category: value, page: 1 })}
                  />

                  <HistorySelect
                    id="history-filter-subject"
                    label="Subject"
                    value={filters.subject}
                    options={payload.facets.subjects}
                    placeholder="All Subjects"
                    onChange={(value) => commitFilters({ ...filters, subject: value, page: 1 })}
                  />

                  <HistorySelect
                    id="history-filter-author"
                    label="Author"
                    value={filters.author}
                    options={payload.facets.authors}
                    placeholder="All Authors"
                    onChange={(value) => commitFilters({ ...filters, author: value, page: 1 })}
                  />

                  <div>
                    <label
                      htmlFor="history-filter-rating"
                      className="block text-[11px] font-semibold text-[#64748B]"
                    >
                      Rating
                    </label>
                    <select
                      id="history-filter-rating"
                      value={filters.ratingFilter}
                      onChange={(e) =>
                        commitFilters({
                          ...filters,
                          ratingFilter: e.target.value as ReadingHistoryRatingFilter,
                          page: 1,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    >
                      <option value="all">All</option>
                      <option value="rated">Rated</option>
                      <option value="not_rated">Not Rated</option>
                    </select>
                  </div>

                  <HistorySelect
                    id="history-filter-status"
                    label="Status"
                    value={filters.status}
                    options={payload.facets.statuses}
                    placeholder="All Statuses"
                    onChange={(value) => commitFilters({ ...filters, status: value, page: 1 })}
                  />
                </div>

                {filters.dateRange === 'custom' && (
                  <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-[#F5F8FC] p-3">
                    <div>
                      <label
                        htmlFor="history-custom-from"
                        className="block text-[11px] font-semibold text-[#64748B]"
                      >
                        From Return Date
                      </label>
                      <input
                        id="history-custom-from"
                        type="date"
                        value={filters.customStartDate}
                        onChange={(e) =>
                          commitFilters({
                            ...filters,
                            customStartDate: e.target.value,
                            page: 1,
                          })
                        }
                        className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="history-custom-to"
                        className="block text-[11px] font-semibold text-[#64748B]"
                      >
                        To Return Date
                      </label>
                      <input
                        id="history-custom-to"
                        type="date"
                        value={filters.customEndDate}
                        onChange={(e) =>
                          commitFilters({
                            ...filters,
                            customEndDate: e.target.value,
                            page: 1,
                          })
                        }
                        className="mt-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-[#1E293B]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 4. Primary Reading History List */}
          {payload.items.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <p className="font-display text-base font-bold text-[#142B4A]">
                No reading history records match your current search or filters
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Adjust your filters or clear search terms to view all returned books.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Clear Filters
              </button>
            </section>
          ) : (
            <section aria-labelledby="history-records-heading" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3
                  id="history-records-heading"
                  className="font-display text-base font-bold text-[#142B4A]"
                >
                  Borrowing &amp; Return Records
                </h3>
                <span className="font-mono-tabular text-xs text-[#64748B]">
                  Showing {startRange}–{endRange} of {payload.filtered_count}
                </span>
              </div>

              {/* Desktop Table */}
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs lg:block">
                <div className="overflow-x-auto">
                  <table
                    data-testid="reading-history-table"
                    className="w-full border-collapse text-left text-xs"
                  >
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                        <th scope="col" className="py-3.5 pl-4 pr-3">
                          Book
                        </th>
                        <th scope="col" className="px-3 py-3.5">
                          Category &amp; Subject
                        </th>
                        <th scope="col" className="px-3 py-3.5">
                          Borrowed / Returned
                        </th>
                        <th scope="col" className="px-3 py-3.5">
                          Duration
                        </th>
                        <th scope="col" className="px-3 py-3.5">
                          Rating &amp; Review
                        </th>
                        <th scope="col" className="px-3 py-3.5">
                          Status
                        </th>
                        <th scope="col" className="py-3.5 pl-3 pr-4 text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payload.items.map((record) => (
                        <tr
                          key={record.borrowing_id}
                          data-testid={`history-row-${record.borrowing_id}`}
                          className="transition-colors hover:bg-[#F5F8FC]/60"
                        >
                          <td className="py-3.5 pl-4 pr-3">
                            <div className="flex items-center gap-3">
                              <HistoryCoverThumbnail
                                src={record.cover_image}
                                title={record.title}
                              />
                              <div className="min-w-0 max-w-[195px]">
                                <button
                                  type="button"
                                  onClick={() => setDetailRecord(record)}
                                  className="font-display line-clamp-2 text-left text-sm font-bold text-[#142B4A] hover:text-[#2563EB] cursor-pointer"
                                >
                                  {record.title}
                                </button>
                                <p className="mt-0.5 truncate text-xs text-[#64748B]">
                                  {record.author}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-3.5">
                            <p className="font-semibold text-[#2563EB]">{record.category}</p>
                            <p className="mt-0.5 text-[#64748B]">{record.subject}</p>
                          </td>

                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <p className="text-[#64748B]">
                              Borrowed:{' '}
                              <span className="font-mono-tabular font-medium text-[#142B4A]">
                                {formatHistoryDate(record.issue_date)}
                              </span>
                            </p>
                            <p className="mt-0.5 text-[#64748B]">
                              Returned:{' '}
                              <span className="font-mono-tabular font-medium text-[#142B4A]">
                                {formatHistoryDate(record.return_date)}
                              </span>
                            </p>
                          </td>

                          <td className="px-3 py-3.5 whitespace-nowrap">
                            <span className="font-mono-tabular font-semibold text-[#142B4A]">
                              {record.loan_duration_days}{' '}
                              {record.loan_duration_days === 1 ? 'day' : 'days'}
                            </span>
                          </td>

                          <td className="px-3 py-3.5">
                            {record.student_rating !== null ? (
                              <div className="space-y-1">
                                <div
                                  className="flex items-center gap-0.5"
                                  aria-label={`Rated ${record.student_rating} out of 5 stars`}
                                >
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-3.5 w-3.5 ${
                                        star <= record.student_rating!
                                          ? 'fill-amber-400 text-amber-500'
                                          : 'text-slate-300'
                                      }`}
                                      aria-hidden="true"
                                    />
                                  ))}
                                </div>
                                <p className="text-[11px] font-medium text-emerald-700">
                                  {record.review_status}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-[11px] text-[#64748B] whitespace-nowrap">
                                  {record.review_status}
                                </span>
                                {record.can_review && (
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewError(null);
                                        setRateRecord(record);
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:underline whitespace-nowrap cursor-pointer"
                                    >
                                      <Star className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      <span>Rate this book</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3.5">
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span>{record.status}</span>
                            </span>
                          </td>

                          <td className="py-3.5 pl-3 pr-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {record.can_review && record.student_rating !== null && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewError(null);
                                    setRateRecord(record);
                                  }}
                                  aria-label={`Edit rating for ${record.title}`}
                                  className="inline-flex min-h-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
                                >
                                  Edit Rating
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDetailRecord(record)}
                                className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-2.5 py-1.5 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:bg-[#2563EB] hover:text-white whitespace-nowrap cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>View Details</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile & Tablet Card List */}
              <div data-testid="reading-history-cards" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:hidden">
                {payload.items.map((record) => (
                  <article
                    key={record.borrowing_id}
                    data-testid={`history-card-${record.borrowing_id}`}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                  >
                    <div className="flex gap-3.5">
                      <HistoryCoverThumbnail src={record.cover_image} title={record.title} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[11px] font-semibold text-[#2563EB]">
                            {record.category} · {record.subject}
                          </p>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            {record.status}
                          </span>
                        </div>
                        <h4 className="font-display mt-1 line-clamp-2 text-sm font-bold text-[#142B4A]">
                          {record.title}
                        </h4>
                        <p className="mt-0.5 truncate text-xs text-[#64748B]">{record.author}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-[#F5F8FC] p-2.5 text-[11px]">
                      <div>
                        <p className="text-[#64748B]">Borrowed</p>
                        <p className="font-mono-tabular font-semibold text-[#142B4A]">
                          {formatHistoryDate(record.issue_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Returned</p>
                        <p className="font-mono-tabular font-semibold text-[#142B4A]">
                          {formatHistoryDate(record.return_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#64748B]">Duration</p>
                        <p className="font-mono-tabular font-semibold text-[#142B4A]">
                          {record.loan_duration_days} days
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      {record.student_rating !== null ? (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-3.5 w-3.5 ${
                                  star <= record.student_rating!
                                    ? 'fill-amber-400 text-amber-500'
                                    : 'text-slate-300'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-medium text-emerald-700">
                            {record.review_status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#64748B]">{record.review_status}</span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {record.can_review && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewError(null);
                            setRateRecord(record);
                          }}
                          className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {record.student_rating !== null ? 'Edit Rating' : 'Rate this book'}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetailRecord(record)}
                        className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>View Details</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination Controls */}
              {payload.total_pages > 1 && (
                <nav
                  aria-label="Reading history pagination"
                  className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row"
                >
                  <p className="font-mono-tabular text-xs text-[#64748B]">
                    Page <strong className="text-[#142B4A]">{payload.page}</strong> of{' '}
                    <strong className="text-[#142B4A]">{payload.total_pages}</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={payload.page <= 1}
                      onClick={() => commitFilters({ ...filters, page: payload.page - 1 })}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-45 cursor-pointer"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Previous</span>
                    </button>

                    {paginationTokens.map((token, idx) =>
                      token === 'ellipsis' ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-xs text-[#64748B]">
                          …
                        </span>
                      ) : (
                        <button
                          key={token}
                          type="button"
                          aria-current={token === payload.page ? 'page' : undefined}
                          onClick={() => commitFilters({ ...filters, page: token })}
                          className={`font-mono-tabular inline-flex h-9 min-w-[36px] items-center justify-center rounded-lg border px-2.5 text-xs font-semibold cursor-pointer ${
                            token === payload.page
                              ? 'border-[#142B4A] bg-[#142B4A] text-white'
                              : 'border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB]'
                          }`}
                        >
                          {token}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={payload.page >= payload.total_pages}
                      onClick={() => commitFilters({ ...filters, page: payload.page + 1 })}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-45 cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </nav>
              )}
            </section>
          )}

          {/* 7, 8, 9. Reading Insights + Chart + Recommendation Engine Connection */}
          <ReadingHistoryInsights
            insights={payload.insights}
            monthlyActivity={payload.monthly_activity}
            onNavigate={onNavigate}
          />
        </>
      )}

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && payload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter reading history"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center md:hidden"
        >
          <div
            className="fixed inset-0 bg-[#142B4A]/50"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-bold text-[#142B4A]">
                Filter Reading History
              </h3>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="Close filter drawer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1">
              <div>
                <label
                  htmlFor="mobile-history-date-range"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Date Range
                </label>
                <select
                  id="mobile-history-date-range"
                  value={draftFilters.dateRange}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      dateRange: e.target.value as DateRangePreset,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B]"
                >
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {draftFilters.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="mobile-history-from"
                      className="block text-[11px] font-semibold text-[#64748B]"
                    >
                      From
                    </label>
                    <input
                      id="mobile-history-from"
                      type="date"
                      value={draftFilters.customStartDate}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({ ...prev, customStartDate: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#1E293B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="mobile-history-to"
                      className="block text-[11px] font-semibold text-[#64748B]"
                    >
                      To
                    </label>
                    <input
                      id="mobile-history-to"
                      type="date"
                      value={draftFilters.customEndDate}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({ ...prev, customEndDate: e.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#1E293B]"
                    />
                  </div>
                </div>
              )}

              <HistorySelect
                id="mobile-history-category"
                label="Category"
                value={draftFilters.category}
                options={payload.facets.categories}
                placeholder="All Categories"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, category: value }))}
              />
              <HistorySelect
                id="mobile-history-subject"
                label="Subject"
                value={draftFilters.subject}
                options={payload.facets.subjects}
                placeholder="All Subjects"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, subject: value }))}
              />
              <HistorySelect
                id="mobile-history-author"
                label="Author"
                value={draftFilters.author}
                options={payload.facets.authors}
                placeholder="All Authors"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, author: value }))}
              />
              <div>
                <label
                  htmlFor="mobile-history-rating"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Rating
                </label>
                <select
                  id="mobile-history-rating"
                  value={draftFilters.ratingFilter}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      ratingFilter: e.target.value as ReadingHistoryRatingFilter,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B]"
                >
                  <option value="all">All</option>
                  <option value="rated">Rated</option>
                  <option value="not_rated">Not Rated</option>
                </select>
              </div>
              <HistorySelect
                id="mobile-history-status"
                label="Status"
                value={draftFilters.status}
                options={payload.facets.statuses}
                placeholder="All Statuses"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value }))}
              />
            </div>

            <div className="mt-5 flex gap-2.5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  handleClearAllFilters();
                  setMobileFiltersOpen(false);
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  commitFilters({ ...draftFilters, page: 1 });
                  setMobileFiltersOpen(false);
                }}
                className="flex-1 rounded-lg bg-[#2563EB] py-2.5 text-xs font-semibold text-white cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Book History Details Modal */}
      <HistoryBookDetailsModal
        record={detailRecord}
        onClose={() => setDetailRecord(null)}
        onViewBook={handleOpenBookPage}
        onOpenRateModal={(rec) => {
          setReviewError(null);
          setRateRecord(rec);
        }}
      />

      {/* 6. Rate & Review Integration Modal */}
      <HistoryRateReviewModal
        record={rateRecord}
        isSubmitting={isSubmittingReview}
        errorMessage={reviewError}
        onSubmit={handleSubmitReview}
        onClose={() => {
          if (!isSubmittingReview) {
            setRateRecord(null);
            setReviewError(null);
          }
        }}
      />
    </div>
  );
}

function SummaryCardsGrid({
  summary,
}: {
  summary: ReadingHistoryPayload['summary'];
}) {
  const cards = [
    {
      id: 'total-books',
      label: 'Total Books',
      value: String(summary.total_books),
      context: summary.total_books === 1 ? 'Book borrowed and returned' : 'Books borrowed and returned',
      icon: <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'this-month',
      label: 'This Month',
      value: String(summary.this_month),
      context: 'Borrowed or returned this month',
      icon: <Calendar className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'favourite-category',
      label: 'Favourite Category',
      value: summary.favourite_category ?? 'Not enough data',
      context: summary.favourite_category
        ? 'Most frequently borrowed subject area'
        : 'Appears once books are returned',
      icon: <Clock className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    },
    {
      id: 'ratings-given',
      label: 'Ratings Given',
      value: String(summary.ratings_given),
      context: 'Submitted ratings improving recommendations',
      icon: <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />,
    },
  ];

  return (
    <section aria-label="Reading summary metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.id}
            data-testid={`summary-card-${card.id}`}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#64748B]">{card.label}</span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                {card.icon}
              </span>
            </div>
            <p
              className={`mt-2.5 font-bold text-[#142B4A] ${
                card.id === 'favourite-category'
                  ? 'font-display text-lg leading-snug'
                  : 'font-mono-tabular text-2xl'
              }`}
            >
              {card.value}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">{card.context}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryCoverThumbnail({ src, title }: { src: string; title: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-1 text-center text-white">
        <BookOpen className="h-4 w-4 text-[#DBEAFE]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-[#F5F8FC] p-1">
      <img
        src={src}
        alt={`Cover of ${title}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="h-full w-auto max-w-full rounded object-contain"
      />
    </div>
  );
}

function ReadingHistorySkeleton() {
  return (
    <div aria-label="Loading reading history" className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-7 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-14 rounded-xl border border-slate-200 bg-white" />
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

interface HistorySelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}

function HistorySelect({ id, label, value, options, placeholder, onChange }: HistorySelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold text-[#64748B]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

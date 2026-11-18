import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Compass,
  Info,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import type { BookRatingReview, StudentProfile } from '../../utils/studentDashboard';
import {
  buildRecommendationsApiParams,
  countActiveRecommendationFilters,
  createSampleRecommendationsData,
  DEFAULT_RECOMMENDATION_FILTERS,
  filterRecommendations,
  partitionRecommendationSections,
  updateRecommendationFeedback,
  type RecommendationFeedbackValue,
  type RecommendationFilterState,
  type RecommendationItem,
  type RecommendationsPayload,
} from '../../utils/recommendationsPage';
import { RecommendationCard, RecommendationsSkeletonGrid } from './RecommendationCard';
import { RecommendationExplainModal } from './RecommendationExplainModal';

interface RecommendedForYouPageProps {
  student: StudentProfile;
  readingHistoryCount: number;
  recentReviews: BookRatingReview[];
  onNavigate: (route: AppRoute) => void;
}

export function RecommendedForYouPage({
  student,
  readingHistoryCount,
  recentReviews,
  onNavigate,
}: RecommendedForYouPageProps) {
  const [payload, setPayload] = useState<RecommendationsPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<RecommendationFilterState>(DEFAULT_RECOMMENDATION_FILTERS);
  const [draftFilters, setDraftFilters] = useState<RecommendationFilterState>(
    DEFAULT_RECOMMENDATION_FILTERS
  );
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);
  const [explainItem, setExplainItem] = useState<RecommendationItem | null>(null);

  const onNavigateRef = React.useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

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

  const fetchRecommendations = useCallback(
    async (options: { isRefresh?: boolean } = {}) => {
      const { isRefresh = false } = options;
      const apiBaseUrl = getApiBaseUrl();
      const backendConnected = isBackendConnected();

      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);
      if (!isRefresh) {
        setStatusNotice(null);
      }

      if (backendConnected) {
        try {
          const params = buildRecommendationsApiParams(DEFAULT_RECOMMENDATION_FILTERS, 24);
          const response = await apiFetch(`${apiBaseUrl}/api/recommendations?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });

          if (response.status === 401 || response.status === 403) {
            onNavigateRef.current({ name: 'login' });
            return;
          }

          if (!response.ok) {
            throw new Error(`Unable to fetch personalised recommendations (${response.status}).`);
          }

          const remotePayload = (await response.json()) as RecommendationsPayload;
          setPayload({ ...remotePayload, is_prototype_sample: false });
          if (isRefresh) {
            setStatusNotice('Recommendations updated just now');
          }
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        } catch (err) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : 'Unable to load personalised recommendations right now.'
          );
          setIsLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      // Development / prototype sample preview when VITE_API_BASE_URL is unset
      await new Promise((resolve) => window.setTimeout(resolve, isRefresh ? 160 : 120));
      const sample = createSampleRecommendationsData(student, readingHistoryCount, recentReviews);
      setPayload(sample);
      if (isRefresh) {
        setStatusNotice(
          'Sample preview refreshed — connect VITE_API_BASE_URL to recompute live recommendations from the backend.'
        );
      }
      setIsLoading(false);
      setIsRefreshing(false);
    },
    [readingHistoryCount, recentReviews, student]
  );

  useEffect(() => {
    void fetchRecommendations();
  }, [fetchRecommendations]);

  const handleOpenBookDetails = (bookId: number) => {
    onNavigate({ name: 'book-detail', slug: String(bookId) });
  };

  const handleFeedback = async (bookId: number, feedback: RecommendationFeedbackValue) => {
    const previousItems = payload?.items ?? [];
    const targetItem = previousItems.find((i) => i.book_id === bookId);
    const nextValue = targetItem?.feedback === feedback ? null : feedback;

    setPayload((prev) =>
      prev
        ? {
            ...prev,
            items: updateRecommendationFeedback(prev.items, bookId, feedback),
          }
        : prev
    );

    const apiBaseUrl = getApiBaseUrl();
    if (isBackendConnected() && nextValue !== null) {
      try {
        const response = await apiFetch(`${apiBaseUrl}/api/recommendations/feedback`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ book_id: bookId, feedback: nextValue }),
        });

        if (response.status === 401 || response.status === 403) {
          onNavigateRef.current({ name: 'login' });
          return;
        }

        if (!response.ok) {
          throw new Error('Could not save feedback.');
        }

        setStatusNotice('Feedback recorded to refine your future recommendations.');
      } catch {
        setPayload((prev) => (prev ? { ...prev, items: previousItems } : prev));
        setStatusNotice('Unable to save recommendation feedback right now.');
      }
    } else if (nextValue === 'not_interested') {
      setStatusNotice(
        'Book hidden from this preview session. Connect backend API to persist dismissals.'
      );
    }
  };

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    return filterRecommendations(payload.items, filters);
  }, [payload, filters]);

  const sections = useMemo(() => partitionRecommendationSections(filteredItems, 8), [filteredItems]);
  const activeFilterCount = useMemo(() => countActiveRecommendationFilters(filters), [filters]);

  const handleClearFilters = () => {
    setFilters(DEFAULT_RECOMMENDATION_FILTERS);
    setDraftFilters(DEFAULT_RECOMMENDATION_FILTERS);
  };

  const hasAnyRenderedSection =
    sections.topPicks.length > 0 ||
    sections.becauseYouRead.length > 0 ||
    sections.basedOnInterests.length > 0 ||
    sections.studentsLikeYou.length > 0 ||
    sections.highlyRatedSubjects.length > 0 ||
    sections.availableNow.length > 0 ||
    sections.readAgain.length > 0;

  return (
    <div className="space-y-6">
      {/* Page Header Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Personalised Library Engine</span>
            </div>
            <h2 className="font-display mt-1 text-xl font-bold text-[#142B4A] sm:text-2xl">
              Recommended for You
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[#64748B]">
              Discover books tailored to your interests, reading history, and student preferences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void fetchRecommendations({ isRefresh: true })}
              disabled={isLoading || isRefreshing}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Recommendations'}</span>
            </button>
          </div>
        </div>

        {/* Status notice */}
        {statusNotice && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-3.5 py-2.5 text-xs font-medium text-[#142B4A]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* How your recommendations work */}
        <div className="mt-5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2563EB] shadow-xs">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-[#142B4A]">
                How your recommendations work
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[#1E293B]">
                Picks are ranked from your saved reading interests, preferred academic subjects,
                completed borrowing history, personal ratings, and patterns from students with
                overlapping coursework—filtered to match live library availability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honest Sample Preview Banner */}
      {payload?.is_prototype_sample && !isLoading && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Recommendations Preview:
              </strong>{' '}
              Showing structured development recommendations for {student.name} ready for the live
              hybrid recommendation backend.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/recommendations
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-[#142B4A] shadow-xs">
            <RefreshCw className="h-4 w-4 animate-spin text-[#2563EB]" aria-hidden="true" />
            <span>Finding books for you...</span>
          </div>
          <RecommendationsSkeletonGrid count={4} />
        </section>
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
                Recommendations temporarily unavailable
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">
                {errorMessage ??
                  'We could not reach the recommendation service right now. You can retry or browse the full library catalogue.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => void fetchRecommendations()}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'student-search' })}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  Browse Library
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Recommendation Overview Strip */}
          <section
            aria-label="Personalisation overview"
            className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
              payload.summary.recommendation_confidence ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
            }`}
          >
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold text-[#64748B]">Your Interests</p>
              {payload.summary.interests.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {payload.summary.interests.slice(0, 4).map((interest) => (
                    <span
                      key={interest}
                      className="rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2 py-0.5 text-[11px] font-medium text-[#142B4A]"
                    >
                      {interest}
                    </span>
                  ))}
                  {payload.summary.interests.length > 4 && (
                    <span className="px-1 py-0.5 text-[11px] font-medium text-[#64748B]">
                      +{payload.summary.interests.length - 4} more
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#64748B]">No reading interests selected yet.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold text-[#64748B]">Books Read</p>
              <p className="font-mono-tabular font-display mt-1.5 text-2xl font-bold text-[#142B4A]">
                {payload.summary.books_read}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Completed borrowings guiding content matches
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <p className="text-xs font-semibold text-[#64748B]">Books Rated</p>
              <p className="font-mono-tabular font-display mt-1.5 text-2xl font-bold text-[#142B4A]">
                {payload.summary.books_rated}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                Student reviews weighting similar titles
              </p>
            </div>

            {payload.summary.recommendation_confidence && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-xs font-semibold text-[#64748B]">Recommendation Confidence</p>
                <p className="font-display mt-1.5 flex items-center gap-1.5 text-base font-bold text-[#142B4A]">
                  <UserCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <span>{payload.summary.recommendation_confidence}</span>
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  Combined interests, history &amp; peer signals
                </p>
              </div>
            )}
          </section>

          {/* Cold-Start Guidance Banner */}
          {payload.is_cold_start && (
            <section className="rounded-xl border border-[#DBEAFE] bg-white p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F8FC] text-[#2563EB]">
                    <Compass className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-[#142B4A]">
                      Let&apos;s personalise your library
                    </h3>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#64748B]">
                      You don&apos;t have borrowing or rating history yet. Picks below prioritise
                      your saved registration interests and popular subject resources—borrow or rate
                      a book to unlock deeper matches.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'student-profile' })}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    Update My Interests
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate({ name: 'student-search' })}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                  >
                    Explore Library
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Optional Filter Toolbar */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-[#142B4A]">
                  Showing {filteredItems.length}{' '}
                  {filteredItems.length === 1 ? 'recommendation' : 'recommendations'}
                </span>
                {activeFilterCount > 0 && (
                  <span className="rounded-md bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                    {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'} active
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:border-slate-300 hover:text-[#142B4A] cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}

                {/* Desktop toggle */}
                <button
                  type="button"
                  onClick={() => setDesktopFiltersOpen((prev) => !prev)}
                  aria-expanded={desktopFiltersOpen}
                  className="hidden min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] md:inline-flex cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{desktopFiltersOpen ? 'Hide Filters' : 'Refine Recommendations'}</span>
                </button>

                {/* Mobile drawer trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setDraftFilters(filters);
                    setMobileFiltersOpen(true);
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] md:hidden cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Desktop Filter Grid */}
            {desktopFiltersOpen && (
              <div className="mt-4 hidden grid-cols-2 gap-3 border-t border-slate-100 pt-4 md:grid lg:grid-cols-6">
                <FilterSelect
                  id="rec-filter-category"
                  label="Category"
                  value={filters.category}
                  options={payload.facets.categories}
                  placeholder="All Categories"
                  onChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
                />
                <FilterSelect
                  id="rec-filter-subject"
                  label="Subject"
                  value={filters.subject}
                  options={payload.facets.subjects}
                  placeholder="All Subjects"
                  onChange={(value) => setFilters((prev) => ({ ...prev, subject: value }))}
                />
                <div>
                  <label
                    htmlFor="rec-filter-availability"
                    className="block text-[11px] font-semibold text-[#64748B]"
                  >
                    Availability
                  </label>
                  <select
                    id="rec-filter-availability"
                    value={filters.availability}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        availability: e.target.value as RecommendationFilterState['availability'],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    <option value="all">All Availability</option>
                    <option value="available">Available Now</option>
                    <option value="reservable">Issued (Reservable)</option>
                  </select>
                </div>
                <FilterSelect
                  id="rec-filter-language"
                  label="Language"
                  value={filters.language}
                  options={payload.facets.languages}
                  placeholder="All Languages"
                  onChange={(value) => setFilters((prev) => ({ ...prev, language: value }))}
                />
                <div>
                  <label
                    htmlFor="rec-filter-rating"
                    className="block text-[11px] font-semibold text-[#64748B]"
                  >
                    Minimum Rating
                  </label>
                  <select
                    id="rec-filter-rating"
                    value={filters.minRating}
                    onChange={(e) => setFilters((prev) => ({ ...prev, minRating: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    <option value="">All Ratings</option>
                    <option value="4.5">4.5★ &amp; above</option>
                    <option value="4.0">4.0★ &amp; above</option>
                    <option value="3.5">3.5★ &amp; above</option>
                  </select>
                </div>
                <FilterSelect
                  id="rec-filter-format"
                  label="Format"
                  value={filters.format}
                  options={payload.facets.formats}
                  placeholder="All Formats"
                  onChange={(value) => setFilters((prev) => ({ ...prev, format: value }))}
                />
              </div>
            )}
          </section>

          {/* Empty State */}
          {!hasAnyRenderedSection ? (
            <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs sm:p-10">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F8FC] text-[#2563EB]">
                <BookOpen className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
                {activeFilterCount > 0
                  ? 'No recommendations match your active filters'
                  : "We're still learning your preferences"}
              </h3>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
                {activeFilterCount > 0
                  ? 'Clear or adjust your filters to see all personalised book picks.'
                  : 'Explore the library catalogue or update your reading interests to generate personalised recommendations.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                  >
                    Clear Filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'student-search' })}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  Explore Books
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate({ name: 'student-profile' })}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  Update Interests
                </button>
              </div>
            </section>
          ) : (
            <div className="space-y-8">
              {sections.topPicks.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="top-picks"
                  title="Top Picks for You"
                  subtitle="Highest-ranked matches combining your interests, reading history, ratings, and peer activity."
                  items={sections.topPicks}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.becauseYouRead.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="because-you-read"
                  title={
                    payload.because_you_read_anchor
                      ? `Because You Read "${payload.because_you_read_anchor}"`
                      : 'Similar to Books You Previously Read'
                  }
                  subtitle="Content-similar books sharing concepts, methodology, and subject depth."
                  items={sections.becauseYouRead}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.basedOnInterests.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="based-on-interests"
                  title="Based on Your Interests"
                  subtitle="Matched directly to your saved reading topics and preferred academic subjects."
                  items={sections.basedOnInterests}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.studentsLikeYou.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="students-like-you"
                  title="Students Like You Also Read"
                  subtitle="Collaborative picks frequently borrowed and rated highly by students with overlapping reading profiles."
                  items={sections.studentsLikeYou}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.highlyRatedSubjects.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="highly-rated"
                  title="Highly Rated in Your Subjects"
                  subtitle="Top community-reviewed resources in your academic fields."
                  items={sections.highlyRatedSubjects}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.availableNow.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="available-now"
                  title="Available Now"
                  subtitle="Recommended titles ready for immediate borrowing or E-Book access."
                  items={sections.availableNow}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}

              {sections.readAgain.length > 0 && (
                <RecommendationSectionBlock
                  sectionId="read-again"
                  title="Read Again / Continue Exploring"
                  subtitle="Previously completed titles you rated highly—separated from unread picks for quick reference."
                  items={sections.readAgain}
                  onViewDetails={handleOpenBookDetails}
                  onOpenExplain={setExplainItem}
                  onFeedback={handleFeedback}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && payload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter recommendations"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center md:hidden"
        >
          <div
            className="fixed inset-0 bg-[#142B4A]/50"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-bold text-[#142B4A]">
                Filter Recommendations
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

            <div className="mt-4 grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              <FilterSelect
                id="mobile-rec-category"
                label="Category"
                value={draftFilters.category}
                options={payload.facets.categories}
                placeholder="All Categories"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, category: value }))}
              />
              <FilterSelect
                id="mobile-rec-subject"
                label="Subject"
                value={draftFilters.subject}
                options={payload.facets.subjects}
                placeholder="All Subjects"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, subject: value }))}
              />
              <div>
                <label
                  htmlFor="mobile-rec-availability"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Availability
                </label>
                <select
                  id="mobile-rec-availability"
                  value={draftFilters.availability}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      availability: e.target.value as RecommendationFilterState['availability'],
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B]"
                >
                  <option value="all">All Availability</option>
                  <option value="available">Available Now</option>
                  <option value="reservable">Issued (Reservable)</option>
                </select>
              </div>
              <FilterSelect
                id="mobile-rec-language"
                label="Language"
                value={draftFilters.language}
                options={payload.facets.languages}
                placeholder="All Languages"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, language: value }))}
              />
              <div>
                <label
                  htmlFor="mobile-rec-rating"
                  className="block text-[11px] font-semibold text-[#64748B]"
                >
                  Minimum Rating
                </label>
                <select
                  id="mobile-rec-rating"
                  value={draftFilters.minRating}
                  onChange={(e) =>
                    setDraftFilters((prev) => ({ ...prev, minRating: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-[#1E293B]"
                >
                  <option value="">All Ratings</option>
                  <option value="4.5">4.5★ &amp; above</option>
                  <option value="4.0">4.0★ &amp; above</option>
                  <option value="3.5">3.5★ &amp; above</option>
                </select>
              </div>
              <FilterSelect
                id="mobile-rec-format"
                label="Format"
                value={draftFilters.format}
                options={payload.facets.formats}
                placeholder="All Formats"
                onChange={(value) => setDraftFilters((prev) => ({ ...prev, format: value }))}
              />
            </div>

            <div className="mt-5 flex gap-2.5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => {
                  setDraftFilters(DEFAULT_RECOMMENDATION_FILTERS);
                  setFilters(DEFAULT_RECOMMENDATION_FILTERS);
                  setMobileFiltersOpen(false);
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-semibold text-[#142B4A] cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(draftFilters);
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

      {/* Explanation Modal */}
      <RecommendationExplainModal
        item={explainItem}
        onClose={() => setExplainItem(null)}
        onViewDetails={handleOpenBookDetails}
      />
    </div>
  );
}

interface RecommendationSectionBlockProps {
  sectionId: string;
  title: string;
  subtitle: string;
  items: RecommendationItem[];
  onViewDetails: (bookId: number) => void;
  onOpenExplain: (item: RecommendationItem) => void;
  onFeedback: (bookId: number, feedback: RecommendationFeedbackValue) => void;
}

function RecommendationSectionBlock({
  sectionId,
  title,
  subtitle,
  items,
  onViewDetails,
  onOpenExplain,
  onFeedback,
}: RecommendationSectionBlockProps) {
  return (
    <section data-testid={`section-${sectionId}`} aria-labelledby={`heading-${sectionId}`}>
      <div className="mb-3.5 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <div>
          <h3 id={`heading-${sectionId}`} className="font-display text-lg font-bold text-[#142B4A]">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>
        </div>
        <span className="font-mono-tabular text-xs font-medium text-[#64748B]">
          {items.length} {items.length === 1 ? 'book' : 'books'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <RecommendationCard
            key={`${sectionId}-${item.book_id}`}
            item={item}
            sectionId={sectionId}
            onViewDetails={onViewDetails}
            onOpenExplain={onOpenExplain}
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </section>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}

function FilterSelect({ id, label, value, options, placeholder, onChange }: FilterSelectProps) {
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
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

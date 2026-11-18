import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import type { StudentProfile } from '../../utils/studentDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import {
  buildCatalogApiParams,
  buildPaginationTokens,
  countActiveCatalogFilters,
  DEFAULT_CATALOG_QUERY_STATE,
  extractCatalogFilterOptions,
  getBasedOnInterestsBooks,
  parseCatalogQueryFromSearch,
  querySampleCatalog,
  SAMPLE_LIBRARY_CATALOG,
  serializeCatalogQueryToSearch,
  type CatalogQueryResult,
  type CatalogQueryState,
  type CatalogSortOption,
} from '../../utils/bookCatalog';
import { CatalogBookCard, CatalogSkeletonGrid } from './CatalogBookCard';
import { CatalogFiltersPanel } from './CatalogFiltersPanel';

interface BrowseBooksPageProps {
  student: StudentProfile;
  initialQuickSearch?: string;
  onConsumeQuickSearch?: () => void;
  onNavigate: (route: AppRoute) => void;
}

const SORT_OPTIONS: Array<{ value: CatalogSortOption; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest Added' },
  { value: 'title_asc', label: 'Title: A–Z' },
  { value: 'title_desc', label: 'Title: Z–A' },
  { value: 'highest_rated', label: 'Highest Rated' },
  { value: 'most_borrowed', label: 'Most Borrowed' },
  { value: 'recently_published', label: 'Recently Published' },
];

export function BrowseBooksPage({
  student,
  initialQuickSearch,
  onConsumeQuickSearch,
  onNavigate,
}: BrowseBooksPageProps) {
  const [queryState, setQueryState] = useState<CatalogQueryState>(() => {
    const fromUrl = parseCatalogQueryFromSearch(window.location.search);
    if (initialQuickSearch && initialQuickSearch.trim()) {
      return { ...fromUrl, search: initialQuickSearch.trim(), page: 1 };
    }
    return fromUrl;
  });

  const [searchInput, setSearchInput] = useState<string>(queryState.search);
  const [draftFilters, setDraftFilters] = useState<CatalogQueryState>(queryState);
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  const [result, setResult] = useState<CatalogQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Sync incoming quick search from header search bar if provided
  useEffect(() => {
    if (initialQuickSearch && initialQuickSearch.trim()) {
      const trimmed = initialQuickSearch.trim();
      const nextState: CatalogQueryState = {
        ...DEFAULT_CATALOG_QUERY_STATE,
        search: trimmed,
        page: 1,
      };
      setSearchInput(trimmed);
      setQueryState(nextState);
      setDraftFilters(nextState);
      const nextSearch = serializeCatalogQueryToSearch(nextState);
      const targetUrl = `${window.location.pathname}${nextSearch}`;
      window.history.replaceState(null, '', targetUrl);
      onConsumeQuickSearch?.();
    }
  }, [initialQuickSearch, onConsumeQuickSearch]);

  // Listen to browser Back/Forward while staying on /student/search
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseCatalogQueryFromSearch(window.location.search);
      setQueryState(parsed);
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

  // Sync URL query string cleanly whenever applied queryState updates
  const updateUrlWithState = useCallback((nextState: CatalogQueryState) => {
    const nextSearch = serializeCatalogQueryToSearch(nextState);
    const targetUrl = `${window.location.pathname}${nextSearch}`;
    if (`${window.location.pathname}${window.location.search}` !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  }, []);

  const commitQueryState = useCallback(
    (nextState: CatalogQueryState) => {
      setQueryState(nextState);
      setDraftFilters(nextState);
      setSearchInput(nextState.search);
      updateUrlWithState(nextState);
    },
    [updateUrlWithState]
  );

  // Fetch from GET /api/books when VITE_API_BASE_URL is configured; otherwise query structured sample catalogue
  useEffect(() => {
    let isMounted = true;
    const apiBaseUrl = getApiBaseUrl();

    async function fetchCatalog() {
      setIsLoading(true);
      setErrorMessage(null);

      if (isBackendConnected()) {
        try {
          const params = buildCatalogApiParams(queryState);
          const response = await apiFetch(`${apiBaseUrl}/api/books?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });

          if (!response.ok) {
            throw new Error(`Catalogue request failed (${response.status}).`);
          }

          const payload = (await response.json()) as CatalogQueryResult;
          if (isMounted) {
            setResult({
              ...payload,
              facets: payload.facets ?? extractCatalogFilterOptions(payload.items ?? []),
              isPrototypeSample: false,
            });
            setIsLoading(false);
          }
          return;
        } catch (err) {
          if (isMounted) {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : 'Something went wrong while loading the library catalogue.'
            );
            setIsLoading(false);
          }
          return;
        }
      }

      // Development / prototype mode
      await new Promise((resolve) => window.setTimeout(resolve, 110));
      if (isMounted) {
        setResult(querySampleCatalog(SAMPLE_LIBRARY_CATALOG, queryState));
        setIsLoading(false);
      }
    }

    void fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, [queryState, reloadNonce]);

  const activeFilterCount = useMemo(
    () => countActiveCatalogFilters(queryState),
    [queryState]
  );

  const basedOnInterestsBooks = useMemo(
    () =>
      getBasedOnInterestsBooks(
        SAMPLE_LIBRARY_CATALOG,
        student.interests,
        student.preferred_subjects,
        4
      ),
    [student.interests, student.preferred_subjects]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    commitQueryState({
      ...queryState,
      search: searchInput.trim(),
      page: 1,
    });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    commitQueryState({
      ...queryState,
      search: '',
      page: 1,
    });
    searchInputRef.current?.focus();
  };

  const handleClearAllFiltersAndSearch = () => {
    setSearchInput('');
    commitQueryState({ ...DEFAULT_CATALOG_QUERY_STATE });
  };

  const handleClearFiltersOnly = () => {
    commitQueryState({
      ...DEFAULT_CATALOG_QUERY_STATE,
      search: queryState.search,
      sort: queryState.sort,
      page: 1,
    });
  };

  const handleApplyDraftFilters = () => {
    commitQueryState({
      ...draftFilters,
      search: searchInput.trim(),
      page: 1,
    });
  };

  const handleSortChange = (nextSort: CatalogSortOption) => {
    commitQueryState({
      ...queryState,
      sort: nextSort,
      page: 1,
    });
  };

  const handlePageChange = (nextPage: number) => {
    commitQueryState({
      ...queryState,
      page: nextPage,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBookDetails = (bookId: number) => {
    onNavigate({ name: 'book-detail', slug: String(bookId) });
  };

  const facets = result?.facets ?? extractCatalogFilterOptions(SAMPLE_LIBRARY_CATALOG);
  const startRange =
    result && result.total > 0 ? (result.page - 1) * result.limit + 1 : 0;
  const endRange =
    result && result.total > 0
      ? Math.min(result.page * result.limit, result.total)
      : 0;
  const paginationTokens = result
    ? buildPaginationTokens(result.page, result.totalPages)
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section
        aria-labelledby="browse-library-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2563EB]">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Digital Library Catalogue</span>
            </div>
            <h2
              id="browse-library-heading"
              className="font-display mt-1 text-2xl font-bold tracking-tight text-[#142B4A]"
            >
              Browse Library
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Explore our collection and find the right book for your learning journey.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-3.5 py-2 text-sm font-semibold text-[#142B4A] md:self-auto">
            <span className="font-mono-tabular text-[#2563EB]">
              {result ? result.availableCatalogCount.toLocaleString() : '—'}
            </span>
            <span>
              {result?.availableCatalogCount === 1 ? 'book available' : 'books available'}
            </span>
          </div>
        </div>

        {/* Main Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          aria-label="Search library books"
          className="mt-5 flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="catalog-main-search" className="sr-only">
              Search by title, author, subject, ISBN, or keyword
            </label>
            <input
              ref={searchInputRef}
              id="catalog-main-search"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, author, subject, ISBN, or keyword..."
              className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white pr-10 pl-10 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
            {searchInput.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search text"
                className="absolute top-1/2 right-2.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search</span>
          </button>
        </form>

        {/* Controls Bar: Filter Toggle, Results Summary, Sort Dropdown */}
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Desktop toggle */}
            <button
              type="button"
              onClick={() => setDesktopFiltersOpen((prev) => !prev)}
              aria-expanded={desktopFiltersOpen}
              aria-controls="desktop-catalog-filters"
              className={`hidden min-h-[40px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors lg:inline-flex cursor-pointer ${
                desktopFiltersOpen || activeFilterCount > 0
                  ? 'border-[#2563EB] bg-[#DBEAFE]/40 text-[#142B4A]'
                  : 'border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-[#2563EB] px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Mobile drawer trigger */}
            <button
              type="button"
              onClick={() => {
                setDraftFilters(queryState);
                setMobileFiltersOpen(true);
              }}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors lg:hidden cursor-pointer ${
                activeFilterCount > 0
                  ? 'border-[#2563EB] bg-[#DBEAFE]/40 text-[#142B4A]'
                  : 'border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-[#2563EB] px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleClearFiltersOnly}
                className="min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Clear All
              </button>
            )}

            {/* Dynamic result summary */}
            {!isLoading && result && (
              <p className="text-xs text-[#64748B]" aria-live="polite">
                {queryState.search.trim() ? (
                  <>
                    Search results for{' '}
                    <strong className="font-semibold text-[#142B4A]">
                      &ldquo;{queryState.search.trim()}&rdquo;
                    </strong>{' '}
                    —{' '}
                    <span className="font-mono-tabular font-semibold text-[#142B4A]">
                      {result.total}
                    </span>{' '}
                    {result.total === 1 ? 'book found' : 'books found'}
                  </>
                ) : result.total > 0 ? (
                  <>
                    Showing{' '}
                    <span className="font-mono-tabular font-semibold text-[#142B4A]">
                      {startRange}–{endRange}
                    </span>{' '}
                    of{' '}
                    <span className="font-mono-tabular font-semibold text-[#142B4A]">
                      {result.total.toLocaleString()}
                    </span>{' '}
                    books
                  </>
                ) : (
                  <span>0 books matched</span>
                )}
              </p>
            )}
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="catalog-sort-select"
              className="shrink-0 text-xs font-semibold text-[#64748B]"
            >
              Sort by
            </label>
            <select
              id="catalog-sort-select"
              value={queryState.sort}
              onChange={(e) => handleSortChange(e.target.value as CatalogSortOption)}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-[#142B4A] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Collapsible Desktop Filter Panel + Mobile Filter Drawer */}
      <CatalogFiltersPanel
        draftFilters={draftFilters}
        facets={facets}
        desktopOpen={desktopFiltersOpen}
        mobileOpen={mobileFiltersOpen}
        onDraftChange={(patch) =>
          setDraftFilters((prev) => ({ ...prev, ...patch }))
        }
        onApply={handleApplyDraftFilters}
        onClearAll={handleClearFiltersOnly}
        onCloseMobile={() => setMobileFiltersOpen(false)}
      />

      {/* Prototype / Backend Readiness Note */}
      {result?.isPrototypeSample && !isLoading && !errorMessage && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-2.5 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Library Catalogue:
              </strong>{' '}
              Displaying {SAMPLE_LIBRARY_CATALOG.length} structured book records formatted for
              server-side search, filtering, and pagination.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/books
          </span>
        </div>
      )}

      {/* Main Results Region */}
      {isLoading ? (
        <CatalogSkeletonGrid count={8} />
      ) : errorMessage ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <AlertCircle className="mx-auto h-9 w-9 text-red-600" aria-hidden="true" />
          <h3 className="font-display mt-3 text-lg font-bold text-[#142B4A]">
            Unable to load books
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Something went wrong while loading the library catalogue.
          </p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Try Again
          </button>
        </section>
      ) : !result || result.items.length === 0 ? (
        <section
          aria-label="Empty search results"
          className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs sm:p-10"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F8FC]">
            <Search className="h-6 w-6 text-[#2563EB]" aria-hidden="true" />
          </div>
          <h3 className="font-display mt-4 text-xl font-bold text-[#142B4A]">
            No books found
          </h3>
          <p className="mt-1.5 text-sm text-[#64748B]">
            We couldn&apos;t find books matching your search.
          </p>

          <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left text-xs text-[#64748B]">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              <span>Check spelling.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              <span>Try a broader keyword.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              <span>Remove some filters.</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              <span>Browse all books.</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={handleClearAllFiltersAndSearch}
            className="mt-6 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Clear Search
          </button>
        </section>
      ) : (
        <>
          <section aria-label="Library catalogue results">
            <div
              data-testid="catalog-results-grid"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {result.items.map((book) => (
                <CatalogBookCard
                  key={book.book_id}
                  book={book}
                  onOpenDetails={handleOpenBookDetails}
                />
              ))}
            </div>
          </section>

          {/* Pagination */}
          <nav
            aria-label="Catalogue pagination"
            className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs sm:flex-row"
          >
            <p className="text-xs text-[#64748B]">
              Showing{' '}
              <span className="font-mono-tabular font-semibold text-[#142B4A]">
                {startRange}–{endRange}
              </span>{' '}
              of{' '}
              <span className="font-mono-tabular font-semibold text-[#142B4A]">
                {result.total.toLocaleString()}
              </span>{' '}
              books
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(result.page - 1)}
                disabled={result.page <= 1}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Previous</span>
              </button>

              {paginationTokens.map((token, idx) =>
                token === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-xs text-[#64748B]"
                    aria-hidden="true"
                  >
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handlePageChange(token)}
                    aria-current={token === result.page ? 'page' : undefined}
                    className={`font-mono-tabular inline-flex h-[38px] min-w-[38px] items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                      token === result.page
                        ? 'border-[#142B4A] bg-[#142B4A] text-white'
                        : 'border-slate-200 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB]'
                    }`}
                  >
                    {token}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => handlePageChange(result.page + 1)}
                disabled={result.page >= result.totalPages}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </nav>
        </>
      )}

      {/* Optional Personalised Discovery Below Neutral Catalogue */}
      {basedOnInterestsBooks.length > 0 && (
        <section
          aria-labelledby="based-on-interests-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
        >
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Personalised Discovery</span>
              </div>
              <h3
                id="based-on-interests-heading"
                className="font-display mt-1 text-lg font-bold text-[#142B4A]"
              >
                Based on Your Interests
              </h3>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Available titles aligned with {student.interests.slice(0, 3).join(', ')} (kept
                separate from the neutral catalogue above).
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-recommendations' })}
              className="self-start text-xs font-semibold text-[#2563EB] hover:underline sm:self-auto cursor-pointer"
            >
              Open Full Recommendations
            </button>
          </div>

          <div
            data-testid="based-on-interests-grid"
            className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {basedOnInterestsBooks.map((book) => (
              <CatalogBookCard
                key={`interest-${book.book_id}`}
                book={book}
                onOpenDetails={handleOpenBookDetails}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

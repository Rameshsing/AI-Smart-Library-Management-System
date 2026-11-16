import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  BookOpen,
  BookPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  Filter,
  Info,
  Layers,
  MoreHorizontal,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import type { LibrarianPermissions } from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import {
  buildInventoryApiParams,
  countActiveInventoryFilters,
  createSampleInventoryStore,
  DEFAULT_INVENTORY_FILTERS,
  INVENTORY_SORT_LABELS,
  querySampleInventory,
  type BookFormDraft,
  type CopyCondition,
  type CopyStatus,
  type InventoryBookItem,
  type InventoryBooksResponse,
  type InventoryCopiesResponse,
  type InventoryFilterState,
  type InventoryPhysicalCopy,
  type InventorySortKey,
} from '../../utils/librarianInventory';
import { InventoryFiltersDrawer } from './InventoryFiltersDrawer';
import {
  BookDetailsModal,
  getTitleStatusBadge,
  ManageCopiesModal,
} from './InventoryDetailsAndCopiesModals';
import { ArchiveBookModal, BookEditorModal } from './InventoryFormAndArchiveModals';

interface LibrarianInventoryPageProps {
  permissions: LibrarianPermissions;
  initialOpenAddBook?: boolean;
  onNavigate: (route: AppRoute) => void;
}

function InventoryCoverThumb({ src, title }: { src: string; title: string }) {
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
      alt={`Cover of ${title}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-12 w-9 shrink-0 rounded border border-slate-200 object-cover"
    />
  );
}

export function LibrarianInventoryPage({
  permissions,
  initialOpenAddBook = false,
  onNavigate,
}: LibrarianInventoryPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const sampleStoreRef = useRef(createSampleInventoryStore());
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const [filters, setFilters] = useState<InventoryFilterState>(DEFAULT_INVENTORY_FILTERS);
  const [searchInput, setSearchInput] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const [inventoryData, setInventoryData] = useState<InventoryBooksResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ kind: 'success' | 'info'; message: string } | null>(null);

  // Modals & row action menus
  const [viewBook, setViewBook] = useState<InventoryBookItem | null>(null);
  const [copiesBook, setCopiesBook] = useState<InventoryBookItem | null>(null);
  const [copiesList, setCopiesList] = useState<InventoryPhysicalCopy[]>([]);
  const [isLoadingCopies, setIsLoadingCopies] = useState<boolean>(false);
  const [copiesError, setCopiesError] = useState<string | null>(null);

  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    book: InventoryBookItem | null;
  }>({
    open: initialOpenAddBook && permissions.can_manage_inventory,
    mode: 'create',
    book: null,
  });

  const [archiveTarget, setArchiveTarget] = useState<InventoryBookItem | null>(null);
  const [openMoreBookId, setOpenMoreBookId] = useState<number | null>(null);
  const [expandedMobileIds, setExpandedMobileIds] = useState<Record<number, boolean>>({});
  const [importNoticeOpen, setImportNoticeOpen] = useState<boolean>(false);

  useEffect(() => {
    if (initialOpenAddBook && permissions.can_manage_inventory) {
      setEditorState({ open: true, mode: 'create', book: null });
    }
  }, [initialOpenAddBook, permissions.can_manage_inventory]);

  useEffect(() => {
    const closeMore = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-more-menu="true"]')) {
        setOpenMoreBookId(null);
      }
    };
    document.addEventListener('mousedown', closeMore);
    return () => document.removeEventListener('mousedown', closeMore);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const fetchInventory = useCallback(
    async (activeFilters: InventoryFilterState) => {
      setIsLoading(true);
      setLoadError(null);

      if (!hasBackendApi) {
        await new Promise((resolve) => window.setTimeout(resolve, 110));
        const res = querySampleInventory(sampleStoreRef.current, activeFilters);
        setInventoryData(res);
        setIsLoading(false);
        return;
      }

      try {
        const params = buildInventoryApiParams(activeFilters);
        const response = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books?${params.toString()}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }
        );

        if (response.status === 401) {
          onNavigateRef.current({ name: 'admin-login' });
          return;
        }
        if (response.status === 403) {
          throw new Error('Your staff role is not authorized to view book inventory.');
        }
        if (!response.ok) {
          throw new Error(`Inventory request failed (${response.status}).`);
        }

        const payload = (await response.json()) as InventoryBooksResponse;
        setInventoryData({ ...payload, is_prototype_sample: false });
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : "We couldn't retrieve the latest library inventory."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, hasBackendApi]
  );

  useEffect(() => {
    void fetchInventory(filters);
  }, [fetchInventory, filters]);

  const loadCopiesForBook = useCallback(
    async (book: InventoryBookItem) => {
      setCopiesBook(book);
      setIsLoadingCopies(true);
      setCopiesError(null);

      if (!hasBackendApi) {
        await new Promise((resolve) => window.setTimeout(resolve, 70));
        setCopiesList(sampleStoreRef.current.copiesByBookId[book.book_id] ?? []);
        setIsLoadingCopies(false);
        return;
      }

      try {
        const response = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${book.book_id}/copies`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }
        );
        if (!response.ok) {
          throw new Error(`Unable to retrieve physical copies (${response.status}).`);
        }
        const payload = (await response.json()) as InventoryCopiesResponse;
        setCopiesList(payload.items ?? []);
      } catch (err) {
        setCopiesError(
          err instanceof Error ? err.message : 'Unable to retrieve physical copies.'
        );
      } finally {
        setIsLoadingCopies(false);
      }
    },
    [apiBaseUrl, hasBackendApi]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setFilters(DEFAULT_INVENTORY_FILTERS);
  };

  const handleSubmitBookForm = async (
    draft: BookFormDraft
  ): Promise<{ ok: boolean; message: string }> => {
    if (!hasBackendApi) {
      return {
        ok: false,
        message:
          editorState.mode === 'create'
            ? 'Validation passed, but backend API is not configured (VITE_API_BASE_URL unset). Connect POST /api/librarian/books to persist new titles and physical copies.'
            : `Validation passed, but backend API is not configured (VITE_API_BASE_URL unset). Connect PUT /api/librarian/books/${editorState.book?.book_id ?? ''} to save changes.`,
      };
    }

    try {
      const endpoint =
        editorState.mode === 'create'
          ? `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books`
          : `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${editorState.book?.book_id}`;
      const method = editorState.mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          subtitle: draft.subtitle.trim(),
          authors: draft.authors.trim(),
          isbn: draft.isbn.trim(),
          publisher: draft.publisher.trim(),
          publication_year: Number.parseInt(draft.publication_year, 10),
          edition: draft.edition.trim(),
          language: draft.language.trim(),
          pages: Number.parseInt(draft.pages, 10),
          category: draft.category.trim(),
          subject: draft.subject.trim(),
          keywords: draft.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          description: draft.description.trim(),
          format: draft.format,
          cover_image: draft.cover_image.trim() || null,
          ...(editorState.mode === 'create'
            ? { initial_copies: Number.parseInt(draft.initial_copies, 10) }
            : {}),
          branch: draft.branch.trim(),
          floor: draft.floor.trim(),
          section: draft.section.trim(),
          shelf: draft.shelf.trim(),
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { message?: string } | null;
        return {
          ok: false,
          message: errBody?.message ?? `Server rejected inventory update (${response.status}).`,
        };
      }

      setToast({
        kind: 'success',
        message:
          editorState.mode === 'create'
            ? `Added "${draft.title.trim()}" to the catalogue.`
            : `Updated metadata for "${draft.title.trim()}".`,
      });
      await fetchInventory(filters);
      return { ok: true, message: 'Saved.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to reach inventory API.',
      };
    }
  };

  const handleConfirmArchive = async (
    book: InventoryBookItem
  ): Promise<{ ok: boolean; message: string }> => {
    if (!hasBackendApi) {
      return {
        ok: false,
        message: `Backend API is not configured (VITE_API_BASE_URL unset). Archiving requires server confirmation via POST /api/librarian/books/${book.book_id}/archive.`,
      };
    }

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${book.book_id}/archive`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { message?: string } | null;
        return {
          ok: false,
          message: errBody?.message ?? `Unable to archive book (${response.status}).`,
        };
      }

      setToast({
        kind: 'success',
        message: `Archived "${book.title}". Historical borrowing records remain preserved.`,
      });
      await fetchInventory(filters);
      return { ok: true, message: 'Archived.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to connect to archive endpoint.',
      };
    }
  };

  const handleUpdateCopy = async (
    copy: InventoryPhysicalCopy,
    updates: { status: CopyStatus; condition: CopyCondition; shelf: string }
  ): Promise<{ ok: boolean; message: string }> => {
    if (!hasBackendApi) {
      return {
        ok: false,
        message: `Validation passed for ${copy.accession_number}, but backend API is not configured (VITE_API_BASE_URL unset). Connect PUT /api/librarian/copies/${copy.copy_id} to persist physical copy updates.`,
      };
    }

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/copies/${copy.copy_id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { message?: string } | null;
        return {
          ok: false,
          message: errBody?.message ?? `Server rejected copy update (${response.status}).`,
        };
      }

      if (copiesBook) {
        await loadCopiesForBook(copiesBook);
      }
      await fetchInventory(filters);
      return { ok: true, message: `Updated copy ${copy.accession_number}.` };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to update physical copy.',
      };
    }
  };

  const handleAddCopy = async (payload: {
    accession_number: string;
    barcode: string;
    condition: CopyCondition;
    branch: string;
    floor: string;
    section: string;
    shelf: string;
  }): Promise<{ ok: boolean; message: string }> => {
    if (!copiesBook) return { ok: false, message: 'No book selected.' };

    if (!hasBackendApi) {
      return {
        ok: false,
        message: `Unique copy identifier ${payload.accession_number} validated, but backend API is not configured (VITE_API_BASE_URL unset). Connect POST /api/librarian/books/${copiesBook.book_id}/copies to register copies.`,
      };
    }

    try {
      const response = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books/${copiesBook.book_id}/copies`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as { message?: string } | null;
        return {
          ok: false,
          message: errBody?.message ?? `Server rejected copy creation (${response.status}).`,
        };
      }

      await loadCopiesForBook(copiesBook);
      await fetchInventory(filters);
      return {
        ok: true,
        message: `Registered physical copy ${payload.accession_number}.`,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to add physical copy.',
      };
    }
  };

  const handleExportInventory = () => {
    if (!hasBackendApi || !inventoryData?.capabilities.can_export_inventory) return;
    const params = buildInventoryApiParams(filters);
    window.location.assign(
      `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/inventory/export?${params.toString()}`
    );
  };

  const activeFilterCount = countActiveInventoryFilters(filters);
  const allKnownAccessions = useMemo(
    () =>
      Object.values(sampleStoreRef.current.copiesByBookId)
        .flat()
        .map((c) => c.accession_number),
    []
  );

  const summaryCards = inventoryData
    ? [
        {
          label: 'Total Titles',
          value: inventoryData.summary.total_titles,
          helper: 'Unique catalogue books',
          tone: 'text-[#142B4A]',
        },
        {
          label: 'Total Copies',
          value: inventoryData.summary.total_copies,
          helper: 'Physical copies tracked',
          tone: 'text-[#142B4A]',
        },
        {
          label: 'Available',
          value: inventoryData.summary.available_copies,
          helper: 'Ready on shelf',
          tone: 'text-emerald-700',
        },
        {
          label: 'Issued',
          value: inventoryData.summary.issued_copies,
          helper: 'Checked out to students',
          tone: 'text-[#2563EB]',
        },
        {
          label: 'Reserved/Held',
          value: inventoryData.summary.reserved_copies,
          helper: 'Assigned to holds',
          tone: 'text-indigo-700',
        },
        {
          label: 'Unavailable',
          value: inventoryData.summary.unavailable_copies,
          helper: 'Lost, damaged or repair',
          tone: 'text-red-700',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* 3. Page Header */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Book Inventory
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Manage the library catalogue, physical book copies, availability, categories, and
            collection details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {inventoryData?.capabilities.can_export_inventory && (
            <button
              type="button"
              onClick={handleExportInventory}
              disabled={isLoading || !inventoryData}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export Inventory</span>
            </button>
          )}

          {permissions.can_manage_inventory && (
            <button
              type="button"
              onClick={() => setImportNoticeOpen((prev) => !prev)}
              aria-expanded={importNoticeOpen}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
              <span>
                Import Books
                {!inventoryData?.capabilities.can_import_books ? ' (Backend Pending)' : ''}
              </span>
            </button>
          )}

          {permissions.can_manage_inventory && (
            <button
              type="button"
              disabled={isLoading && !inventoryData}
              onClick={() => onNavigate({ name: 'librarian-add-book' })}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <BookPlus className="h-4 w-4" aria-hidden="true" />
              <span>Add New Book</span>
            </button>
          )}
        </div>
      </section>

      {toast && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>{toast.message}</span>
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 hover:bg-emerald-100 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {importNoticeOpen && (
        <div
          role="region"
          aria-label="Bulk CSV import integration status"
          className="flex flex-col justify-between gap-3 rounded-xl border border-[#DBEAFE] bg-white p-4 text-xs shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[#142B4A]">
                Bulk CSV Book Import — Backend Integration Point
              </p>
              <p className="mt-0.5 text-[#64748B]">
                Server-side CSV schema validation, duplicate ISBN detection, and row-by-row import
                review activate automatically once <code>POST /api/librarian/inventory/import</code>{' '}
                is enabled on the Flask backend.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportNoticeOpen(false)}
            className="self-end rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] sm:self-center cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {inventoryData?.is_prototype_sample && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Catalogue &amp; Copy Store Preview:
              </strong>{' '}
              Displaying sample titles and individual physical copy records (1 Title → Many Copies).
              All write operations validate inputs locally and require a connected Flask backend.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/librarian/books
          </span>
        </div>
      )}

      {/* 4. Inventory Summary */}
      <section aria-label="Inventory summary statistics">
        {isLoading && !inventoryData ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="h-24 rounded-xl border border-slate-200 bg-white p-4" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <p className="text-xs font-semibold text-[#64748B]">{card.label}</p>
                <p
                  className={`font-mono-tabular mt-1.5 text-2xl font-bold tracking-tight ${card.tone}`}
                >
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-[#64748B]">{card.helper}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5, 6, 7. Search, Filter Toggle & Sort Toolbar */}
      <section
        aria-label="Search, filter, and sort inventory"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search inventory"
                placeholder="Search books by title, author, ISBN, accession number, or keyword..."
                value={searchInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchInput(val);
                  if (val === '' && filters.search !== '') {
                    setFilters((prev) => ({ ...prev, search: '', page: 1 }));
                  }
                }}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] py-2 pr-3 pl-9 text-xs text-[#1E293B] placeholder:text-slate-500 focus:border-[#2563EB] focus:bg-white focus:outline-none sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-[40px] rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3d66] disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-[#2563EB] bg-[#EFF6FF] text-[#142B4A]'
                  : 'border-slate-300 bg-white text-[#142B4A] hover:border-[#2563EB]'
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="font-mono-tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-[#2563EB] px-1 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2">
              <label htmlFor="inv-sort-select" className="text-xs font-semibold text-[#64748B]">
                Sort:
              </label>
              <select
                id="inv-sort-select"
                value={filters.sort}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sort: e.target.value as InventorySortKey,
                    page: 1,
                  }))
                }
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-[#142B4A] focus:border-[#2563EB] focus:outline-none"
              >
                {(
                  inventoryData?.capabilities.supported_sort_options ?? [
                    'recently_added',
                    'recently_updated',
                    'title_asc',
                    'title_desc',
                    'author_asc',
                    'publication_year',
                    'most_borrowed',
                    'least_available',
                    'highest_rated',
                  ]
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {INVENTORY_SORT_LABELS[opt]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {inventoryData && (
        <InventoryFiltersDrawer
          isOpen={filtersOpen}
          filters={filters}
          facets={inventoryData.facets}
          capabilities={inventoryData.capabilities}
          onClose={() => setFiltersOpen(false)}
          onApply={(next) => setFilters(next)}
          onClearAll={handleClearFilters}
        />
      )}

      {/* 8, 9, 28, 29, 30. Main Catalogue Table / Cards / Loading / Error / Empty */}
      {loadError ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
            Unable to load inventory
          </h3>
          <p className="mt-1 text-sm text-[#64748B]">
            We couldn&apos;t retrieve the latest library inventory.
          </p>
          <p className="mt-1 text-xs text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void fetchInventory(filters)}
            className="mt-5 inline-flex min-h-[40px] items-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Retry
          </button>
        </section>
      ) : isLoading ? (
        <section
          aria-label="Loading library inventory"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 animate-pulse"
        >
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-16 rounded-lg bg-slate-100" />
          ))}
        </section>
      ) : !inventoryData || inventoryData.items.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-xs">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h3 className="font-display mt-3 text-lg font-bold text-[#142B4A]">No books found</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            {filters.search.trim() || activeFilterCount > 0
              ? 'No books match your current search and filters.'
              : 'Your library catalogue is currently empty.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {(filters.search.trim() || activeFilterCount > 0) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
              >
                Clear Filters
              </button>
            )}
            {permissions.can_manage_inventory && (
              <button
                type="button"
                onClick={() => onNavigate({ name: 'librarian-add-book' })}
                className="min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                + Add New Book
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {/* Desktop / Tablet Data Table */}
          <div className="hidden rounded-xl border border-slate-200 bg-white shadow-xs md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                    <th scope="col" className="py-2.5 pl-3 pr-2">
                      Cover
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Title
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Author
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      ISBN
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Category
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Subject
                    </th>
                    <th scope="col" className="px-1.5 py-2.5 text-right">
                      Total
                    </th>
                    <th scope="col" className="px-1.5 py-2.5 text-right">
                      Avail.
                    </th>
                    <th scope="col" className="px-1.5 py-2.5 text-right">
                      Issued
                    </th>
                    <th scope="col" className="px-1.5 py-2.5 text-right">
                      Resv.
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="py-2.5 pl-2 pr-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryData.items.map((book) => {
                    const badge = getTitleStatusBadge(book.availability_status);
                    const moreOpen = openMoreBookId === book.book_id;

                    return (
                      <tr key={book.book_id} className="hover:bg-[#F5F8FC]/60">
                        <td className="py-2.5 pl-3 pr-2">
                          <InventoryCoverThumb src={book.cover_image} title={book.title} />
                        </td>
                        <td className="max-w-[165px] px-2 py-2.5">
                          <p className="line-clamp-2 font-semibold text-[#142B4A]">{book.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#64748B]">
                            {book.format} ·{' '}
                            <span className="font-mono-tabular">{book.shelf}</span>
                          </p>
                        </td>
                        <td className="max-w-[115px] px-2 py-2.5 text-[#1E293B]">
                          <p className="line-clamp-2">{book.authors}</p>
                        </td>
                        <td className="font-mono-tabular px-2 py-2.5 text-[11px] text-[#64748B] whitespace-nowrap">
                          {book.isbn}
                        </td>
                        <td className="max-w-[100px] px-2 py-2.5 text-[#1E293B]">
                          <p className="line-clamp-2">{book.category}</p>
                        </td>
                        <td className="max-w-[100px] px-2 py-2.5 text-[#64748B]">
                          <p className="line-clamp-2">{book.subject}</p>
                        </td>
                        <td className="font-mono-tabular px-1.5 py-2.5 text-right font-semibold text-[#142B4A]">
                          {book.total_copies}
                        </td>
                        <td className="font-mono-tabular px-1.5 py-2.5 text-right font-semibold text-emerald-700">
                          {book.available_copies}
                        </td>
                        <td className="font-mono-tabular px-1.5 py-2.5 text-right font-semibold text-[#2563EB]">
                          {book.issued_copies}
                        </td>
                        <td className="font-mono-tabular px-1.5 py-2.5 text-right font-semibold text-indigo-700">
                          {book.reserved_copies}
                        </td>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                          >
                            {badge.icon}
                            <span>{book.availability_status}</span>
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 pr-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewBook(book)}
                              aria-label={`View ${book.title}`}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                            >
                              <Eye className="h-3 w-3" aria-hidden="true" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void loadCopiesForBook(book)}
                              aria-label={`Manage copies for ${book.title}`}
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:border-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer"
                            >
                              <Layers className="h-3 w-3" aria-hidden="true" />
                              <span>Copies</span>
                            </button>
                            {permissions.can_manage_inventory && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorState({ open: true, mode: 'edit', book })
                                }
                                aria-label={`Edit ${book.title}`}
                                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-slate-200 bg-white text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                              >
                                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                            <div data-more-menu="true" className="relative">
                              <button
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={moreOpen}
                                aria-label={`More actions for ${book.title}`}
                                onClick={() =>
                                  setOpenMoreBookId((prev) =>
                                    prev === book.book_id ? null : book.book_id
                                  )
                                }
                                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-slate-200 bg-white text-[#64748B] hover:border-[#2563EB] hover:text-[#142B4A] cursor-pointer"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              {moreOpen && (
                                <div
                                  role="menu"
                                  className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMoreBookId(null);
                                      setViewBook(book);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[#1E293B] hover:bg-[#F5F8FC] cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                                    <span>View Full Details</span>
                                  </button>
                                  {permissions.can_manage_inventory && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setOpenMoreBookId(null);
                                        setArchiveTarget(book);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Archive Book</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 9. Mobile Inventory Cards */}
          <div className="space-y-3 md:hidden">
            {inventoryData.items.map((book) => {
              const badge = getTitleStatusBadge(book.availability_status);
              const expanded = Boolean(expandedMobileIds[book.book_id]);

              return (
                <article
                  key={book.book_id}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <InventoryCoverThumb src={book.cover_image} title={book.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-sm font-bold text-[#142B4A]">
                          {book.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-[#64748B]">{book.authors}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.classes}`}
                        >
                          {badge.icon}
                          <span>
                            {book.availability_status} — {book.available_copies} of{' '}
                            {book.total_copies}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[#64748B]">
                      <p>
                        ISBN: <span className="font-mono-tabular text-[#142B4A]">{book.isbn}</span>{' '}
                        · {book.category} / {book.subject}
                      </p>
                      <p className="font-mono-tabular">
                        Total: {book.total_copies} · Available: {book.available_copies} · Issued:{' '}
                        {book.issued_copies} · Reserved: {book.reserved_copies}
                      </p>
                      <p>
                        Shelf: <span className="font-mono-tabular">{book.shelf}</span> ({book.floor}
                        )
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadCopiesForBook(book)}
                      className="min-h-[38px] flex-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Manage Copies
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewBook(book)}
                      className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] cursor-pointer"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedMobileIds((prev) => ({
                          ...prev,
                          [book.book_id]: !prev[book.book_id],
                        }))
                      }
                      className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#64748B] cursor-pointer"
                    >
                      {expanded ? 'Less' : 'More Details'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Server-side Pagination Bar */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:flex-row">
            <p className="font-mono-tabular text-[#64748B]">
              Showing {inventoryData.items.length} of {inventoryData.total} titles · Page{' '}
              {inventoryData.page} of {inventoryData.total_pages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={inventoryData.page <= 1}
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                }
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-[#142B4A] hover:border-[#2563EB] disabled:opacity-45 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                disabled={inventoryData.page >= inventoryData.total_pages}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: Math.min(inventoryData.total_pages, prev.page + 1),
                  }))
                }
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-[#142B4A] hover:border-[#2563EB] disabled:opacity-45 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Modals */}
      <BookDetailsModal
        book={viewBook}
        capabilities={
          inventoryData?.capabilities ?? sampleStoreRef.current.capabilities
        }
        canModify={permissions.can_manage_inventory}
        onClose={() => setViewBook(null)}
        onEdit={(book) => setEditorState({ open: true, mode: 'edit', book })}
        onManageCopies={(book) => void loadCopiesForBook(book)}
        onArchive={(book) => setArchiveTarget(book)}
      />

      <ManageCopiesModal
        book={copiesBook}
        copies={copiesList}
        isLoading={isLoadingCopies}
        error={copiesError}
        capabilities={
          inventoryData?.capabilities ?? sampleStoreRef.current.capabilities
        }
        canModify={permissions.can_manage_inventory}
        hasBackendApi={hasBackendApi}
        onClose={() => setCopiesBook(null)}
        onRetryLoad={() => {
          if (copiesBook) void loadCopiesForBook(copiesBook);
        }}
        onUpdateCopy={handleUpdateCopy}
        onAddCopy={handleAddCopy}
      />

      <BookEditorModal
        isOpen={editorState.open}
        mode={editorState.mode}
        editingBook={editorState.book}
        existingBooks={inventoryData?.items ?? sampleStoreRef.current.books}
        existingAccessionNumbers={allKnownAccessions}
        capabilities={
          inventoryData?.capabilities ?? sampleStoreRef.current.capabilities
        }
        hasBackendApi={hasBackendApi}
        onClose={() => setEditorState((prev) => ({ ...prev, open: false }))}
        onSubmit={handleSubmitBookForm}
      />

      <ArchiveBookModal
        book={archiveTarget}
        hasBackendApi={hasBackendApi}
        onClose={() => setArchiveTarget(null)}
        onConfirmArchive={handleConfirmArchive}
      />
    </div>
  );
}

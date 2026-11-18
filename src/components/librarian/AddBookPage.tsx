import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info, Lock } from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import type { LibrarianPermissions } from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import {
  generateAccessionNumbers,
  type InventoryBookItem,
  type InventoryBooksResponse,
} from '../../utils/librarianInventory';
import {
  addKeywordTag,
  buildAddBookTransactionPayload,
  createBulkPhysicalCopyDrafts,
  createInitialAddBookFormState,
  createSampleAddBookMetadata,
  detectDuplicateBook,
  formatLocationSummary,
  hasUnsavedAddBookChanges,
  mapAddBookApiError,
  normalizeIsbn,
  removeKeywordTag,
  validateAddBookForm,
  validateIsbnInput,
  type AddBookCopyDraft,
  type AddBookCreatedResult,
  type AddBookFormState,
  type AddBookMetadata,
  type AddBookValidationErrors,
  type DuplicateBookMatch,
} from '../../utils/addBookPage';
import {
  BasicInfoSection,
  BibliographicInfoSection,
  BookCoverSection,
  ClassificationDiscoverySection,
  DuplicateWarningBanner,
  LibraryInfoSection,
  PhysicalCopiesSection,
} from './AddBookSections';
import {
  AddBookProgressSidebar,
  AddBookSuccessView,
  ExistingBookPreviewModal,
  ReviewAndSubmitSection,
  UnsavedChangesModal,
} from './AddBookReviewAndModals';

interface AddBookPageProps {
  permissions: LibrarianPermissions;
  onNavigate: (route: AppRoute) => void;
  onRegisterUnsavedGuard?: (
    guard: ((targetRoute: AppRoute) => boolean) | null
  ) => void;
}

const EMPTY_ERRORS: AddBookValidationErrors = { copyRowErrors: {} };

export function AddBookPage({
  permissions,
  onNavigate,
  onRegisterUnsavedGuard,
}: AddBookPageProps) {
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const [metadata, setMetadata] = useState<AddBookMetadata>(() =>
    createSampleAddBookMetadata()
  );
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(hasBackendApi);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  const initialBaselineRef = useRef<AddBookFormState>(
    createInitialAddBookFormState(
      metadata.accession_prefix_format,
      metadata.existingAccessionNumbers
    )
  );

  const [form, setForm] = useState<AddBookFormState>(initialBaselineRef.current);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<AddBookValidationErrors>(EMPTY_ERRORS);
  const [hasSubmittedAttempt, setHasSubmittedAttempt] = useState<boolean>(false);

  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateBookMatch | null>(null);
  const [duplicateOverrideAccepted, setDuplicateOverrideAccepted] = useState<boolean>(false);
  const [previewExistingBook, setPreviewExistingBook] = useState<InventoryBookItem | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<AddBookCreatedResult | null>(null);

  const [pendingLeaveRoute, setPendingLeaveRoute] = useState<AppRoute | null>(null);
  const submitLockRef = useRef<boolean>(false);

  const loadMetadata = useCallback(async () => {
    if (!hasBackendApi) {
      const sample = createSampleAddBookMetadata();
      setMetadata(sample);
      setIsLoadingMetadata(false);
      setMetadataError(null);
      return;
    }

    setIsLoadingMetadata(true);
    setMetadataError(null);
    try {
      const base = apiBaseUrl.replace(/\/+$/, '');
      const [metaRes, booksRes] = await Promise.all([
        apiFetch(`${base}/api/librarian/books/metadata`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
        apiFetch(`${base}/api/librarian/books?limit=50`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        }),
      ]);

      if (metaRes.status === 401 || booksRes.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      if (!metaRes.ok) {
        throw new Error(`Unable to load catalogue taxonomy (${metaRes.status}).`);
      }

      const metaJson = (await metaRes.json()) as Partial<AddBookMetadata>;
      const booksJson = booksRes.ok
        ? ((await booksRes.json()) as Partial<InventoryBooksResponse>)
        : null;

      const sampleFallback = createSampleAddBookMetadata();
      const loadedBooks = booksJson?.items ?? [];

      setMetadata({
        is_prototype_sample: false,
        categories: metaJson.categories?.length
          ? metaJson.categories
          : sampleFallback.categories,
        subjectsByCategory:
          metaJson.subjectsByCategory ?? sampleFallback.subjectsByCategory,
        allSubjects: metaJson.allSubjects?.length
          ? metaJson.allSubjects
          : sampleFallback.allSubjects,
        languages: metaJson.languages?.length
          ? metaJson.languages
          : sampleFallback.languages,
        formats: metaJson.formats?.length ? metaJson.formats : sampleFallback.formats,
        branches: metaJson.branches?.length
          ? metaJson.branches
          : sampleFallback.branches,
        floors: metaJson.floors?.length ? metaJson.floors : sampleFallback.floors,
        sections: metaJson.sections?.length
          ? metaJson.sections
          : sampleFallback.sections,
        supports_barcodes:
          metaJson.supports_barcodes ??
          booksJson?.capabilities?.supports_barcodes ??
          true,
        accession_prefix_format:
          metaJson.accession_prefix_format ??
          booksJson?.capabilities?.accession_prefix_format ??
          'LIB-2026-0001',
        existingBooks: loadedBooks,
        existingAccessionNumbers: metaJson.existingAccessionNumbers ?? [],
        existingBarcodes: metaJson.existingBarcodes ?? [],
      });
    } catch (err) {
      setMetadataError(
        err instanceof Error
          ? err.message
          : 'Unable to load category and library branch metadata.'
      );
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [apiBaseUrl, hasBackendApi, onNavigate]);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  const isDirty = useMemo(() => {
    if (createdResult) return false;
    return hasUnsavedAddBookChanges(form, initialBaselineRef.current);
  }, [createdResult, form]);

  // Warn browser tab unload when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Register navigation guard so LibrarianShell sidebar/header links prompt cleanly when dirty
  useEffect(() => {
    if (!onRegisterUnsavedGuard) return;
    onRegisterUnsavedGuard((targetRoute: AppRoute) => {
      if (!isDirty) return true;
      setPendingLeaveRoute(targetRoute);
      return false;
    });
    return () => onRegisterUnsavedGuard(null);
  }, [isDirty, onRegisterUnsavedGuard]);

  // Debounced duplicate lookup against loaded catalogue or backend search
  const isbnValue = form.isbn;
  const titleValue = form.title;
  const authorsValue = form.authors;

  useEffect(() => {
    const cleanIsbn = normalizeIsbn(isbnValue);
    const cleanTitle = titleValue.trim();
    if (cleanIsbn.length < 4 && cleanTitle.length < 4) {
      setDuplicateMatch(null);
      setDuplicateOverrideAccepted(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      let candidateBooks = metadata.existingBooks;

      if (hasBackendApi && (cleanIsbn.length >= 6 || cleanTitle.length >= 5)) {
        try {
          const q = cleanIsbn.length >= 6 ? cleanIsbn : cleanTitle;
          const res = await apiFetch(
            `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books?search=${encodeURIComponent(q)}&limit=10`,
            {
              method: 'GET',
              credentials: 'include',
              headers: { Accept: 'application/json' },
            }
          );
          if (res.ok) {
            const data = (await res.json()) as Partial<InventoryBooksResponse>;
            if (Array.isArray(data.items) && data.items.length > 0) {
              candidateBooks = data.items;
            }
          }
        } catch {
          // Retain loaded metadata.existingBooks if live check temporarily fails
        }
      }

      const match = detectDuplicateBook(
        { isbn: isbnValue, title: titleValue, authors: authorsValue },
        candidateBooks
      );
      setDuplicateMatch(match);
      if (!match) {
        setDuplicateOverrideAccepted(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [apiBaseUrl, authorsValue, hasBackendApi, isbnValue, metadata.existingBooks, titleValue]);

  const requestRouteNavigation = useCallback(
    (targetRoute: AppRoute) => {
      if (isDirty) {
        setPendingLeaveRoute(targetRoute);
        return;
      }
      onNavigate(targetRoute);
    },
    [isDirty, onNavigate]
  );

  const handleFieldChange = useCallback(
    <K extends keyof AddBookFormState>(field: K, value: AddBookFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (hasSubmittedAttempt) {
          const check = validateAddBookForm(next, metadata, {
            allowDuplicateOverride: duplicateOverrideAccepted,
          });
          setErrors(check.errors);
        } else {
          setErrors((prevErr) => ({
            ...prevErr,
            [field]: undefined,
          }));
        }
        return next;
      });
      setSubmitError(null);
    },
    [duplicateOverrideAccepted, hasSubmittedAttempt, metadata]
  );

  const handleIsbnBlur = useCallback(() => {
    if (!form.isbn.trim()) return;
    const check = validateIsbnInput(form.isbn);
    setErrors((prev) => ({
      ...prev,
      isbn: check.valid ? undefined : check.error,
    }));
  }, [form.isbn]);

  const handleGenerateBatch = useCallback(
    (count: number, replaceExisting: boolean) => {
      const defaultLoc =
        form.locationCode.trim() ||
        [form.branch.trim(), form.shelf.trim()].filter(Boolean).join(' · ');

      setForm((prev) => ({
        ...prev,
        copies: createBulkPhysicalCopyDrafts({
          count,
          accessionPrefixFormat: metadata.accession_prefix_format,
          existingAccessionNumbers: metadata.existingAccessionNumbers,
          currentCopies: prev.copies,
          defaultLocationCode: defaultLoc,
          replaceExisting,
        }),
      }));
      setErrors((prev) => ({ ...prev, copies: undefined, copyRowErrors: {} }));
    },
    [form.branch, form.locationCode, form.shelf, metadata]
  );

  const handleAddSingleCopy = useCallback(() => {
    const used = [
      ...metadata.existingAccessionNumbers,
      ...form.copies.map((c) => c.accessionNumber),
    ];
    const nextCode =
      generateAccessionNumbers(metadata.accession_prefix_format, used, 1)[0] ??
      `LIB-2026-${String(form.copies.length + 1).padStart(4, '0')}`;

    const newRow: AddBookCopyDraft = {
      localId: `copy-${Date.now()}-${form.copies.length + 1}`,
      accessionNumber: nextCode,
      barcode: `BC-${nextCode.replace(/[^A-Z0-9]/gi, '')}`,
      condition: 'New',
      status: 'Available',
      locationOverride: form.locationCode.trim() || form.shelf.trim(),
    };

    setForm((prev) => ({
      ...prev,
      copies: [...prev.copies, newRow],
    }));
    setErrors((prev) => ({ ...prev, copies: undefined }));
  }, [form.copies, form.locationCode, form.shelf, metadata]);

  const handleUpdateCopy = useCallback(
    (localId: string, patch: Partial<AddBookCopyDraft>) => {
      setForm((prev) => ({
        ...prev,
        copies: prev.copies.map((row) =>
          row.localId === localId ? { ...row, ...patch } : row
        ),
      }));
      setErrors((prev) => {
        const nextRowErrs = { ...prev.copyRowErrors };
        delete nextRowErrs[localId];
        return { ...prev, copies: undefined, copyRowErrors: nextRowErrs };
      });
    },
    []
  );

  const handleRemoveCopy = useCallback((localId: string) => {
    setForm((prev) => ({
      ...prev,
      copies: prev.copies.filter((row) => row.localId !== localId),
    }));
  }, []);

  const jumpToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleSubmit = async () => {
    if (submitLockRef.current || isSubmitting) return;
    setHasSubmittedAttempt(true);
    setSubmitError(null);

    const validation = validateAddBookForm(form, metadata, {
      allowDuplicateOverride: duplicateOverrideAccepted,
    });
    setErrors(validation.errors);

    if (!validation.valid) {
      setSubmitError(
        'Please fix the highlighted validation errors before adding this book to the library catalogue.'
      );
      if (validation.errors.title || validation.errors.authors || validation.errors.isbn) {
        jumpToSection('section-basic');
      } else if (
        validation.errors.publicationYear ||
        validation.errors.pages ||
        validation.errors.description
      ) {
        jumpToSection('section-bibliographic');
      } else if (validation.errors.category || validation.errors.subject) {
        jumpToSection('section-classification');
      } else if (validation.errors.branch || validation.errors.shelf) {
        jumpToSection('section-library');
      } else if (
        validation.errors.copies ||
        Object.keys(validation.errors.copyRowErrors).length > 0
      ) {
        jumpToSection('section-copies');
      }
      return;
    }

    if (duplicateMatch && duplicateMatch.reason === 'isbn') {
      setSubmitError(
        `A book with ISBN "${duplicateMatch.existingBook.isbn}" already exists in the catalogue. Add copies to the existing book from Book Inventory instead.`
      );
      jumpToSection('section-basic');
      return;
    }

    if (duplicateMatch && duplicateMatch.reason === 'title_author' && !duplicateOverrideAccepted) {
      setSubmitError(
        'A similar title by this author already exists. Review the duplicate warning above and choose "Continue Only If Appropriate" if this is a distinct edition.'
      );
      jumpToSection('section-basic');
      return;
    }

    if (!hasBackendApi) {
      setSubmitError(
        'Validation passed cleanly, but backend persistence requires VITE_API_BASE_URL to be configured so POST /api/librarian/books can atomically commit the book and its physical copies. No record was created.'
      );
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const payload = buildAddBookTransactionPayload(form);
      const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/books`;

      let coverImageUrl = payload.cover_image;
      if (coverFile) {
        coverImageUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(coverFile);
        });
      }

      const response = await apiFetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          cover_image: coverImageUrl || payload.cover_image,
        }),
      });

      if (response.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as
          | { message?: string; error?: string }
          | null;
        throw new Error(
          mapAddBookApiError(response.status, errBody?.message ?? errBody?.error)
        );
      }

      const confirmed = (await response.json()) as Partial<{
        book_id: number;
        title: string;
        authors: string;
        isbn: string;
        copies_created: number;
        availability_status: string;
      }>;

      if (typeof confirmed.book_id !== 'number') {
        throw new Error(
          'Server returned an incomplete response without a confirmed catalogue book ID.'
        );
      }

      setCreatedResult({
        book_id: confirmed.book_id,
        title: confirmed.title ?? payload.title,
        authors: confirmed.authors ?? payload.authors_display,
        isbn: confirmed.isbn ?? payload.isbn,
        copies_created: confirmed.copies_created ?? payload.physical_copies.length,
        availability_status:
          confirmed.availability_status ??
          (payload.physical_copies.some((c) => c.status === 'Available')
            ? 'Available'
            : 'Unavailable'),
        location_label: formatLocationSummary(form),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to save the book and its physical copies. Check server connection and retry.'
      );
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetForAnotherBook = () => {
    const freshBaseline = createInitialAddBookFormState(
      metadata.accession_prefix_format,
      metadata.existingAccessionNumbers
    );
    initialBaselineRef.current = freshBaseline;
    setForm(freshBaseline);
    setCoverFile(null);
    setErrors(EMPTY_ERRORS);
    setHasSubmittedAttempt(false);
    setDuplicateMatch(null);
    setDuplicateOverrideAccepted(false);
    setSubmitError(null);
    setCreatedResult(null);
    void loadMetadata();
  };

  if (!permissions.can_manage_inventory) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
          Catalogue Creation Restricted
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">
          Your librarian role does not currently have permission to create new books or physical
          catalogue copies.
        </p>
        <button
          type="button"
          onClick={() => onNavigate({ name: 'librarian-inventory' })}
          className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Inventory</span>
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header (Strictly no Save Draft stub since draft persistence is unimplemented) */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[#142B4A] sm:text-2xl">
            Add New Book
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm">
            Create a new catalogue record and add its physical library copies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => requestRouteNavigation({ name: 'librarian-inventory' })}
          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Inventory</span>
        </button>
      </section>

      {!hasBackendApi && !createdResult && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#142B4A] shadow-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <p>
            Sample catalogue metadata is active for duplicate detection and accession number
            preview while <span className="font-mono-tabular font-semibold">VITE_API_BASE_URL</span>{' '}
            is unconfigured. Final catalogue commitment executes only against an active{' '}
            <span className="font-mono-tabular font-semibold">POST /api/librarian/books</span>{' '}
            backend.
          </p>
        </div>
      )}

      {createdResult ? (
        <AddBookSuccessView
          result={createdResult}
          onViewBook={() => onNavigate({ name: 'librarian-inventory' })}
          onManageCopies={() => onNavigate({ name: 'librarian-inventory' })}
          onAddAnother={handleResetForAnotherBook}
          onBackToInventory={() => onNavigate({ name: 'librarian-inventory' })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          {/* Left Main Multi-Section Form */}
          <div className="space-y-6">
            <BasicInfoSection
              form={form}
              errors={errors}
              onChangeField={handleFieldChange}
              onIsbnBlur={handleIsbnBlur}
            />

            {duplicateMatch && (
              <DuplicateWarningBanner
                match={duplicateMatch}
                overrideAccepted={duplicateOverrideAccepted}
                onViewExisting={() => setPreviewExistingBook(duplicateMatch.existingBook)}
                onCancel={() => requestRouteNavigation({ name: 'librarian-inventory' })}
                onContinueOverride={() => setDuplicateOverrideAccepted(true)}
              />
            )}

            <BibliographicInfoSection
              form={form}
              languages={metadata.languages}
              errors={errors}
              onChangeField={handleFieldChange}
            />

            <ClassificationDiscoverySection
              form={form}
              metadata={metadata}
              isLoadingMetadata={isLoadingMetadata}
              metadataError={metadataError}
              onRetryMetadata={() => void loadMetadata()}
              errors={errors}
              onChangeField={handleFieldChange}
              onAddTag={(raw) => handleFieldChange('keywords', addKeywordTag(form.keywords, raw))}
              onRemoveTag={(tag) =>
                handleFieldChange('keywords', removeKeywordTag(form.keywords, tag))
              }
            />

            <LibraryInfoSection
              form={form}
              metadata={metadata}
              errors={errors}
              onChangeField={handleFieldChange}
            />

            <BookCoverSection
              form={form}
              onSelectCoverFile={(file, previewDataUrl) => {
                setCoverFile(file);
                setForm((prev) => ({
                  ...prev,
                  coverFileName: file?.name ?? '',
                  coverPreviewUrl: previewDataUrl,
                }));
              }}
              onRemoveCover={() => {
                setCoverFile(null);
                setForm((prev) => ({
                  ...prev,
                  coverFileName: '',
                  coverPreviewUrl: '',
                  coverAssetPath: '',
                }));
              }}
              onChangeAssetPath={(value) => handleFieldChange('coverAssetPath', value)}
            />

            <PhysicalCopiesSection
              form={form}
              metadata={metadata}
              errors={errors}
              onGenerateBatch={handleGenerateBatch}
              onAddSingleCopy={handleAddSingleCopy}
              onUpdateCopy={handleUpdateCopy}
              onRemoveCopy={handleRemoveCopy}
            />

            <ReviewAndSubmitSection
              form={form}
              isSubmitting={isSubmitting}
              submitError={submitError}
              hasBackendApi={hasBackendApi}
              onJumpToSection={jumpToSection}
              onSubmit={() => void handleSubmit()}
              onCancel={() => requestRouteNavigation({ name: 'librarian-inventory' })}
            />
          </div>

          {/* Right Sticky Progress & Live Record Sidebar */}
          <AddBookProgressSidebar
            form={form}
            errors={errors}
            hasSubmittedAttempt={hasSubmittedAttempt}
            onJumpToSection={jumpToSection}
          />
        </div>
      )}

      <ExistingBookPreviewModal
        book={previewExistingBook}
        onClose={() => setPreviewExistingBook(null)}
        onOpenInventory={() => {
          setPreviewExistingBook(null);
          requestRouteNavigation({ name: 'librarian-inventory' });
        }}
      />

      <UnsavedChangesModal
        isOpen={Boolean(pendingLeaveRoute)}
        onStay={() => setPendingLeaveRoute(null)}
        onLeave={() => {
          const target = pendingLeaveRoute;
          setPendingLeaveRoute(null);
          if (target) {
            onNavigate(target);
          }
        }}
      />
    </div>
  );
}

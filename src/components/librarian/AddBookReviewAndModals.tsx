import React, { useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Edit3,
  Layers,
  Loader2,
  PlusCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { InventoryBookItem } from '../../utils/librarianInventory';
import {
  formatLocationSummary,
  normalizeIsbn,
  validateIsbnInput,
  type AddBookCreatedResult,
  type AddBookFormState,
  type AddBookValidationErrors,
} from '../../utils/addBookPage';

export function AddBookProgressSidebar({
  form,
  errors,
  hasSubmittedAttempt,
  onJumpToSection,
}: {
  form: AddBookFormState;
  errors: AddBookValidationErrors;
  hasSubmittedAttempt: boolean;
  onJumpToSection: (sectionId: string) => void;
}) {
  const cleanAuthors = form.authors.map((a) => a.trim()).filter(Boolean);
  const isbnOk = validateIsbnInput(form.isbn).valid;

  const steps = [
    {
      id: 'section-basic',
      label: 'Basic Information',
      done: Boolean(form.title.trim()) && cleanAuthors.length > 0 && isbnOk,
      hasErr: hasSubmittedAttempt && Boolean(errors.title || errors.authors || errors.isbn),
    },
    {
      id: 'section-bibliographic',
      label: 'Bibliographic Info',
      done: Boolean(form.language.trim()),
      hasErr:
        hasSubmittedAttempt &&
        Boolean(errors.publicationYear || errors.pages || errors.description || errors.language),
    },
    {
      id: 'section-classification',
      label: 'Classification & Tags',
      done: Boolean(form.category.trim()) && Boolean(form.subject.trim()),
      hasErr: hasSubmittedAttempt && Boolean(errors.category || errors.subject),
    },
    {
      id: 'section-library',
      label: 'Library Location',
      done: Boolean(form.branch.trim()) && Boolean(form.shelf.trim() || form.locationCode.trim()),
      hasErr: hasSubmittedAttempt && Boolean(errors.branch || errors.shelf),
    },
    {
      id: 'section-cover',
      label: 'Book Cover (Optional)',
      done: Boolean(form.coverFileName || form.coverAssetPath.trim()),
      hasErr: false,
    },
    {
      id: 'section-copies',
      label: 'Physical Copies',
      done:
        form.copies.length > 0 &&
        form.copies.every((c) => Boolean(c.accessionNumber.trim())) &&
        Object.keys(errors.copyRowErrors).length === 0,
      hasErr:
        hasSubmittedAttempt &&
        (Boolean(errors.copies) || Object.keys(errors.copyRowErrors).length > 0),
    },
    {
      id: 'section-review',
      label: 'Review & Submit',
      done: false,
      hasErr: false,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <aside
      aria-label="Catalogue entry summary and section navigation"
      className="space-y-4 xl:sticky xl:top-24"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="font-display text-sm font-bold text-[#142B4A]">Catalogue Progress</h3>
          <span className="font-mono-tabular rounded bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#142B4A]">
            {completedCount}/6 ready
          </span>
        </div>

        <nav aria-label="Form section checklist" className="mt-3 space-y-1.5">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => onJumpToSection(step.id)}
              className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
            >
              <span className="truncate">{step.label}</span>
              {step.hasErr ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-label="Needs attention" />
              ) : step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Ready" />
              ) : (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300 bg-white" />
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-[#64748B]">
          Live Record Snapshot
        </h4>
        <div className="mt-3 flex items-start gap-3">
          {form.coverPreviewUrl || form.coverAssetPath.trim() ? (
            <img
              src={form.coverPreviewUrl || form.coverAssetPath.trim()}
              alt="Live cover thumbnail"
              className="h-16 w-12 shrink-0 rounded border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-slate-200 bg-[#142B4A] text-[#DBEAFE]">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#142B4A]">
              {form.title.trim() || 'Untitled Book'}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#64748B]">
              {cleanAuthors.length > 0 ? cleanAuthors.join(', ') : 'No author entered'}
            </p>
            <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
              ISBN: {form.isbn.trim() ? normalizeIsbn(form.isbn) : 'Pending'}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#64748B]">Category / Subject</dt>
            <dd className="truncate font-semibold text-[#142B4A]">
              {form.category || '—'} / {form.subject || '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#64748B]">Copies to Create</dt>
            <dd className="font-mono-tabular font-bold text-[#2563EB]">
              {form.copies.length} {form.copies.length === 1 ? 'copy' : 'copies'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[#64748B]">Keywords</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">
              {form.keywords.length}
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

export function ReviewAndSubmitSection({
  form,
  isSubmitting,
  submitError,
  hasBackendApi,
  onJumpToSection,
  onSubmit,
  onCancel,
}: {
  form: AddBookFormState;
  isSubmitting: boolean;
  submitError: string | null;
  hasBackendApi: boolean;
  onJumpToSection: (sectionId: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const cleanAuthors = form.authors.map((a) => a.trim()).filter(Boolean);
  const availableCopyCount = form.copies.filter((c) => c.status === 'Available').length;

  return (
    <section
      id="section-review"
      aria-labelledby="heading-section-review"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="mb-5 flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="font-mono-tabular inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-xs font-bold text-[#142B4A]">
            7
          </span>
          <div>
            <h3 id="heading-section-review" className="font-display text-base font-bold text-[#142B4A]">
              Review Before Submission
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Verify catalogue metadata and physical copy accession numbers before committing to the
              library database.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Group 1: Bibliographic Summary */}
        <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-bold whitespace-nowrap text-[#142B4A]">Bibliographic Info</h4>
            <button
              type="button"
              onClick={() => onJumpToSection('section-basic')}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-[#2563EB] hover:underline cursor-pointer"
            >
              <Edit3 className="h-3 w-3" aria-hidden="true" />
              <span>Edit Information</span>
            </button>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div>
              <dt className="text-[11px] text-[#64748B]">Title</dt>
              <dd className="font-semibold text-[#142B4A]">{form.title.trim() || 'Not entered'}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Author(s)</dt>
              <dd className="text-[#1E293B]">
                {cleanAuthors.length > 0 ? cleanAuthors.join(', ') : 'Not entered'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">ISBN</dt>
              <dd className="font-mono-tabular text-[#142B4A]">
                {form.isbn.trim() ? normalizeIsbn(form.isbn) : 'Not entered'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Publisher & Year</dt>
              <dd className="text-[#1E293B]">
                {[form.publisher.trim() || '—', form.publicationYear.trim() || '—'].join(' · ')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Language / Pages</dt>
              <dd className="text-[#1E293B]">
                {form.language}
                {form.pages.trim() ? ` · ${form.pages.trim()} pp.` : ''}
              </dd>
            </div>
          </dl>
        </div>

        {/* Group 2: Library & Taxonomy Info */}
        <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-bold whitespace-nowrap text-[#142B4A]">Library & Taxonomy</h4>
            <button
              type="button"
              onClick={() => onJumpToSection('section-library')}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-[#2563EB] hover:underline cursor-pointer"
            >
              <Edit3 className="h-3 w-3" aria-hidden="true" />
              <span>Edit Information</span>
            </button>
          </div>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div>
              <dt className="text-[11px] text-[#64748B]">Category & Subject</dt>
              <dd className="font-semibold text-[#142B4A]">
                {form.category || 'Not selected'} · {form.subject || 'Not selected'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Format</dt>
              <dd className="text-[#1E293B]">{form.format}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Location</dt>
              <dd className="text-[#1E293B]">{formatLocationSummary(form)}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Keywords / Tags</dt>
              <dd className="text-[#1E293B]">
                {form.keywords.length > 0 ? form.keywords.join(', ') : 'None added'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#64748B]">Cover Image</dt>
              <dd className="text-[#1E293B]">
                {form.coverFileName || form.coverAssetPath.trim() || 'Default placeholder'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Group 3: Physical Copies Summary */}
        <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/80 pb-2">
            <h4 className="text-xs font-bold whitespace-nowrap text-[#142B4A]">Physical Copies</h4>
            <button
              type="button"
              onClick={() => onJumpToSection('section-copies')}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-[#2563EB] hover:underline cursor-pointer"
            >
              <Edit3 className="h-3 w-3" aria-hidden="true" />
              <span>Edit Information</span>
            </button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <p className="font-semibold text-[#142B4A]">
              <span className="font-mono-tabular">{form.copies.length}</span> total{' '}
              {form.copies.length === 1 ? 'copy' : 'copies'} queued (
              <span className="font-mono-tabular text-emerald-700">{availableCopyCount}</span>{' '}
              Available)
            </p>
            {form.copies.length > 0 ? (
              <ul className="max-h-28 space-y-1 overflow-y-auto pr-1 text-[11px] text-[#1E293B]">
                {form.copies.map((c) => (
                  <li
                    key={c.localId}
                    className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1"
                  >
                    <span className="font-mono-tabular font-medium">
                      {c.accessionNumber.trim() || 'Missing ID'}
                    </span>
                    <span className="text-[#64748B]">
                      {c.condition} · {c.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-red-700">No physical copies configured yet.</p>
            )}
          </div>
        </div>
      </div>

      {!hasBackendApi && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-2.5 text-xs text-[#64748B]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
          <p>
            Atomic catalogue commitment uses{' '}
            <span className="font-mono-tabular font-semibold text-[#142B4A]">
              POST /api/librarian/books
            </span>
            . Configure <span className="font-mono-tabular">VITE_API_BASE_URL</span> to commit
            persisted database records—this form will validate all fields honestly without
            fabricating a saved confirmation offline.
          </p>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex min-h-[42px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#142B4A] hover:border-[#2563EB] disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Adding Book to Library...</span>
            </>
          ) : (
            <span>Add Book to Library</span>
          )}
        </button>
      </div>
    </section>
  );
}

export function AddBookSuccessView({
  result,
  onViewBook,
  onManageCopies,
  onAddAnother,
  onBackToInventory,
}: {
  result: AddBookCreatedResult;
  onViewBook: () => void;
  onManageCopies: () => void;
  onAddAnother: () => void;
  onBackToInventory: () => void;
}) {
  return (
    <section
      aria-live="polite"
      className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs sm:p-8"
    >
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="font-display mt-4 text-2xl font-bold text-[#142B4A]">
          Book Added Successfully
        </h2>
        <p className="mt-1 text-sm text-[#64748B]">
          The catalogue entry and its physical library copies were committed atomically.
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-[#64748B]">Book Title</dt>
          <dd className="mt-0.5 font-semibold text-[#142B4A]">{result.title}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Author(s)</dt>
          <dd className="mt-0.5 font-medium text-[#1E293B]">{result.authors}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">ISBN</dt>
          <dd className="font-mono-tabular mt-0.5 font-semibold text-[#142B4A]">{result.isbn}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Copies Created</dt>
          <dd className="font-mono-tabular mt-0.5 font-semibold text-[#2563EB]">
            {result.copies_created}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Availability</dt>
          <dd className="mt-0.5 font-semibold text-emerald-700">{result.availability_status}</dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Location</dt>
          <dd className="mt-0.5 font-medium text-[#1E293B]">{result.location_label}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onViewBook}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>View Book</span>
        </button>
        <button
          type="button"
          onClick={onManageCopies}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1f3d67] cursor-pointer"
        >
          <Layers className="h-4 w-4" aria-hidden="true" />
          <span>Manage Copies</span>
        </button>
        <button
          type="button"
          onClick={onAddAnother}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          <span>Add Another Book</span>
        </button>
        <button
          type="button"
          onClick={onBackToInventory}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Inventory</span>
        </button>
      </div>
    </section>
  );
}

export function ExistingBookPreviewModal({
  book,
  onClose,
  onOpenInventory,
}: {
  book: InventoryBookItem | null;
  onClose: () => void;
  onOpenInventory: () => void;
}) {
  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, onClose]);

  if (!book) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="existing-book-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
              Existing Catalogue Record
            </p>
            <h3 id="existing-book-preview-title" className="font-display mt-0.5 text-lg font-bold text-[#142B4A]">
              {book.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close existing book preview"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Authors</dt>
            <dd className="font-medium text-[#142B4A]">{book.authors}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">ISBN</dt>
            <dd className="font-mono-tabular font-semibold text-[#142B4A]">{book.isbn}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Category / Subject</dt>
            <dd className="text-[#1E293B]">
              {book.category} · {book.subject}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Copy Counts</dt>
            <dd className="font-mono-tabular font-semibold text-[#2563EB]">
              {book.available_copies} available / {book.total_copies} total
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Location</dt>
            <dd className="text-[#1E293B]">
              {book.branch} · {book.floor} · {book.shelf}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onOpenInventory}
            className="min-h-[38px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Open in Book Inventory
          </button>
        </div>
      </div>
    </div>
  );
}

export function UnsavedChangesModal({
  isOpen,
  onStay,
  onLeave,
}: {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onStay} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 id="unsaved-changes-title" className="font-display text-lg font-bold text-[#142B4A]">
          Leave Add New Book?
        </h3>
        <p className="mt-2 text-sm text-[#64748B]">
          You have unsaved changes. Are you sure you want to leave?
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onStay}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Stay on Page
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[40px] rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
          >
            Leave Page
          </button>
        </div>
      </div>
    </div>
  );
}

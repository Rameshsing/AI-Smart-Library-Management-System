import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BookOpen,
  ImagePlus,
  Lock,
  X,
} from 'lucide-react';
import {
  canDeleteOrRequireArchive,
  generateAccessionNumbers,
  validateBookFormInput,
  validateCoverImageFile,
  type BookFormDraft,
  type InventoryBookItem,
  type InventoryCapabilities,
  type InventoryFormat,
} from '../../utils/librarianInventory';

interface BookEditorModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  editingBook: InventoryBookItem | null;
  existingBooks: InventoryBookItem[];
  existingAccessionNumbers: string[];
  capabilities: InventoryCapabilities;
  hasBackendApi: boolean;
  onClose: () => void;
  onSubmit: (draft: BookFormDraft) => Promise<{ ok: boolean; message: string }>;
}

const EMPTY_BOOK_DRAFT: BookFormDraft = {
  title: '',
  subtitle: '',
  authors: '',
  isbn: '',
  publisher: '',
  publication_year: String(new Date().getFullYear()),
  edition: '1st Edition',
  language: 'English',
  pages: '',
  category: '',
  subject: '',
  keywords: '',
  description: '',
  format: 'Hardcover',
  cover_image: '',
  initial_copies: '1',
  branch: 'Central Library',
  floor: 'Floor 2',
  section: 'General Academic',
  shelf: '',
  acquisition_note: '',
};

export function BookEditorModal({
  isOpen,
  mode,
  editingBook,
  existingBooks,
  existingAccessionNumbers,
  capabilities,
  hasBackendApi,
  onClose,
  onSubmit,
}: BookEditorModalProps) {
  const [draft, setDraft] = useState<BookFormDraft>(EMPTY_BOOK_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BookFormDraft, string>>>({});
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setCoverUploadError(null);
    setSubmitError(null);
    if (mode === 'edit' && editingBook) {
      setDraft({
        title: editingBook.title,
        subtitle: editingBook.subtitle,
        authors: editingBook.authors,
        isbn: editingBook.isbn,
        publisher: editingBook.publisher,
        publication_year: String(editingBook.publication_year),
        edition: editingBook.edition,
        language: editingBook.language,
        pages: String(editingBook.pages),
        category: editingBook.category,
        subject: editingBook.subject,
        keywords: editingBook.keywords.join(', '),
        description: editingBook.description,
        format: editingBook.format,
        cover_image: editingBook.cover_image,
        initial_copies: String(editingBook.total_copies),
        branch: editingBook.branch,
        floor: editingBook.floor,
        section: editingBook.section,
        shelf: editingBook.shelf,
        acquisition_note: '',
      });
    } else {
      setDraft(EMPTY_BOOK_DRAFT);
    }
  }, [editingBook, isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const accessionPreviews = useMemo(() => {
    if (mode !== 'create') return [];
    const count = Number.parseInt(draft.initial_copies.trim(), 10);
    if (!Number.isFinite(count) || count <= 0) return [];
    return generateAccessionNumbers(
      capabilities.accession_prefix_format,
      existingAccessionNumbers,
      Math.min(count, 6)
    );
  }, [capabilities.accession_prefix_format, draft.initial_copies, existingAccessionNumbers, mode]);

  if (!isOpen) return null;

  const isHistoricalLocked = Boolean(mode === 'edit' && editingBook?.has_historical_transactions);

  const handleCoverFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const check = validateCoverImageFile(file);
    if (!check.valid) {
      setCoverUploadError(check.error ?? 'Invalid cover image file.');
      event.target.value = '';
      return;
    }
    setCoverUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft((prev) => ({ ...prev, cover_image: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const check = validateBookFormInput(draft, existingBooks, mode, editingBook?.book_id);
    if (!check.valid) {
      setFieldErrors(check.fieldErrors);
      setSubmitError('Please review the highlighted validation errors before submitting.');
      return;
    }
    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);
    const result = await onSubmit(draft);
    setIsSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.message);
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-book-editor-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="inv-book-editor-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              {mode === 'create' ? 'Add New Book & Physical Copies' : 'Edit Book Metadata'}
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              {mode === 'create'
                ? 'Create a bibliographic record and generate unique physical accession identifiers.'
                : 'Update editable catalogue metadata while protecting historical borrowing integrity.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close book editor modal"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleFormSubmit(e)}
          noValidate
          className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-xs"
        >
          {!hasBackendApi && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-3.5 text-[#1E293B]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
              <span>
                Backend API is not configured (<code>VITE_API_BASE_URL</code> unset). Submitting
                validates all fields and cover files, and reports readiness for{' '}
                <code>
                  {mode === 'create'
                    ? 'POST /api/librarian/books'
                    : `PUT /api/librarian/books/${editingBook?.book_id ?? '{book_id}'}`}
                </code>{' '}
                without faking persistence.
              </span>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Basic Bibliographic Information */}
          <div>
            <h3 className="font-display text-sm font-bold text-[#142B4A]">Basic Information</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="book-form-title" className="block font-semibold text-[#142B4A]">
                  Title *
                </label>
                <input
                  id="book-form-title"
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.title && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.title}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="book-form-subtitle" className="block font-semibold text-[#142B4A]">
                  Subtitle
                </label>
                <input
                  id="book-form-subtitle"
                  type="text"
                  value={draft.subtitle}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="book-form-authors" className="block font-semibold text-[#142B4A]">
                  Author(s) *
                </label>
                <input
                  id="book-form-authors"
                  type="text"
                  value={draft.authors}
                  onChange={(e) => setDraft((prev) => ({ ...prev, authors: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.authors && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.authors}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-isbn" className="block font-semibold text-[#142B4A]">
                  ISBN *{' '}
                  {isHistoricalLocked && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[11px] font-normal text-[#64748B]">
                      <Lock className="h-3 w-3" aria-hidden="true" /> Protected by borrowing history
                    </span>
                  )}
                </label>
                <input
                  id="book-form-isbn"
                  type="text"
                  disabled={isHistoricalLocked}
                  value={draft.isbn}
                  onChange={(e) => setDraft((prev) => ({ ...prev, isbn: e.target.value }))}
                  className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] disabled:bg-slate-100 disabled:text-slate-500 focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.isbn && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.isbn}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-publisher" className="block font-semibold text-[#142B4A]">
                  Publisher *
                </label>
                <input
                  id="book-form-publisher"
                  type="text"
                  value={draft.publisher}
                  onChange={(e) => setDraft((prev) => ({ ...prev, publisher: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.publisher && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.publisher}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="book-form-year" className="block font-semibold text-[#142B4A]">
                    Publication Year *
                  </label>
                  <input
                    id="book-form-year"
                    type="text"
                    inputMode="numeric"
                    value={draft.publication_year}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, publication_year: e.target.value }))
                    }
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {fieldErrors.publication_year && (
                    <p className="mt-1 text-[11px] text-red-700">{fieldErrors.publication_year}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="book-form-pages" className="block font-semibold text-[#142B4A]">
                    Pages *
                  </label>
                  <input
                    id="book-form-pages"
                    type="text"
                    inputMode="numeric"
                    value={draft.pages}
                    onChange={(e) => setDraft((prev) => ({ ...prev, pages: e.target.value }))}
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {fieldErrors.pages && (
                    <p className="mt-1 text-[11px] text-red-700">{fieldErrors.pages}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="book-form-edition" className="block font-semibold text-[#142B4A]">
                  Edition
                </label>
                <input
                  id="book-form-edition"
                  type="text"
                  value={draft.edition}
                  onChange={(e) => setDraft((prev) => ({ ...prev, edition: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="book-form-language"
                    className="block font-semibold text-[#142B4A]"
                  >
                    Language *
                  </label>
                  <input
                    id="book-form-language"
                    type="text"
                    value={draft.language}
                    onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {fieldErrors.language && (
                    <p className="mt-1 text-[11px] text-red-700">{fieldErrors.language}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="book-form-format" className="block font-semibold text-[#142B4A]">
                    Format *
                  </label>
                  <select
                    id="book-form-format"
                    value={draft.format}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, format: e.target.value as InventoryFormat }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    {capabilities.supported_formats.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-display text-sm font-bold text-[#142B4A]">Classification</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="book-form-category" className="block font-semibold text-[#142B4A]">
                  Category *
                </label>
                <input
                  id="book-form-category"
                  type="text"
                  value={draft.category}
                  onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.category && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-subject" className="block font-semibold text-[#142B4A]">
                  Subject *
                </label>
                <input
                  id="book-form-subject"
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.subject && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.subject}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="book-form-keywords" className="block font-semibold text-[#142B4A]">
                  Keywords (comma-separated for AI recommendations)
                </label>
                <input
                  id="book-form-keywords"
                  type="text"
                  placeholder="algorithms, machine learning, python"
                  value={draft.keywords}
                  onChange={(e) => setDraft((prev) => ({ ...prev, keywords: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="book-form-description"
                  className="block font-semibold text-[#142B4A]"
                >
                  Description *
                </label>
                <textarea
                  id="book-form-description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Library Location & Physical Copy Initialization */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-display text-sm font-bold text-[#142B4A]">
              Library Information &amp; Physical Copies
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {mode === 'create' && (
                <div>
                  <label
                    htmlFor="book-form-copies"
                    className="block font-semibold text-[#142B4A]"
                  >
                    Number of Copies *
                  </label>
                  <input
                    id="book-form-copies"
                    type="number"
                    min={0}
                    max={100}
                    value={draft.initial_copies}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, initial_copies: e.target.value }))
                    }
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {fieldErrors.initial_copies && (
                    <p className="mt-1 text-[11px] text-red-700">{fieldErrors.initial_copies}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="book-form-branch" className="block font-semibold text-[#142B4A]">
                  Library Branch *
                </label>
                <input
                  id="book-form-branch"
                  type="text"
                  value={draft.branch}
                  onChange={(e) => setDraft((prev) => ({ ...prev, branch: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.branch && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.branch}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-floor" className="block font-semibold text-[#142B4A]">
                  Floor *
                </label>
                <input
                  id="book-form-floor"
                  type="text"
                  value={draft.floor}
                  onChange={(e) => setDraft((prev) => ({ ...prev, floor: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.floor && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.floor}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-section" className="block font-semibold text-[#142B4A]">
                  Section *
                </label>
                <input
                  id="book-form-section"
                  type="text"
                  value={draft.section}
                  onChange={(e) => setDraft((prev) => ({ ...prev, section: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.section && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.section}</p>
                )}
              </div>

              <div>
                <label htmlFor="book-form-shelf" className="block font-semibold text-[#142B4A]">
                  Shelf Code *
                </label>
                <input
                  id="book-form-shelf"
                  type="text"
                  placeholder="CS-210"
                  value={draft.shelf}
                  onChange={(e) => setDraft((prev) => ({ ...prev, shelf: e.target.value }))}
                  className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                />
                {fieldErrors.shelf && (
                  <p className="mt-1 text-[11px] text-red-700">{fieldErrors.shelf}</p>
                )}
              </div>
            </div>

            {mode === 'create' && accessionPreviews.length > 0 && (
              <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] p-3">
                <p className="text-[11px] font-semibold text-[#142B4A]">
                  Unique Copy Accession Identifier Preview (never reuses ISBN):
                </p>
                <p className="font-mono-tabular mt-1 text-[#2563EB]">
                  {accessionPreviews.join(', ')}
                  {Number.parseInt(draft.initial_copies, 10) > accessionPreviews.length
                    ? ` … (+${Number.parseInt(draft.initial_copies, 10) - accessionPreviews.length} more)`
                    : ''}
                </p>
              </div>
            )}
          </div>

          {/* Validated Cover Image Upload */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-display text-sm font-bold text-[#142B4A]">Book Cover Image</h3>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
              {draft.cover_image ? (
                <img
                  src={draft.cover_image}
                  alt="Cover preview"
                  referrerPolicy="no-referrer"
                  className="h-28 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#F5F8FC] text-slate-400">
                  <BookOpen className="h-6 w-6" aria-hidden="true" />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <label
                  htmlFor="book-form-cover-file"
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  <ImagePlus className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <span>Upload Validated Cover (JPG, PNG, WEBP · Max 2 MB)</span>
                </label>
                <input
                  id="book-form-cover-file"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleCoverFileSelect}
                  className="sr-only"
                />
                {coverUploadError && (
                  <p role="alert" className="text-[11px] font-medium text-red-700">
                    {coverUploadError}
                  </p>
                )}
                <div>
                  <label htmlFor="book-form-cover-url" className="block text-[11px] text-[#64748B]">
                    Or specify verified repository asset URL
                  </label>
                  <input
                    id="book-form-cover-url"
                    type="text"
                    placeholder="/src/assets/images/..."
                    value={draft.cover_image.startsWith('data:') ? '' : draft.cover_image}
                    onChange={(e) => setDraft((prev) => ({ ...prev, cover_image: e.target.value }))}
                    className="font-mono-tabular mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[40px] rounded-lg bg-[#2563EB] px-5 py-2 font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting
                ? 'Saving...'
                : mode === 'create'
                  ? 'Save Book & Create Copies'
                  : 'Save Book Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ArchiveBookModalProps {
  book: InventoryBookItem | null;
  hasBackendApi: boolean;
  onClose: () => void;
  onConfirmArchive: (book: InventoryBookItem) => Promise<{ ok: boolean; message: string }>;
}

export function ArchiveBookModal({
  book,
  hasBackendApi,
  onClose,
  onConfirmArchive,
}: ArchiveBookModalProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setErrorMessage(null);
    setIsSubmitting(false);
  }, [book?.book_id]);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, onClose]);

  if (!book) return null;

  const safeguard = canDeleteOrRequireArchive(book);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    const result = await onConfirmArchive(book);
    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-archive-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Archive className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="inv-archive-modal-title"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Archive this book?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close archive confirmation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5 text-xs">
          <p className="font-semibold text-[#142B4A]">{book.title}</p>
          <p className="leading-relaxed text-[#1E293B]">
            Archiving removes this title from normal catalogue availability but preserves its
            historical borrowing and reporting records.
          </p>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-900">
            <p className="font-semibold">Why destructive deletion is disabled</p>
            <p className="mt-1 leading-relaxed">{safeguard.reason}</p>
          </div>

          {!hasBackendApi && (
            <p className="text-[11px] text-[#64748B]">
              Endpoint: <code>POST /api/librarian/books/{book.book_id}/archive</code>
            </p>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
            className="min-h-[38px] rounded-lg bg-[#142B4A] px-4 py-2 font-semibold text-white hover:bg-[#1e3d66] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? 'Archiving...' : 'Archive Book'}
          </button>
        </div>
      </div>
    </div>
  );
}

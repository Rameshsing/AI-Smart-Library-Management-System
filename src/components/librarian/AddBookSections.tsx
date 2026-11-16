import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CopyPlus,
  ExternalLink,
  ImagePlus,
  Info,
  MapPin,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  validateCoverImageFile,
  type InventoryFormat,
} from '../../utils/librarianInventory';
import {
  ADD_BOOK_COPY_CONDITIONS,
  ALLOWED_INITIAL_COPY_STATUSES,
  MAX_BOOK_DESCRIPTION_LENGTH,
  MAX_BULK_COPIES_BATCH,
  type AddBookCopyCondition,
  type AddBookCopyDraft,
  type AddBookFormState,
  type AddBookMetadata,
  type AddBookValidationErrors,
  type DuplicateBookMatch,
  type InitialPhysicalCopyStatus,
} from '../../utils/addBookPage';

function FieldLabel({
  htmlFor,
  label,
  required = false,
  hint,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-[#142B4A]">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && <span className="text-[11px] text-[#64748B]">{hint}</span>}
    </div>
  );
}

function SectionHeading({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
      <span className="font-mono-tabular inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DBEAFE] text-xs font-bold text-[#142B4A]">
        {step}
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-base font-bold text-[#142B4A]">{title}</h3>
        <p className="mt-0.5 text-xs text-[#64748B]">{description}</p>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  'min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15';

const INPUT_ERROR_CLASS =
  'min-h-[40px] w-full rounded-lg border border-red-400 bg-red-50/30 px-3 py-2 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-200';

export function DuplicateWarningBanner({
  match,
  overrideAccepted,
  onViewExisting,
  onCancel,
  onContinueOverride,
}: {
  match: DuplicateBookMatch;
  overrideAccepted: boolean;
  onViewExisting: () => void;
  onCancel: () => void;
  onContinueOverride: () => void;
}) {
  const { existingBook, reason } = match;
  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-bold text-[#142B4A]">
            A similar book already exists in the library catalogue.
          </h4>
          <p className="mt-1 text-xs text-amber-900">
            Matched by{' '}
            <strong>
              {reason === 'isbn' ? 'identical ISBN' : 'matching book title and author'}
            </strong>
            . Adding additional physical copies of an existing edition should normally be done from
            Book Inventory rather than creating a duplicate title.
          </p>

          <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-xs">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="font-semibold text-[#142B4A]">{existingBook.title}</p>
                <p className="mt-0.5 text-[#64748B]">
                  {existingBook.authors} ·{' '}
                  <span className="font-mono-tabular">ISBN: {existingBook.isbn}</span>
                </p>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="font-mono-tabular font-semibold text-[#142B4A]">
                  {existingBook.total_copies} copies ({existingBook.available_copies} available)
                </p>
                <p className="text-[11px] text-[#64748B]">
                  {existingBook.branch} · {existingBook.shelf}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onViewExisting}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#142B4A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1e3d66] cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Existing Book</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] cursor-pointer"
            >
              Cancel
            </button>
            {reason !== 'isbn' && (
              <button
                type="button"
                onClick={onContinueOverride}
                className={`inline-flex min-h-[38px] items-center rounded-lg border px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                  overrideAccepted
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-amber-400 bg-amber-100/70 text-amber-950 hover:bg-amber-100'
                }`}
              >
                {overrideAccepted
                  ? 'Proceeding as Distinct Edition'
                  : 'Continue Only If Appropriate'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BasicInfoSection({
  form,
  errors,
  onChangeField,
  onIsbnBlur,
}: {
  form: AddBookFormState;
  errors: AddBookValidationErrors;
  onChangeField: <K extends keyof AddBookFormState>(field: K, value: AddBookFormState[K]) => void;
  onIsbnBlur: () => void;
}) {
  const handleAuthorChange = (index: number, value: string) => {
    const next = [...form.authors];
    next[index] = value;
    onChangeField('authors', next);
  };

  const handleAddAuthor = () => {
    onChangeField('authors', [...form.authors, '']);
  };

  const handleRemoveAuthor = (index: number) => {
    if (form.authors.length <= 1) return;
    onChangeField(
      'authors',
      form.authors.filter((_, idx) => idx !== index)
    );
  };

  return (
    <section
      id="section-basic"
      aria-labelledby="heading-section-basic"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-basic">
        <SectionHeading
          step={1}
          title="Basic Information"
          description="Core bibliographic identifiers used across catalogue search, circulation, and student discovery."
        />
      </div>

      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="add-book-title" label="Book Title" required />
          <input
            id="add-book-title"
            type="text"
            required
            placeholder="Enter book title"
            value={form.title}
            onChange={(e) => onChangeField('title', e.target.value)}
            aria-invalid={Boolean(errors.title)}
            className={errors.title ? INPUT_ERROR_CLASS : INPUT_CLASS}
          />
          {errors.title && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="add-book-subtitle" label="Subtitle" hint="Optional" />
          <input
            id="add-book-subtitle"
            type="text"
            placeholder="Enter subtitle if applicable"
            value={form.subtitle}
            onChange={(e) => onChangeField('subtitle', e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#142B4A]">
              Author(s)<span className="ml-0.5 text-red-600">*</span>
            </span>
            <button
              type="button"
              onClick={handleAddAuthor}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-[#DBEAFE]/60 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Author</span>
            </button>
          </div>
          <div className="space-y-2">
            {form.authors.map((authorVal, idx) => (
              <div key={`author-row-${idx}`} className="flex items-center gap-2">
                <label htmlFor={`add-book-author-${idx}`} className="sr-only">
                  Author {idx + 1}
                </label>
                <input
                  id={`add-book-author-${idx}`}
                  type="text"
                  placeholder={idx === 0 ? 'Primary author full name' : `Co-author ${idx + 1} full name`}
                  value={authorVal}
                  onChange={(e) => handleAuthorChange(idx, e.target.value)}
                  aria-invalid={Boolean(errors.authors)}
                  className={errors.authors && idx === 0 ? INPUT_ERROR_CLASS : INPUT_CLASS}
                />
                {form.authors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAuthor(idx)}
                    aria-label={`Remove author ${idx + 1}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.authors && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.authors}
            </p>
          )}
        </div>

        <div>
          <FieldLabel
            htmlFor="add-book-isbn"
            label="ISBN"
            required
            hint="ISBN-10 or ISBN-13 (hyphens & spaces normalized)"
          />
          <input
            id="add-book-isbn"
            type="text"
            required
            placeholder="e.g. 978-0-13-468599-1"
            value={form.isbn}
            onChange={(e) => onChangeField('isbn', e.target.value)}
            onBlur={onIsbnBlur}
            aria-invalid={Boolean(errors.isbn)}
            className={`font-mono-tabular ${errors.isbn ? INPUT_ERROR_CLASS : INPUT_CLASS}`}
          />
          <div className="mt-1 min-h-[18px]">
            {errors.isbn ? (
              <p role="alert" className="text-xs font-medium text-red-700">
                {errors.isbn}
              </p>
            ) : (
              <p className="text-[11px] text-[#64748B]">
                Example valid ISBN-13: 978-0-13-468599-1 · ISBN-10: 0-201-61622-X
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function BibliographicInfoSection({
  form,
  languages,
  errors,
  onChangeField,
}: {
  form: AddBookFormState;
  languages: string[];
  errors: AddBookValidationErrors;
  onChangeField: <K extends keyof AddBookFormState>(field: K, value: AddBookFormState[K]) => void;
}) {
  const remainingChars = MAX_BOOK_DESCRIPTION_LENGTH - form.description.length;

  return (
    <section
      id="section-bibliographic"
      aria-labelledby="heading-section-bibliographic"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-bibliographic">
        <SectionHeading
          step={2}
          title="Bibliographic Information"
          description="Publication metadata displayed on catalogue detail pages and student reading records."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="add-book-publisher" label="Publisher" />
          <input
            id="add-book-publisher"
            type="text"
            placeholder="e.g. MIT Press"
            value={form.publisher}
            onChange={(e) => onChangeField('publisher', e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <FieldLabel
            htmlFor="add-book-year"
            label="Publication Year"
            hint={`Up to ${new Date().getFullYear()}`}
          />
          <input
            id="add-book-year"
            type="number"
            min={1450}
            max={new Date().getFullYear()}
            placeholder={String(new Date().getFullYear())}
            value={form.publicationYear}
            onChange={(e) => onChangeField('publicationYear', e.target.value)}
            aria-invalid={Boolean(errors.publicationYear)}
            className={`font-mono-tabular ${errors.publicationYear ? INPUT_ERROR_CLASS : INPUT_CLASS}`}
          />
          {errors.publicationYear && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.publicationYear}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="add-book-edition" label="Edition" />
          <input
            id="add-book-edition"
            type="text"
            placeholder="e.g. 2nd Edition"
            value={form.edition}
            onChange={(e) => onChangeField('edition', e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <FieldLabel htmlFor="add-book-language" label="Language" required />
          <select
            id="add-book-language"
            value={form.language}
            onChange={(e) => onChangeField('language', e.target.value)}
            aria-invalid={Boolean(errors.language)}
            className={errors.language ? INPUT_ERROR_CLASS : INPUT_CLASS}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          {errors.language && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.language}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <FieldLabel htmlFor="add-book-pages" label="Number of Pages" />
          <input
            id="add-book-pages"
            type="number"
            min={1}
            max={20000}
            placeholder="e.g. 464"
            value={form.pages}
            onChange={(e) => onChangeField('pages', e.target.value)}
            aria-invalid={Boolean(errors.pages)}
            className={`font-mono-tabular sm:max-w-xs ${errors.pages ? INPUT_ERROR_CLASS : INPUT_CLASS}`}
          />
          {errors.pages && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.pages}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <FieldLabel
            htmlFor="add-book-description"
            label="Description"
            hint={`${remainingChars} characters remaining`}
          />
          <textarea
            id="add-book-description"
            rows={4}
            maxLength={MAX_BOOK_DESCRIPTION_LENGTH}
            placeholder="Summarize syllabus relevance, core chapters, and intended academic level..."
            value={form.description}
            onChange={(e) => onChangeField('description', e.target.value)}
            aria-invalid={Boolean(errors.description)}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
              errors.description
                ? 'border-red-400 bg-red-50/30 focus:border-red-600 focus:ring-red-200'
                : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#2563EB]/15'
            }`}
          />
          {errors.description && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ClassificationDiscoverySection({
  form,
  metadata,
  isLoadingMetadata,
  metadataError,
  onRetryMetadata,
  errors,
  onChangeField,
  onAddTag,
  onRemoveTag,
}: {
  form: AddBookFormState;
  metadata: AddBookMetadata;
  isLoadingMetadata: boolean;
  metadataError: string | null;
  onRetryMetadata: () => void;
  errors: AddBookValidationErrors;
  onChangeField: <K extends keyof AddBookFormState>(field: K, value: AddBookFormState[K]) => void;
  onAddTag: (raw: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [tagDraft, setTagDraft] = useState('');

  const availableSubjects =
    form.category && metadata.subjectsByCategory[form.category]?.length
      ? Array.from(
          new Set([
            ...metadata.subjectsByCategory[form.category],
            ...metadata.allSubjects,
          ])
        )
      : metadata.allSubjects;

  const commitTags = () => {
    if (!tagDraft.trim()) return;
    onAddTag(tagDraft);
    setTagDraft('');
  };

  return (
    <section
      id="section-classification"
      aria-labelledby="heading-section-classification"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-classification">
        <SectionHeading
          step={3}
          title="Classification & Discovery"
          description="Structured taxonomy fields powering catalogue filters and AI academic book recommendations."
        />
      </div>

      {metadataError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
        >
          <span>{metadataError}</span>
          <button
            type="button"
            onClick={onRetryMetadata}
            className="inline-flex items-center gap-1 rounded bg-white px-2.5 py-1 font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {isLoadingMetadata ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 animate-pulse">
          <div className="h-10 rounded-lg bg-slate-100" />
          <div className="h-10 rounded-lg bg-slate-100" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="add-book-category" label="Category" required />
            <select
              id="add-book-category"
              value={form.category}
              onChange={(e) => onChangeField('category', e.target.value)}
              aria-invalid={Boolean(errors.category)}
              className={errors.category ? INPUT_ERROR_CLASS : INPUT_CLASS}
            >
              <option value="">Select category...</option>
              {metadata.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                {errors.category}
              </p>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="add-book-subject" label="Subject" required />
            <select
              id="add-book-subject"
              value={form.subject}
              onChange={(e) => onChangeField('subject', e.target.value)}
              aria-invalid={Boolean(errors.subject)}
              className={errors.subject ? INPUT_ERROR_CLASS : INPUT_CLASS}
            >
              <option value="">Select subject...</option>
              {availableSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
            {errors.subject && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                {errors.subject}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel
              htmlFor="add-book-keywords"
              label="Keywords / Tags"
              hint="Press Enter or comma to add tags for search & AI matching"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="add-book-keywords"
                type="text"
                placeholder="e.g. neural networks, graph theory, semester 5"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    commitTags();
                  }
                }}
                className={INPUT_CLASS}
              />
              <button
                type="button"
                onClick={commitTags}
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-[#F5F8FC] px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Tag</span>
              </button>
            </div>

            {form.keywords.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Selected keywords">
                {form.keywords.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2.5 py-1 text-xs font-medium text-[#142B4A]"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                      className="rounded p-0.5 text-slate-500 hover:bg-[#DBEAFE] hover:text-[#142B4A] cursor-pointer"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function LibraryInfoSection({
  form,
  metadata,
  errors,
  onChangeField,
}: {
  form: AddBookFormState;
  metadata: AddBookMetadata;
  errors: AddBookValidationErrors;
  onChangeField: <K extends keyof AddBookFormState>(field: K, value: AddBookFormState[K]) => void;
}) {
  return (
    <section
      id="section-library"
      aria-labelledby="heading-section-library"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-library">
        <SectionHeading
          step={4}
          title="Library Information"
          description="Physical format and shelving placement inside the campus library."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <FieldLabel htmlFor="add-book-format" label="Format" required />
          <select
            id="add-book-format"
            value={form.format}
            onChange={(e) => onChangeField('format', e.target.value as InventoryFormat)}
            className={INPUT_CLASS}
          >
            {metadata.formats.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="add-book-branch" label="Branch / Library" required />
          <select
            id="add-book-branch"
            value={form.branch}
            onChange={(e) => onChangeField('branch', e.target.value)}
            aria-invalid={Boolean(errors.branch)}
            className={errors.branch ? INPUT_ERROR_CLASS : INPUT_CLASS}
          >
            {metadata.branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          {errors.branch && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.branch}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="add-book-floor" label="Floor" />
          <select
            id="add-book-floor"
            value={form.floor}
            onChange={(e) => onChangeField('floor', e.target.value)}
            className={INPUT_CLASS}
          >
            {metadata.floors.map((floor) => (
              <option key={floor} value={floor}>
                {floor}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="add-book-section" label="Section" />
          <select
            id="add-book-section"
            value={form.section}
            onChange={(e) => onChangeField('section', e.target.value)}
            className={INPUT_CLASS}
          >
            {metadata.sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel htmlFor="add-book-shelf" label="Shelf" required />
          <input
            id="add-book-shelf"
            type="text"
            placeholder="e.g. CS-212"
            value={form.shelf}
            onChange={(e) => onChangeField('shelf', e.target.value)}
            aria-invalid={Boolean(errors.shelf)}
            className={`font-mono-tabular ${errors.shelf ? INPUT_ERROR_CLASS : INPUT_CLASS}`}
          />
          {errors.shelf && (
            <p role="alert" className="mt-1 text-xs font-medium text-red-700">
              {errors.shelf}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="add-book-location-code" label="Location Code" hint="Optional call no." />
          <input
            id="add-book-location-code"
            type="text"
            placeholder="e.g. QA76.73 · R4-S2"
            value={form.locationCode}
            onChange={(e) => onChangeField('locationCode', e.target.value)}
            className={`font-mono-tabular ${INPUT_CLASS}`}
          />
        </div>
      </div>
    </section>
  );
}

export function BookCoverSection({
  form,
  onSelectCoverFile,
  onRemoveCover,
  onChangeAssetPath,
}: {
  form: AddBookFormState;
  onSelectCoverFile: (file: File | null, previewDataUrl: string) => void;
  onRemoveCover: () => void;
  onChangeAssetPath: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    if (!file) return;
    const validation = validateCoverImageFile(file);
    if (!validation.valid) {
      setUploadError('Please upload a JPG, PNG or WebP image within the allowed file size.');
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      onSelectCoverFile(file, typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  };

  return (
    <section
      id="section-cover"
      aria-labelledby="heading-section-cover"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-cover">
        <SectionHeading
          step={5}
          title="Book Cover"
          description="Upload a clean cover image (JPG, PNG, or WebP up to 2 MB) routed through backend validation."
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[140px_1fr] sm:items-start">
        <div className="flex flex-col items-center">
          {form.coverPreviewUrl || form.coverAssetPath.trim() ? (
            <img
              src={form.coverPreviewUrl || form.coverAssetPath.trim()}
              alt={form.title ? `Cover preview for ${form.title}` : 'Uploaded book cover preview'}
              className="h-44 w-32 rounded-lg border border-slate-200 object-cover shadow-xs"
            />
          ) : (
            <div className="flex h-44 w-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-[#F5F8FC] text-center text-[#64748B]">
              <BookOpen className="h-7 w-7 text-slate-400" aria-hidden="true" />
              <span className="mt-2 px-2 text-[11px] font-medium">No cover uploaded</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              dragActive
                ? 'border-[#2563EB] bg-[#DBEAFE]/40'
                : 'border-slate-300 bg-[#F5F8FC]/70'
            }`}
          >
            <UploadCloud className="mx-auto h-6 w-6 text-[#2563EB]" aria-hidden="true" />
            <p className="mt-2 text-xs font-semibold text-[#142B4A]">
              Drag & drop book cover here, or browse from device
            </p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Accepted formats: JPG, JPEG, PNG, WebP · Max size 2 MB
            </p>

            <input
              ref={fileInputRef}
              id="add-book-cover-input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
              className="sr-only"
            />

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{form.coverFileName ? 'Replace image' : 'Upload Cover Image'}</span>
              </button>

              {(form.coverFileName || form.coverAssetPath.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    onRemoveCover();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Remove image</span>
                </button>
              )}
            </div>

            {form.coverFileName && (
              <p className="mt-2 text-xs font-medium text-[#142B4A]">
                Selected file: <span className="font-mono-tabular">{form.coverFileName}</span>
              </p>
            )}
          </div>

          {uploadError && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{uploadError}</span>
            </p>
          )}

          <div>
            <FieldLabel
              htmlFor="add-book-cover-asset-path"
              label="Or Repository Cover Path"
              hint="Optional static asset path"
            />
            <input
              id="add-book-cover-asset-path"
              type="text"
              placeholder="/src/assets/images/..."
              value={form.coverAssetPath}
              onChange={(e) => onChangeAssetPath(e.target.value)}
              className={`font-mono-tabular ${INPUT_CLASS}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PhysicalCopiesSection({
  form,
  metadata,
  errors,
  onGenerateBatch,
  onAddSingleCopy,
  onUpdateCopy,
  onRemoveCopy,
}: {
  form: AddBookFormState;
  metadata: AddBookMetadata;
  errors: AddBookValidationErrors;
  onGenerateBatch: (count: number, replaceExisting: boolean) => void;
  onAddSingleCopy: () => void;
  onUpdateCopy: (localId: string, patch: Partial<AddBookCopyDraft>) => void;
  onRemoveCopy: (localId: string) => void;
}) {
  const [batchCountInput, setBatchCountInput] = useState('3');
  const [replaceExistingBatch, setReplaceExistingBatch] = useState(false);

  const handleBulkSubmit = () => {
    const parsed = Number.parseInt(batchCountInput.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_BULK_COPIES_BATCH) {
      return;
    }
    onGenerateBatch(parsed, replaceExistingBatch);
  };

  return (
    <section
      id="section-copies"
      aria-labelledby="heading-section-copies"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div id="heading-section-copies">
        <SectionHeading
          step={6}
          title="Physical Copies"
          description="Register individual physical library volumes for this book title using unique accession numbers."
        />
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-3.5 py-2.5 text-xs text-[#142B4A]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
        <p>
          <strong>Book Title vs. Physical Copy:</strong> All copies share the ISBN and bibliographic
          record above, while each physical copy requires its own unique{' '}
          <strong>Copy ID / Accession Number</strong> (e.g.{' '}
          <span className="font-mono-tabular">{metadata.accession_prefix_format}</span>). Never reuse
          the book ISBN as a copy ID.
        </p>
      </div>

      {/* Option A: Bulk Generate */}
      <div className="mb-5 rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <FieldLabel
                htmlFor="add-book-bulk-count"
                label="Option A — Add Multiple Copies"
                hint={`1–${MAX_BULK_COPIES_BATCH} copies`}
              />
              <input
                id="add-book-bulk-count"
                type="number"
                min={1}
                max={MAX_BULK_COPIES_BATCH}
                value={batchCountInput}
                onChange={(e) => setBatchCountInput(e.target.value)}
                className="font-mono-tabular min-h-[40px] w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <label className="inline-flex min-h-[40px] items-center gap-2 text-xs font-medium whitespace-nowrap text-[#1E293B] cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExistingBatch}
                onChange={(e) => setReplaceExistingBatch(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#2563EB]"
              />
              <span>Replace current draft rows</span>
            </label>

            <button
              type="button"
              onClick={handleBulkSubmit}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold whitespace-nowrap text-white hover:bg-[#1d3d68] cursor-pointer"
            >
              <CopyPlus className="h-4 w-4" aria-hidden="true" />
              <span>Generate Copies</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onAddSingleCopy}
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold whitespace-nowrap text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Option B — Add Individual Copy</span>
          </button>
        </div>
      </div>

      {errors.copies && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errors.copies}</span>
        </div>
      )}

      {form.copies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-[#F5F8FC] p-6 text-center text-xs text-[#64748B]">
          No physical copies queued yet. Use Option A to generate numbered copies or Option B to add
          an individual copy row.
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F8FC] text-[11px] font-semibold text-[#64748B]">
                  <th scope="col" className="px-3 py-2.5">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Copy ID / Accession
                  </th>
                  {metadata.supports_barcodes && (
                    <th scope="col" className="px-3 py-2.5">
                      Barcode / QR Code
                    </th>
                  )}
                  <th scope="col" className="px-3 py-2.5">
                    Condition
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Initial Status
                  </th>
                  <th scope="col" className="px-3 py-2.5">
                    Shelf / Location
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    Remove
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.copies.map((copy, idx) => {
                  const rowErr = errors.copyRowErrors[copy.localId];
                  return (
                    <React.Fragment key={copy.localId}>
                      <tr className={rowErr ? 'bg-red-50/40' : 'hover:bg-[#F5F8FC]/50'}>
                        <td className="font-mono-tabular px-2.5 py-2.5 text-[#64748B]">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <label htmlFor={`copy-acc-${copy.localId}`} className="sr-only">
                            Copy {idx + 1} Accession Number
                          </label>
                          <input
                            id={`copy-acc-${copy.localId}`}
                            type="text"
                            value={copy.accessionNumber}
                            onChange={(e) =>
                              onUpdateCopy(copy.localId, { accessionNumber: e.target.value })
                            }
                            placeholder="LIB-2026-0001"
                            className="font-mono-tabular min-h-[36px] w-full min-w-[118px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#142B4A] focus:border-[#2563EB] focus:outline-none"
                          />
                        </td>
                        {metadata.supports_barcodes && (
                          <td className="px-2 py-2">
                            <label htmlFor={`copy-bar-${copy.localId}`} className="sr-only">
                              Copy {idx + 1} Barcode
                            </label>
                            <input
                              id={`copy-bar-${copy.localId}`}
                              type="text"
                              value={copy.barcode}
                              onChange={(e) =>
                                onUpdateCopy(copy.localId, { barcode: e.target.value })
                              }
                              placeholder="Optional barcode"
                              className="font-mono-tabular min-h-[36px] w-full min-w-[105px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                            />
                          </td>
                        )}
                        <td className="px-2 py-2">
                          <label htmlFor={`copy-cond-${copy.localId}`} className="sr-only">
                            Copy {idx + 1} Condition
                          </label>
                          <select
                            id={`copy-cond-${copy.localId}`}
                            value={copy.condition}
                            onChange={(e) =>
                              onUpdateCopy(copy.localId, {
                                condition: e.target.value as AddBookCopyCondition,
                              })
                            }
                            className="min-h-[36px] w-full min-w-[92px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                          >
                            {ADD_BOOK_COPY_CONDITIONS.map((cond) => (
                              <option key={cond} value={cond}>
                                {cond}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <label htmlFor={`copy-stat-${copy.localId}`} className="sr-only">
                            Copy {idx + 1} Initial Status
                          </label>
                          <select
                            id={`copy-stat-${copy.localId}`}
                            value={copy.status}
                            onChange={(e) =>
                              onUpdateCopy(copy.localId, {
                                status: e.target.value as InitialPhysicalCopyStatus,
                              })
                            }
                            className="min-h-[36px] w-full min-w-[114px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-[#142B4A] focus:border-[#2563EB] focus:outline-none"
                          >
                            {ALLOWED_INITIAL_COPY_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <label htmlFor={`copy-loc-${copy.localId}`} className="sr-only">
                            Copy {idx + 1} Location Override
                          </label>
                          <input
                            id={`copy-loc-${copy.localId}`}
                            type="text"
                            value={copy.locationOverride}
                            onChange={(e) =>
                              onUpdateCopy(copy.localId, { locationOverride: e.target.value })
                            }
                            placeholder={form.shelf || 'Default location'}
                            className="min-h-[36px] w-full min-w-[100px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onRemoveCopy(copy.localId)}
                            aria-label={`Remove copy ${copy.accessionNumber || idx + 1}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {rowErr && (
                        <tr>
                          <td
                            colSpan={metadata.supports_barcodes ? 7 : 6}
                            className="bg-red-50/70 px-3 py-1.5 text-[11px] font-medium text-red-700"
                          >
                            {rowErr}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="space-y-3 md:hidden">
            {form.copies.map((copy, idx) => {
              const rowErr = errors.copyRowErrors[copy.localId];
              return (
                <div
                  key={copy.localId}
                  className={`rounded-xl border p-3.5 ${
                    rowErr ? 'border-red-300 bg-red-50/30' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-bold text-[#142B4A]">
                      Physical Copy #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveCopy(copy.localId)}
                      aria-label={`Remove copy ${copy.accessionNumber || idx + 1}`}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    <div>
                      <FieldLabel
                        htmlFor={`m-copy-acc-${copy.localId}`}
                        label="Copy ID / Accession"
                        required
                      />
                      <input
                        id={`m-copy-acc-${copy.localId}`}
                        type="text"
                        value={copy.accessionNumber}
                        onChange={(e) =>
                          onUpdateCopy(copy.localId, { accessionNumber: e.target.value })
                        }
                        className={`font-mono-tabular ${INPUT_CLASS}`}
                      />
                    </div>

                    {metadata.supports_barcodes && (
                      <div>
                        <FieldLabel htmlFor={`m-copy-bar-${copy.localId}`} label="Barcode / QR" />
                        <input
                          id={`m-copy-bar-${copy.localId}`}
                          type="text"
                          value={copy.barcode}
                          onChange={(e) =>
                            onUpdateCopy(copy.localId, { barcode: e.target.value })
                          }
                          className={`font-mono-tabular ${INPUT_CLASS}`}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel htmlFor={`m-copy-cond-${copy.localId}`} label="Condition" />
                        <select
                          id={`m-copy-cond-${copy.localId}`}
                          value={copy.condition}
                          onChange={(e) =>
                            onUpdateCopy(copy.localId, {
                              condition: e.target.value as AddBookCopyCondition,
                            })
                          }
                          className={INPUT_CLASS}
                        >
                          {ADD_BOOK_COPY_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {cond}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <FieldLabel htmlFor={`m-copy-stat-${copy.localId}`} label="Initial Status" />
                        <select
                          id={`m-copy-stat-${copy.localId}`}
                          value={copy.status}
                          onChange={(e) =>
                            onUpdateCopy(copy.localId, {
                              status: e.target.value as InitialPhysicalCopyStatus,
                            })
                          }
                          className={INPUT_CLASS}
                        >
                          {ALLOWED_INITIAL_COPY_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <FieldLabel
                        htmlFor={`m-copy-loc-${copy.localId}`}
                        label="Shelf / Location Override"
                      />
                      <div className="relative">
                        <MapPin
                          className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400"
                          aria-hidden="true"
                        />
                        <input
                          id={`m-copy-loc-${copy.localId}`}
                          type="text"
                          value={copy.locationOverride}
                          onChange={(e) =>
                            onUpdateCopy(copy.localId, { locationOverride: e.target.value })
                          }
                          placeholder={form.shelf || 'Default library shelf'}
                          className={`${INPUT_CLASS} pl-9`}
                        />
                      </div>
                    </div>
                  </div>

                  {rowErr && (
                    <p role="alert" className="mt-2 text-xs font-medium text-red-700">
                      {rowErr}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

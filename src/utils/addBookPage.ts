import {
  createSampleInventoryStore,
  generateAccessionNumbers,
  type CopyStatus,
  type InventoryBookItem,
  type InventoryFormat,
} from './librarianInventory';

export type AddBookCopyCondition = 'New' | 'Good' | 'Fair' | 'Damaged';

export type InitialPhysicalCopyStatus = 'Available' | 'Under Repair' | 'Damaged';

export const ALLOWED_INITIAL_COPY_STATUSES: InitialPhysicalCopyStatus[] = [
  'Available',
  'Under Repair',
  'Damaged',
];

export const ADD_BOOK_COPY_CONDITIONS: AddBookCopyCondition[] = [
  'New',
  'Good',
  'Fair',
  'Damaged',
];

export const MAX_BOOK_DESCRIPTION_LENGTH = 2000;
export const MAX_BULK_COPIES_BATCH = 50;
export const MIN_PUBLICATION_YEAR = 1450;

export interface AddBookCopyDraft {
  localId: string;
  accessionNumber: string;
  barcode: string;
  condition: AddBookCopyCondition;
  status: CopyStatus;
  locationOverride: string;
}

export interface AddBookFormState {
  title: string;
  subtitle: string;
  authors: string[];
  isbn: string;
  publisher: string;
  publicationYear: string;
  edition: string;
  language: string;
  pages: string;
  description: string;
  category: string;
  subject: string;
  keywords: string[];
  format: InventoryFormat;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  locationCode: string;
  coverFileName: string;
  coverPreviewUrl: string;
  coverAssetPath: string;
  copies: AddBookCopyDraft[];
}

export interface AddBookMetadata {
  is_prototype_sample: boolean;
  categories: string[];
  subjectsByCategory: Record<string, string[]>;
  allSubjects: string[];
  languages: string[];
  formats: InventoryFormat[];
  branches: string[];
  floors: string[];
  sections: string[];
  supports_barcodes: boolean;
  accession_prefix_format: string;
  existingBooks: InventoryBookItem[];
  existingAccessionNumbers: string[];
  existingBarcodes: string[];
}

export interface DuplicateBookMatch {
  reason: 'isbn' | 'title_author';
  existingBook: InventoryBookItem;
}

export interface AddBookValidationErrors {
  title?: string;
  authors?: string;
  isbn?: string;
  publisher?: string;
  publicationYear?: string;
  language?: string;
  pages?: string;
  description?: string;
  category?: string;
  subject?: string;
  format?: string;
  branch?: string;
  floor?: string;
  section?: string;
  shelf?: string;
  copies?: string;
  copyRowErrors: Record<string, string>;
}

export interface AddBookCreatedResult {
  book_id: number;
  title: string;
  authors: string;
  isbn: string;
  copies_created: number;
  availability_status: string;
  location_label: string;
}

export interface AddBookSubmissionPayload {
  title: string;
  subtitle: string | null;
  authors: string[];
  authors_display: string;
  isbn: string;
  publisher: string | null;
  publication_year: number | null;
  edition: string | null;
  language: string;
  pages: number | null;
  description: string | null;
  category: string;
  subject: string;
  keywords: string[];
  format: InventoryFormat;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  location_code: string;
  cover_image: string | null;
  physical_copies: Array<{
    accession_number: string;
    barcode: string | null;
    condition: AddBookCopyCondition;
    status: InitialPhysicalCopyStatus;
    location_code: string;
  }>;
}

export function normalizeIsbn(raw: string): string {
  return raw.trim().replace(/[-\s]/g, '').toUpperCase();
}

export function isValidIsbn10(clean: string): boolean {
  if (!/^\d{9}[\dX]$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    const ch = clean[i];
    const digit = ch === 'X' ? 10 : Number.parseInt(ch, 10);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(clean: string): boolean {
  if (!/^(978|979)\d{10}$/.test(clean)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i += 1) {
    const digit = Number.parseInt(clean[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function validateIsbnInput(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizeIsbn(raw);
  if (!normalized) {
    return { valid: false, normalized: '', error: 'ISBN is required.' };
  }
  if (isValidIsbn10(normalized) || isValidIsbn13(normalized)) {
    return { valid: true, normalized };
  }
  return { valid: false, normalized, error: 'Enter a valid ISBN.' };
}

export function normalizeComparisonText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function detectDuplicateBook(
  input: { isbn: string; title: string; authors: string[] },
  catalogue: InventoryBookItem[]
): DuplicateBookMatch | null {
  const cleanIsbn = normalizeIsbn(input.isbn);
  if (cleanIsbn.length >= 4) {
    const isbnMatch = catalogue.find((book) => normalizeIsbn(book.isbn) === cleanIsbn);
    if (isbnMatch) {
      return { reason: 'isbn', existingBook: isbnMatch };
    }
  }

  const cleanTitle = normalizeComparisonText(input.title);
  const cleanAuthors = input.authors
    .map((a) => normalizeComparisonText(a))
    .filter((a) => a.length >= 3);

  if (cleanTitle.length >= 4 && cleanAuthors.length > 0) {
    const titleAuthorMatch = catalogue.find((book) => {
      const existingTitle = normalizeComparisonText(book.title);
      if (existingTitle !== cleanTitle) return false;
      const existingAuthors = normalizeComparisonText(book.authors);
      return cleanAuthors.some((authorName) => {
        const tokens = authorName.split(' ').filter((t) => t.length >= 3);
        return (
          existingAuthors.includes(authorName) ||
          (tokens.length > 0 && tokens.some((tok) => existingAuthors.includes(tok)))
        );
      });
    });
    if (titleAuthorMatch) {
      return { reason: 'title_author', existingBook: titleAuthorMatch };
    }
  }

  return null;
}

export function createInitialAddBookFormState(
  accessionPrefixFormat: string = 'LIB-2026-0001',
  existingAccessionNumbers: string[] = []
): AddBookFormState {
  const defaultCode =
    generateAccessionNumbers(accessionPrefixFormat, existingAccessionNumbers, 1)[0] ??
    'LIB-2026-0001';

  return {
    title: '',
    subtitle: '',
    authors: [''],
    isbn: '',
    publisher: '',
    publicationYear: '',
    edition: '',
    language: 'English',
    pages: '',
    description: '',
    category: '',
    subject: '',
    keywords: [],
    format: 'Hardcover',
    branch: 'Central Library',
    floor: 'Floor 2',
    section: 'Computer & AI Wing',
    shelf: '',
    locationCode: '',
    coverFileName: '',
    coverPreviewUrl: '',
    coverAssetPath: '',
    copies: [
      {
        localId: 'copy-1',
        accessionNumber: defaultCode,
        barcode: `BC-${defaultCode.replace(/[^A-Z0-9]/gi, '')}`,
        condition: 'New',
        status: 'Available',
        locationOverride: '',
      },
    ],
  };
}

export function createBulkPhysicalCopyDrafts(params: {
  count: number;
  accessionPrefixFormat: string;
  existingAccessionNumbers: string[];
  currentCopies: AddBookCopyDraft[];
  defaultLocationCode: string;
  replaceExisting?: boolean;
}): AddBookCopyDraft[] {
  const safeCount = Math.max(1, Math.min(MAX_BULK_COPIES_BATCH, Math.floor(params.count)));
  const baselineCopies = params.replaceExisting ? [] : params.currentCopies;
  const usedAccessions = [
    ...params.existingAccessionNumbers,
    ...baselineCopies.map((c) => c.accessionNumber),
  ];

  const generatedCodes = generateAccessionNumbers(
    params.accessionPrefixFormat,
    usedAccessions,
    safeCount
  );

  const nextRows: AddBookCopyDraft[] = generatedCodes.map((code, idx) => ({
    localId: `copy-${Date.now()}-${baselineCopies.length + idx + 1}`,
    accessionNumber: code,
    barcode: `BC-${code.replace(/[^A-Z0-9]/gi, '')}`,
    condition: 'New',
    status: 'Available',
    locationOverride: params.defaultLocationCode,
  }));

  return [...baselineCopies, ...nextRows];
}

export function addKeywordTag(existing: string[], rawTag: string): string[] {
  const parts = rawTag
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return existing;

  const seen = new Set(existing.map((k) => k.toLowerCase()));
  const next = [...existing];
  for (const part of parts) {
    if (!seen.has(part.toLowerCase())) {
      seen.add(part.toLowerCase());
      next.push(part);
    }
  }
  return next;
}

export function removeKeywordTag(existing: string[], targetTag: string): string[] {
  return existing.filter((tag) => tag.toLowerCase() !== targetTag.toLowerCase());
}

export function formatLocationSummary(state: Pick<
  AddBookFormState,
  'branch' | 'floor' | 'section' | 'shelf' | 'locationCode'
>): string {
  const parts = [
    state.branch.trim(),
    state.floor.trim(),
    state.section.trim(),
    state.shelf.trim() ? `Shelf ${state.shelf.trim()}` : '',
    state.locationCode.trim() ? `(${state.locationCode.trim()})` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Location not specified';
}

export function validateAddBookForm(
  form: AddBookFormState,
  metadata: Pick<AddBookMetadata, 'existingBooks' | 'existingAccessionNumbers' | 'existingBarcodes'>,
  options: { currentYear?: number; allowDuplicateOverride?: boolean } = {}
): { valid: boolean; errors: AddBookValidationErrors } {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const errors: AddBookValidationErrors = { copyRowErrors: {} };

  if (!form.title.trim()) {
    errors.title = 'Book title is required.';
  }

  const validAuthors = form.authors.map((a) => a.trim()).filter(Boolean);
  if (validAuthors.length === 0) {
    errors.authors = 'Enter at least one author.';
  }

  const isbnCheck = validateIsbnInput(form.isbn);
  if (!isbnCheck.valid) {
    errors.isbn = isbnCheck.error;
  } else if (!options.allowDuplicateOverride) {
    const duplicate = metadata.existingBooks.find(
      (b) => normalizeIsbn(b.isbn) === isbnCheck.normalized
    );
    if (duplicate) {
      errors.isbn = `ISBN "${form.isbn.trim()}" already exists on "${duplicate.title}".`;
    }
  }

  if (form.publicationYear.trim()) {
    const rawYear = form.publicationYear.trim();
    const yearNum = Number.parseInt(rawYear, 10);
    if (
      !/^\d{4}$/.test(rawYear) ||
      !Number.isFinite(yearNum) ||
      yearNum < MIN_PUBLICATION_YEAR ||
      yearNum > currentYear
    ) {
      errors.publicationYear = `Enter a valid publication year between ${MIN_PUBLICATION_YEAR} and ${currentYear}.`;
    }
  }

  if (form.pages.trim()) {
    const pagesNum = Number.parseInt(form.pages.trim(), 10);
    if (!/^\d+$/.test(form.pages.trim()) || !Number.isFinite(pagesNum) || pagesNum < 1 || pagesNum > 20000) {
      errors.pages = 'Number of pages must be a positive integer.';
    }
  }

  if (form.description.length > MAX_BOOK_DESCRIPTION_LENGTH) {
    errors.description = `Description cannot exceed ${MAX_BOOK_DESCRIPTION_LENGTH} characters.`;
  }

  if (!form.language.trim()) {
    errors.language = 'Select a language.';
  }

  if (!form.category.trim()) {
    errors.category = 'Category is required.';
  }

  if (!form.subject.trim()) {
    errors.subject = 'Subject is required.';
  }

  if (!form.format.trim()) {
    errors.format = 'Format is required.';
  }

  if (!form.branch.trim()) {
    errors.branch = 'Branch / Library is required.';
  }

  if (!form.shelf.trim() && !form.locationCode.trim()) {
    errors.shelf = 'Enter a shelf code or library location code.';
  }

  if (form.copies.length === 0) {
    errors.copies = 'Add at least one physical copy for this book title.';
  } else {
    const seenAccessions = new Set(metadata.existingAccessionNumbers.map((a) => a.trim().toUpperCase()));
    const seenBarcodes = new Set(metadata.existingBarcodes.map((b) => b.trim().toUpperCase()));
    const cleanNormalizedIsbn = normalizeIsbn(form.isbn);

    for (const copy of form.copies) {
      const cleanAcc = copy.accessionNumber.trim();
      const cleanBar = copy.barcode.trim();
      const normalizedAcc = cleanAcc.toUpperCase();
      const normalizedBar = cleanBar.toUpperCase();

      if (!cleanAcc) {
        errors.copyRowErrors[copy.localId] = 'Copy ID / Accession number is required.';
        continue;
      }

      if (
        cleanNormalizedIsbn &&
        (normalizeIsbn(cleanAcc) === cleanNormalizedIsbn ||
          normalizedAcc === form.isbn.trim().toUpperCase())
      ) {
        errors.copyRowErrors[copy.localId] =
          'Physical copy identifier must be unique and cannot reuse the book ISBN.';
        continue;
      }

      if (seenAccessions.has(normalizedAcc)) {
        errors.copyRowErrors[copy.localId] =
          `Duplicate copy identifier "${cleanAcc}" already exists in inventory or this list.`;
        continue;
      }
      seenAccessions.add(normalizedAcc);

      if (cleanBar) {
        if (seenBarcodes.has(normalizedBar)) {
          errors.copyRowErrors[copy.localId] =
            `Duplicate barcode "${cleanBar}" is already assigned to another copy.`;
          continue;
        }
        seenBarcodes.add(normalizedBar);
      }

      if (!ALLOWED_INITIAL_COPY_STATUSES.includes(copy.status as InitialPhysicalCopyStatus)) {
        errors.copyRowErrors[copy.localId] =
          `Initial physical copies cannot start with "${copy.status}". Use Available, Under Repair, or Damaged.`;
      }
    }

    if (Object.keys(errors.copyRowErrors).length > 0) {
      errors.copies = 'Resolve highlighted errors on physical copy rows before submitting.';
    }
  }

  const valid =
    !errors.title &&
    !errors.authors &&
    !errors.isbn &&
    !errors.publicationYear &&
    !errors.pages &&
    !errors.description &&
    !errors.language &&
    !errors.category &&
    !errors.subject &&
    !errors.format &&
    !errors.branch &&
    !errors.shelf &&
    !errors.copies &&
    Object.keys(errors.copyRowErrors).length === 0;

  return { valid, errors };
}

export function buildAddBookTransactionPayload(form: AddBookFormState): AddBookSubmissionPayload {
  const cleanAuthors = form.authors.map((a) => a.trim()).filter(Boolean);
  const yearNum = form.publicationYear.trim()
    ? Number.parseInt(form.publicationYear.trim(), 10)
    : null;
  const pagesNum = form.pages.trim() ? Number.parseInt(form.pages.trim(), 10) : null;
  const defaultLoc =
    form.locationCode.trim() ||
    [form.branch.trim(), form.shelf.trim()].filter(Boolean).join(' · ');

  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    authors: cleanAuthors,
    authors_display: cleanAuthors.join(', '),
    isbn: normalizeIsbn(form.isbn),
    publisher: form.publisher.trim() || null,
    publication_year: Number.isFinite(yearNum) ? yearNum : null,
    edition: form.edition.trim() || null,
    language: form.language.trim(),
    pages: Number.isFinite(pagesNum) ? pagesNum : null,
    description: form.description.trim() || null,
    category: form.category.trim(),
    subject: form.subject.trim(),
    keywords: form.keywords,
    format: form.format,
    branch: form.branch.trim(),
    floor: form.floor.trim(),
    section: form.section.trim(),
    shelf: form.shelf.trim(),
    location_code: defaultLoc,
    cover_image: form.coverAssetPath.trim() || null,
    physical_copies: form.copies.map((copy) => ({
      accession_number: copy.accessionNumber.trim(),
      barcode: copy.barcode.trim() || null,
      condition: copy.condition,
      status: ALLOWED_INITIAL_COPY_STATUSES.includes(copy.status as InitialPhysicalCopyStatus)
        ? (copy.status as InitialPhysicalCopyStatus)
        : 'Available',
      location_code: copy.locationOverride.trim() || defaultLoc,
    })),
  };
}

export function hasUnsavedAddBookChanges(
  form: AddBookFormState,
  initial: AddBookFormState
): boolean {
  if (form.title.trim() !== initial.title.trim()) return true;
  if (form.subtitle.trim() !== initial.subtitle.trim()) return true;
  if (form.isbn.trim() !== initial.isbn.trim()) return true;
  if (form.publisher.trim() !== initial.publisher.trim()) return true;
  if (form.publicationYear.trim() !== initial.publicationYear.trim()) return true;
  if (form.edition.trim() !== initial.edition.trim()) return true;
  if (form.language !== initial.language) return true;
  if (form.pages.trim() !== initial.pages.trim()) return true;
  if (form.description.trim() !== initial.description.trim()) return true;
  if (form.category !== initial.category) return true;
  if (form.subject !== initial.subject) return true;
  if (form.format !== initial.format) return true;
  if (form.branch !== initial.branch) return true;
  if (form.floor !== initial.floor) return true;
  if (form.section !== initial.section) return true;
  if (form.shelf.trim() !== initial.shelf.trim()) return true;
  if (form.locationCode.trim() !== initial.locationCode.trim()) return true;
  if (form.coverFileName !== initial.coverFileName) return true;
  if (form.coverAssetPath.trim() !== initial.coverAssetPath.trim()) return true;
  if (form.keywords.length !== initial.keywords.length) return true;
  if (
    form.authors.map((a) => a.trim()).join('|') !==
    initial.authors.map((a) => a.trim()).join('|')
  ) {
    return true;
  }
  if (form.copies.length !== initial.copies.length) return true;
  for (let i = 0; i < form.copies.length; i += 1) {
    const a = form.copies[i];
    const b = initial.copies[i];
    if (
      a.accessionNumber !== b.accessionNumber ||
      a.barcode !== b.barcode ||
      a.condition !== b.condition ||
      a.status !== b.status ||
      a.locationOverride !== b.locationOverride
    ) {
      return true;
    }
  }
  return false;
}

export function mapAddBookApiError(status: number, rawMessage?: string | null): string {
  const trimmed = rawMessage?.trim();
  if (status === 401) {
    return 'Your librarian session expired. Sign in again to add books to the catalogue.';
  }
  if (status === 403) {
    return trimmed || 'Only authorized librarian staff may add books to the library catalogue.';
  }
  if (status === 409) {
    return (
      trimmed ||
      'A duplicate ISBN or physical copy accession identifier was rejected by the server.'
    );
  }
  if (status === 422 || status === 400) {
    return trimmed || 'The server rejected one or more book or copy fields. Review and retry.';
  }
  if (status >= 500) {
    return (
      trimmed ||
      'A server error interrupted saving the book and physical copies. No partial record was committed.'
    );
  }
  return trimmed || `Unable to add book to library (${status}).`;
}

export function createSampleAddBookMetadata(): AddBookMetadata {
  const store = createSampleInventoryStore();
  const subjectsByCategory: Record<string, string[]> = {
    'Artificial Intelligence': ['Machine Learning', 'Knowledge Systems', 'Natural Language Processing', 'Recommender Systems'],
    'Computer Science': ['Algorithms', 'Data Structures', 'Systems Design', 'Databases & APIs'],
    'Data Science': ['Statistical Learning', 'Applied Analytics', 'Data Visualization'],
    'Software Engineering': ['Systems Design', 'Software Architecture', 'Testing & Reliability'],
    Psychology: ['Cognitive Psychology', 'Learning Sciences', 'Behavioral Research'],
    Philosophy: ['Philosophy & Society', 'Ethics of Technology', 'Critical Thinking'],
  };

  for (const book of store.books) {
    const list = subjectsByCategory[book.category] ?? [];
    if (!list.includes(book.subject)) {
      list.push(book.subject);
    }
    subjectsByCategory[book.category] = list;
  }

  const allSubjects = Array.from(
    new Set([
      ...Object.values(subjectsByCategory).flat(),
      ...store.books.map((b) => b.subject),
    ])
  ).sort();

  const allCopies = Object.values(store.copiesByBookId).flat();

  return {
    is_prototype_sample: true,
    categories: Array.from(
      new Set([...Object.keys(subjectsByCategory), ...store.books.map((b) => b.category)])
    ).sort(),
    subjectsByCategory,
    allSubjects,
    languages: ['English', 'Hindi', 'Other'],
    formats: store.capabilities.supported_formats,
    branches: Array.from(new Set(['Central Library', 'Engineering Annex', 'Humanities Wing', ...store.books.map((b) => b.branch)])).sort(),
    floors: ['Floor 1', 'Floor 2', 'Floor 3', 'Ground Floor'],
    sections: Array.from(
      new Set([
        'Computer & AI Wing',
        'Analytics & Science',
        'Software Engineering',
        'Behavioural Sciences',
        'General Humanities',
        ...store.books.map((b) => b.section),
      ])
    ).sort(),
    supports_barcodes: store.capabilities.supports_barcodes,
    accession_prefix_format: store.capabilities.accession_prefix_format,
    existingBooks: store.books,
    existingAccessionNumbers: allCopies.map((c) => c.accession_number),
    existingBarcodes: allCopies.map((c) => c.barcode).filter((b): b is string => Boolean(b)),
  };
}

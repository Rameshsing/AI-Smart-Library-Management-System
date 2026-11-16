import { DEMO_BOOKS } from '../data/libraryData';

export type CopyStatus =
  | 'Available'
  | 'Issued'
  | 'Reserved'
  | 'Lost'
  | 'Damaged'
  | 'Under Repair'
  | 'Retired';

export type CopyCondition = 'New' | 'Good' | 'Fair' | 'Worn' | 'Needs Repair';

export type TitleAvailabilityStatus =
  | 'Available'
  | 'Partially Available'
  | 'Fully Issued'
  | 'Reserved/Held'
  | 'Unavailable'
  | 'Archived';

export type BookRecordStatus = 'Active' | 'Archived';

export type InventoryFormat = 'Hardcover' | 'Paperback' | 'Reference' | 'E-Book';

export type InventorySortKey =
  | 'recently_added'
  | 'recently_updated'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'publication_year'
  | 'most_borrowed'
  | 'least_available'
  | 'highest_rated';

export interface InventoryPhysicalCopy {
  copy_id: number;
  book_id: number;
  accession_number: string;
  barcode: string | null;
  status: CopyStatus;
  condition: CopyCondition;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  current_borrower_name: string | null;
  current_borrower_code: string | null;
  due_date: string | null;
  has_active_borrowing: boolean;
  has_historical_transactions: boolean;
  added_at: string;
  updated_at: string;
}

export interface InventoryBookItem {
  book_id: number;
  slug: string;
  title: string;
  subtitle: string;
  authors: string;
  isbn: string;
  publisher: string;
  publication_year: number;
  edition: string;
  language: string;
  pages: number;
  description: string;
  category: string;
  subject: string;
  keywords: string[];
  format: InventoryFormat;
  cover_image: string;
  status: BookRecordStatus;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  unavailable_copies: number;
  availability_status: TitleAvailabilityStatus;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  rating_average: number | null;
  rating_count: number;
  borrow_count: number;
  has_active_borrowings: boolean;
  has_active_reservations: boolean;
  has_historical_transactions: boolean;
  created_at: string;
  updated_at: string;
  added_by: string | null;
  updated_by: string | null;
}

export interface InventorySummaryMetrics {
  total_titles: number;
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  unavailable_copies: number;
}

export interface InventoryCapabilities {
  can_import_books: boolean;
  can_export_inventory: boolean;
  supports_barcodes: boolean;
  supports_locations: boolean;
  supports_staff_audit_names: boolean;
  accession_prefix_format: string;
  supported_copy_statuses: CopyStatus[];
  supported_formats: InventoryFormat[];
  supported_sort_options: InventorySortKey[];
}

export interface InventoryFacets {
  categories: string[];
  subjects: string[];
  authors: string[];
  publishers: string[];
  languages: string[];
  formats: InventoryFormat[];
  branches: string[];
  floors: string[];
  sections: string[];
  shelves: string[];
}

export interface InventoryFilterState {
  search: string;
  category: string;
  subject: string;
  author: string;
  publisher: string;
  publication_year: string;
  language: string;
  format: string;
  availability: '' | TitleAvailabilityStatus;
  copy_status: '' | CopyStatus;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  sort: InventorySortKey;
  page: number;
  limit: number;
}

export interface InventoryBooksResponse {
  is_prototype_sample: boolean;
  items: InventoryBookItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: InventorySummaryMetrics;
  facets: InventoryFacets;
  capabilities: InventoryCapabilities;
}

export interface InventoryCopiesResponse {
  book_id: number;
  book_title: string;
  isbn: string;
  supports_barcodes: boolean;
  accession_prefix_format: string;
  supported_copy_statuses: CopyStatus[];
  items: InventoryPhysicalCopy[];
}

export interface BookFormDraft {
  title: string;
  subtitle: string;
  authors: string;
  isbn: string;
  publisher: string;
  publication_year: string;
  edition: string;
  language: string;
  pages: string;
  category: string;
  subject: string;
  keywords: string;
  description: string;
  format: InventoryFormat;
  cover_image: string;
  initial_copies: string;
  branch: string;
  floor: string;
  section: string;
  shelf: string;
  acquisition_note: string;
}

export const DEFAULT_INVENTORY_LIMIT = 8;

export const DEFAULT_INVENTORY_FILTERS: InventoryFilterState = {
  search: '',
  category: '',
  subject: '',
  author: '',
  publisher: '',
  publication_year: '',
  language: '',
  format: '',
  availability: '',
  copy_status: '',
  branch: '',
  floor: '',
  section: '',
  shelf: '',
  sort: 'recently_added',
  page: 1,
  limit: DEFAULT_INVENTORY_LIMIT,
};

export const INVENTORY_SORT_LABELS: Record<InventorySortKey, string> = {
  recently_added: 'Recently Added',
  recently_updated: 'Recently Updated',
  title_asc: 'Title A–Z',
  title_desc: 'Title Z–A',
  author_asc: 'Author A–Z',
  publication_year: 'Publication Year',
  most_borrowed: 'Most Borrowed',
  least_available: 'Least Available',
  highest_rated: 'Highest Rated',
};

export const ALL_COPY_STATUSES: CopyStatus[] = [
  'Available',
  'Issued',
  'Reserved',
  'Lost',
  'Damaged',
  'Under Repair',
  'Retired',
];

export const ALL_COPY_CONDITIONS: CopyCondition[] = [
  'New',
  'Good',
  'Fair',
  'Worn',
  'Needs Repair',
];

export function deriveTitleAvailabilityCounts(
  copies: InventoryPhysicalCopy[],
  bookStatus: BookRecordStatus = 'Active'
): {
  total_copies: number;
  available_copies: number;
  issued_copies: number;
  reserved_copies: number;
  unavailable_copies: number;
  availability_status: TitleAvailabilityStatus;
} {
  let available = 0;
  let issued = 0;
  let reserved = 0;
  let unavailable = 0;

  for (const copy of copies) {
    if (copy.status === 'Available') available += 1;
    else if (copy.status === 'Issued') issued += 1;
    else if (copy.status === 'Reserved') reserved += 1;
    else unavailable += 1;
  }

  const total = copies.length;

  let availabilityStatus: TitleAvailabilityStatus;
  if (bookStatus === 'Archived') {
    availabilityStatus = 'Archived';
  } else if (total === 0 || (available === 0 && issued === 0 && reserved === 0)) {
    availabilityStatus = 'Unavailable';
  } else if (available > 0 && issued === 0 && reserved === 0 && unavailable === 0) {
    availabilityStatus = 'Available';
  } else if (available > 0) {
    availabilityStatus = 'Partially Available';
  } else if (reserved > 0 && issued === 0) {
    availabilityStatus = 'Reserved/Held';
  } else if (issued > 0) {
    availabilityStatus = 'Fully Issued';
  } else {
    availabilityStatus = 'Unavailable';
  }

  return {
    total_copies: total,
    available_copies: available,
    issued_copies: issued,
    reserved_copies: reserved,
    unavailable_copies: unavailable,
    availability_status: availabilityStatus,
  };
}

export function validateCopyStatusTransition(
  copy: Pick<InventoryPhysicalCopy, 'status' | 'has_active_borrowing' | 'accession_number'>,
  nextStatus: CopyStatus
): { valid: boolean; reason?: string } {
  if (copy.status === nextStatus) {
    return { valid: true };
  }

  if (copy.status === 'Issued' && copy.has_active_borrowing && nextStatus === 'Available') {
    return {
      valid: false,
      reason: `Copy ${copy.accession_number} has an active borrowing transaction. Process it through Return Books instead of manually marking it Available.`,
    };
  }

  if (copy.status === 'Issued' && copy.has_active_borrowing && nextStatus === 'Retired') {
    return {
      valid: false,
      reason: `Copy ${copy.accession_number} is currently issued to a student and cannot be retired until returned or declared lost.`,
    };
  }

  if (copy.status === 'Reserved' && nextStatus === 'Available') {
    return {
      valid: false,
      reason: `Copy ${copy.accession_number} is held for a student reservation queue. Manage release through Reservations.`,
    };
  }

  return { valid: true };
}

export function canDeleteOrRequireArchive(
  book: Pick<
    InventoryBookItem,
    | 'has_active_borrowings'
    | 'has_active_reservations'
    | 'has_historical_transactions'
    | 'issued_copies'
    | 'reserved_copies'
    | 'status'
  >
): {
  allowDestructiveDelete: boolean;
  requiresArchive: boolean;
  reason: string;
} {
  if (book.has_active_borrowings || book.issued_copies > 0) {
    return {
      allowDestructiveDelete: false,
      requiresArchive: true,
      reason:
        'Unsafe deletion blocked: this book currently has issued physical copies or active borrowing transactions.',
    };
  }
  if (book.has_active_reservations || book.reserved_copies > 0) {
    return {
      allowDestructiveDelete: false,
      requiresArchive: true,
      reason:
        'Unsafe deletion blocked: students currently hold active reservations or pickup allocations for this title.',
    };
  }
  if (book.has_historical_transactions) {
    return {
      allowDestructiveDelete: false,
      requiresArchive: true,
      reason:
        'Historical borrowing, reading-history, and reporting records reference this book. Archiving preserves audit integrity.',
    };
  }
  return {
    allowDestructiveDelete: false,
    requiresArchive: true,
    reason:
      'Archiving removes this title from normal catalogue availability while preserving library inventory audit records.',
  };
}

export function generateAccessionNumbers(
  prefixFormat: string,
  existingNumbers: string[],
  count: number
): string[] {
  const safeCount = Math.max(0, Math.min(100, Math.floor(count)));
  const existingSet = new Set(existingNumbers.map((n) => n.trim().toUpperCase()));
  const prefixMatch = prefixFormat.match(/^(.*?)(\d+)$/);
  const basePrefix = prefixMatch ? prefixMatch[1] : `${prefixFormat}-`;
  const digitsWidth = prefixMatch ? Math.max(3, prefixMatch[2].length) : 4;

  let maxNum = 0;
  for (const num of existingSet) {
    if (num.startsWith(basePrefix.toUpperCase())) {
      const tail = num.slice(basePrefix.length);
      const parsed = Number.parseInt(tail, 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const generated: string[] = [];
  let cursor = maxNum + 1;
  while (generated.length < safeCount) {
    const candidate = `${basePrefix}${String(cursor).padStart(digitsWidth, '0')}`;
    if (!existingSet.has(candidate.toUpperCase())) {
      existingSet.add(candidate.toUpperCase());
      generated.push(candidate);
    }
    cursor += 1;
  }
  return generated;
}

export function validateNewCopyInput(
  accessionNumber: string,
  barcode: string,
  bookIsbn: string,
  existingCopies: Pick<InventoryPhysicalCopy, 'accession_number' | 'barcode'>[]
): { valid: boolean; error?: string } {
  const cleanAcc = accessionNumber.trim();
  const cleanBarcode = barcode.trim();
  const cleanIsbn = bookIsbn.trim();

  if (!cleanAcc) {
    return { valid: false, error: 'Accession / Copy number is required.' };
  }
  if (cleanIsbn && cleanAcc.toUpperCase() === cleanIsbn.toUpperCase()) {
    return {
      valid: false,
      error: 'Physical copy identifier must be unique and cannot reuse the book ISBN.',
    };
  }
  if (
    existingCopies.some(
      (c) => c.accession_number.trim().toUpperCase() === cleanAcc.toUpperCase()
    )
  ) {
    return {
      valid: false,
      error: `Accession number "${cleanAcc}" already exists in the library inventory.`,
    };
  }
  if (
    cleanBarcode &&
    existingCopies.some(
      (c) => c.barcode && c.barcode.trim().toUpperCase() === cleanBarcode.toUpperCase()
    )
  ) {
    return {
      valid: false,
      error: `Barcode "${cleanBarcode}" is already assigned to another physical copy.`,
    };
  }
  return { valid: true };
}

export const ALLOWED_COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
export const MAX_COVER_SIZE_BYTES = 2 * 1024 * 1024;

export function validateCoverImageFile(file: {
  name: string;
  size: number;
  type?: string;
}): { valid: boolean; error?: string } {
  const lower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_COVER_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return {
      valid: false,
      error: 'Unsupported cover file format. Allowed formats: JPG, JPEG, PNG, WEBP.',
    };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Selected image file is empty.' };
  }
  if (file.size > MAX_COVER_SIZE_BYTES) {
    return { valid: false, error: 'Cover image must be 2 MB or smaller.' };
  }
  return { valid: true };
}

export function validateBookFormInput(
  draft: BookFormDraft,
  existingBooks: Pick<InventoryBookItem, 'book_id' | 'isbn'>[],
  mode: 'create' | 'edit',
  editingBookId?: number
): { valid: boolean; fieldErrors: Partial<Record<keyof BookFormDraft, string>> } {
  const errors: Partial<Record<keyof BookFormDraft, string>> = {};
  const currentYear = new Date().getFullYear();

  if (!draft.title.trim()) errors.title = 'Title is required.';
  if (!draft.authors.trim()) errors.authors = 'At least one author is required.';

  const cleanIsbn = draft.isbn.trim();
  if (!cleanIsbn) {
    errors.isbn = 'ISBN is required.';
  } else {
    const duplicate = existingBooks.find(
      (b) =>
        b.isbn.trim().toUpperCase() === cleanIsbn.toUpperCase() &&
        (mode === 'create' || b.book_id !== editingBookId)
    );
    if (duplicate) {
      errors.isbn = `Another book record already uses ISBN "${cleanIsbn}".`;
    }
  }

  if (!draft.publisher.trim()) errors.publisher = 'Publisher is required.';

  const yearNum = Number.parseInt(draft.publication_year.trim(), 10);
  if (!Number.isFinite(yearNum) || yearNum < 1450 || yearNum > currentYear + 1) {
    errors.publication_year = `Enter a valid publication year between 1450 and ${currentYear + 1}.`;
  }

  const pagesNum = Number.parseInt(draft.pages.trim(), 10);
  if (!Number.isFinite(pagesNum) || pagesNum < 1 || pagesNum > 20000) {
    errors.pages = 'Enter a positive page count.';
  }

  if (!draft.language.trim()) errors.language = 'Language is required.';
  if (!draft.category.trim()) errors.category = 'Category is required.';
  if (!draft.subject.trim()) errors.subject = 'Subject is required.';
  if (!draft.description.trim() || draft.description.trim().length < 15) {
    errors.description = 'Provide a descriptive summary (at least 15 characters).';
  }

  if (mode === 'create') {
    const copiesNum = Number.parseInt(draft.initial_copies.trim(), 10);
    if (!Number.isFinite(copiesNum) || copiesNum < 0 || copiesNum > 100) {
      errors.initial_copies = 'Initial copies must be between 0 and 100.';
    }
  }

  if (!draft.branch.trim()) errors.branch = 'Library branch is required.';
  if (!draft.floor.trim()) errors.floor = 'Floor is required.';
  if (!draft.section.trim()) errors.section = 'Section is required.';
  if (!draft.shelf.trim()) errors.shelf = 'Shelf code is required.';

  return {
    valid: Object.keys(errors).length === 0,
    fieldErrors: errors,
  };
}

export function buildInventoryApiParams(filters: InventoryFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.category) params.set('category', filters.category);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.author) params.set('author', filters.author);
  if (filters.publisher) params.set('publisher', filters.publisher);
  if (filters.publication_year) params.set('publication_year', filters.publication_year);
  if (filters.language) params.set('language', filters.language);
  if (filters.format) params.set('format', filters.format);
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.copy_status) params.set('copy_status', filters.copy_status);
  if (filters.branch) params.set('branch', filters.branch);
  if (filters.floor) params.set('floor', filters.floor);
  if (filters.section) params.set('section', filters.section);
  if (filters.shelf) params.set('shelf', filters.shelf);
  params.set('sort', filters.sort);
  params.set('page', String(filters.page));
  params.set('limit', String(filters.limit));
  return params;
}

export function countActiveInventoryFilters(filters: InventoryFilterState): number {
  let count = 0;
  if (filters.category) count += 1;
  if (filters.subject) count += 1;
  if (filters.author) count += 1;
  if (filters.publisher) count += 1;
  if (filters.publication_year) count += 1;
  if (filters.language) count += 1;
  if (filters.format) count += 1;
  if (filters.availability) count += 1;
  if (filters.copy_status) count += 1;
  if (filters.branch) count += 1;
  if (filters.floor) count += 1;
  if (filters.section) count += 1;
  if (filters.shelf) count += 1;
  return count;
}

export interface SampleInventoryStore {
  books: InventoryBookItem[];
  copiesByBookId: Record<number, InventoryPhysicalCopy[]>;
  capabilities: InventoryCapabilities;
}

export function createSampleInventoryStore(): SampleInventoryStore {
  const seededMeta: Array<{
    subtitle: string;
    publisher: string;
    edition: string;
    language: string;
    pages: number;
    subject: string;
    format: InventoryFormat;
    branch: string;
    floor: string;
    section: string;
    borrowCount: number;
    ratingAverage: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
    copyStatuses: CopyStatus[];
  }> = [
    {
      subtitle: 'Foundations of Machine Intelligence & Recommendation Pipelines',
      publisher: 'Academic Knowledge Press',
      edition: '3rd Edition',
      language: 'English',
      pages: 512,
      subject: 'Machine Learning',
      format: 'Hardcover',
      branch: 'Central Library',
      floor: 'Floor 2',
      section: 'Computer & AI Wing',
      borrowCount: 142,
      ratingAverage: 4.8,
      ratingCount: 38,
      createdAt: '2026-10-12',
      updatedAt: '2026-11-12',
      copyStatuses: ['Available', 'Available', 'Available', 'Available', 'Issued'],
    },
    {
      subtitle: 'Graph Theory, Complexity Bounds & Problem Solving',
      publisher: 'TechCore Academic',
      edition: '4th Edition',
      language: 'English',
      pages: 640,
      subject: 'Algorithms',
      format: 'Hardcover',
      branch: 'Central Library',
      floor: 'Floor 2',
      section: 'Computer & AI Wing',
      borrowCount: 186,
      ratingAverage: 4.9,
      ratingCount: 52,
      createdAt: '2026-09-18',
      updatedAt: '2026-11-11',
      copyStatuses: ['Available', 'Available', 'Available', 'Issued'],
    },
    {
      subtitle: 'Applied Statistics, Pandas Workflows & Evaluation Models',
      publisher: 'DataPulse Academic',
      edition: '2nd Edition',
      language: 'English',
      pages: 448,
      subject: 'Statistical Learning',
      format: 'Paperback',
      branch: 'Central Library',
      floor: 'Floor 2',
      section: 'Analytics & Science',
      borrowCount: 129,
      ratingAverage: 4.7,
      ratingCount: 31,
      createdAt: '2026-10-28',
      updatedAt: '2026-11-14',
      copyStatuses: ['Available', 'Issued', 'Reserved'],
    },
    {
      subtitle: 'Relational Databases, Clean APIs & Maintainable Architectures',
      publisher: 'University Systems Press',
      edition: '2nd Edition',
      language: 'English',
      pages: 580,
      subject: 'Systems Design',
      format: 'Hardcover',
      branch: 'Engineering Annex',
      floor: 'Floor 3',
      section: 'Software Engineering',
      borrowCount: 94,
      ratingAverage: 4.6,
      ratingCount: 24,
      createdAt: '2026-09-25',
      updatedAt: '2026-11-09',
      copyStatuses: ['Available', 'Available', 'Available', 'Available', 'Available'],
    },
    {
      subtitle: 'Cognitive Focus, Study Habits & Deep Academic Research',
      publisher: 'Scholars Guild Publishing',
      edition: '1st Edition',
      language: 'English',
      pages: 336,
      subject: 'Cognitive Psychology',
      format: 'Reference',
      branch: 'Humanities Wing',
      floor: 'Floor 1',
      section: 'Behavioural Sciences',
      borrowCount: 77,
      ratingAverage: 4.5,
      ratingCount: 19,
      createdAt: '2026-08-30',
      updatedAt: '2026-11-13',
      copyStatuses: ['Issued', 'Reserved'],
    },
    {
      subtitle: 'Ethics, Critical Governance & Technological Civilization',
      publisher: 'Humanitas University Press',
      edition: 'Revised Edition',
      language: 'English',
      pages: 392,
      subject: 'Philosophy & Society',
      format: 'Paperback',
      branch: 'Humanities Wing',
      floor: 'Floor 1',
      section: 'General Humanities',
      borrowCount: 64,
      ratingAverage: 4.4,
      ratingCount: 15,
      createdAt: '2026-09-05',
      updatedAt: '2026-11-04',
      copyStatuses: ['Available', 'Damaged'],
    },
  ];

  const borrowerSnapshots = [
    { name: 'Ananya Verma', code: 'STU-2026-042', due: '2026-11-13' },
    { name: 'Rohan Kulkarni', code: 'STU-2026-089', due: '2026-11-15' },
    { name: 'Meera Iyer', code: 'STU-2026-114', due: '2026-11-17' },
    { name: 'Kabir Sharma', code: 'STU-2026-150', due: '2026-11-24' },
  ];

  const copiesByBookId: Record<number, InventoryPhysicalCopy[]> = {};
  let nextCopyId = 101;
  let globalAccSeq = 1;
  let borrowerIdx = 0;

  const books: InventoryBookItem[] = DEMO_BOOKS.map((demo, idx) => {
    const bookId = idx + 1;
    const meta = seededMeta[idx] ?? seededMeta[0];
    const bookCopies: InventoryPhysicalCopy[] = meta.copyStatuses.map((status) => {
      const acc = `LIB-2026-${String(globalAccSeq).padStart(4, '0')}`;
      const barcode = `BC-${String(bookId).padStart(2, '0')}-${String(globalAccSeq).padStart(4, '0')}`;
      globalAccSeq += 1;

      const isIssued = status === 'Issued';
      const isReserved = status === 'Reserved';
      const borrower = isIssued || isReserved ? borrowerSnapshots[borrowerIdx % borrowerSnapshots.length] : null;
      if (borrower) borrowerIdx += 1;

      const copy: InventoryPhysicalCopy = {
        copy_id: nextCopyId++,
        book_id: bookId,
        accession_number: acc,
        barcode,
        status,
        condition: status === 'Damaged' ? 'Needs Repair' : status === 'Issued' ? 'Good' : 'New',
        branch: meta.branch,
        floor: meta.floor,
        section: meta.section,
        shelf: demo.shelfCode,
        current_borrower_name: borrower ? borrower.name : null,
        current_borrower_code: borrower ? borrower.code : null,
        due_date: isIssued && borrower ? borrower.due : null,
        has_active_borrowing: isIssued,
        has_historical_transactions: idx !== 3,
        added_at: meta.createdAt,
        updated_at: meta.updatedAt,
      };
      return copy;
    });

    copiesByBookId[bookId] = bookCopies;
    const counts = deriveTitleAvailabilityCounts(bookCopies, 'Active');

    return {
      book_id: bookId,
      slug: demo.slug,
      title: demo.title,
      subtitle: meta.subtitle,
      authors: demo.author,
      isbn: demo.isbnPlaceholder,
      publisher: meta.publisher,
      publication_year: demo.publicationYear,
      edition: meta.edition,
      language: meta.language,
      pages: meta.pages,
      description: demo.summary,
      category: demo.category,
      subject: meta.subject,
      keywords: demo.keywords,
      format: meta.format,
      cover_image: demo.coverImage,
      status: 'Active',
      ...counts,
      branch: meta.branch,
      floor: meta.floor,
      section: meta.section,
      shelf: demo.shelfCode,
      rating_average: meta.ratingAverage,
      rating_count: meta.ratingCount,
      borrow_count: meta.borrowCount,
      has_active_borrowings: counts.issued_copies > 0,
      has_active_reservations: counts.reserved_copies > 0,
      has_historical_transactions: idx !== 3,
      created_at: meta.createdAt,
      updated_at: meta.updatedAt,
      added_by: 'Dr. Priya Nair (LIB-2026-008)',
      updated_by: 'Dr. Priya Nair (LIB-2026-008)',
    };
  });

  return {
    books,
    copiesByBookId,
    capabilities: {
      can_import_books: false,
      can_export_inventory: false,
      supports_barcodes: true,
      supports_locations: true,
      supports_staff_audit_names: true,
      accession_prefix_format: 'LIB-2026-0001',
      supported_copy_statuses: ALL_COPY_STATUSES,
      supported_formats: ['Hardcover', 'Paperback', 'Reference'],
      supported_sort_options: [
        'recently_added',
        'recently_updated',
        'title_asc',
        'title_desc',
        'author_asc',
        'publication_year',
        'most_borrowed',
        'least_available',
        'highest_rated',
      ],
    },
  };
}

export function querySampleInventory(
  store: SampleInventoryStore,
  filters: InventoryFilterState
): InventoryBooksResponse {
  const allCopies = Object.values(store.copiesByBookId).flat();
  const summary: InventorySummaryMetrics = {
    total_titles: store.books.length,
    total_copies: allCopies.length,
    available_copies: allCopies.filter((c) => c.status === 'Available').length,
    issued_copies: allCopies.filter((c) => c.status === 'Issued').length,
    reserved_copies: allCopies.filter((c) => c.status === 'Reserved').length,
    unavailable_copies: allCopies.filter(
      (c) =>
        c.status === 'Lost' ||
        c.status === 'Damaged' ||
        c.status === 'Under Repair' ||
        c.status === 'Retired'
    ).length,
  };

  const facets: InventoryFacets = {
    categories: Array.from(new Set(store.books.map((b) => b.category))).sort(),
    subjects: Array.from(new Set(store.books.map((b) => b.subject))).sort(),
    authors: Array.from(new Set(store.books.map((b) => b.authors))).sort(),
    publishers: Array.from(new Set(store.books.map((b) => b.publisher))).sort(),
    languages: Array.from(new Set(store.books.map((b) => b.language))).sort(),
    formats: Array.from(new Set(store.books.map((b) => b.format))),
    branches: Array.from(new Set(store.books.map((b) => b.branch))).sort(),
    floors: Array.from(new Set(store.books.map((b) => b.floor))).sort(),
    sections: Array.from(new Set(store.books.map((b) => b.section))).sort(),
    shelves: Array.from(new Set(store.books.map((b) => b.shelf))).sort(),
  };

  const query = filters.search.trim().toLowerCase();

  const filtered = store.books.filter((book) => {
    const copies = store.copiesByBookId[book.book_id] ?? [];

    if (query) {
      const accessionMatch = copies.some(
        (c) =>
          c.accession_number.toLowerCase().includes(query) ||
          (c.barcode ? c.barcode.toLowerCase().includes(query) : false)
      );
      const textMatch =
        book.title.toLowerCase().includes(query) ||
        book.subtitle.toLowerCase().includes(query) ||
        book.authors.toLowerCase().includes(query) ||
        book.isbn.toLowerCase().includes(query) ||
        book.category.toLowerCase().includes(query) ||
        book.subject.toLowerCase().includes(query) ||
        book.publisher.toLowerCase().includes(query) ||
        book.keywords.some((k) => k.toLowerCase().includes(query));
      if (!accessionMatch && !textMatch) return false;
    }

    if (filters.category && book.category !== filters.category) return false;
    if (filters.subject && book.subject !== filters.subject) return false;
    if (filters.author && book.authors !== filters.author) return false;
    if (filters.publisher && book.publisher !== filters.publisher) return false;
    if (
      filters.publication_year &&
      String(book.publication_year) !== filters.publication_year.trim()
    ) {
      return false;
    }
    if (filters.language && book.language !== filters.language) return false;
    if (filters.format && book.format !== filters.format) return false;
    if (filters.availability && book.availability_status !== filters.availability) return false;
    if (filters.copy_status && !copies.some((c) => c.status === filters.copy_status)) {
      return false;
    }
    if (filters.branch && book.branch !== filters.branch) return false;
    if (filters.floor && book.floor !== filters.floor) return false;
    if (filters.section && book.section !== filters.section) return false;
    if (filters.shelf && book.shelf !== filters.shelf) return false;

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'recently_added':
        return b.created_at.localeCompare(a.created_at);
      case 'recently_updated':
        return b.updated_at.localeCompare(a.updated_at);
      case 'title_asc':
        return a.title.localeCompare(b.title);
      case 'title_desc':
        return b.title.localeCompare(a.title);
      case 'author_asc':
        return a.authors.localeCompare(b.authors);
      case 'publication_year':
        return b.publication_year - a.publication_year;
      case 'most_borrowed':
        return b.borrow_count - a.borrow_count;
      case 'least_available':
        return a.available_copies - b.available_copies;
      case 'highest_rated':
        return (b.rating_average ?? 0) - (a.rating_average ?? 0);
    }
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const safePage = Math.max(1, Math.min(filters.page, totalPages));
  const start = (safePage - 1) * filters.limit;

  return {
    is_prototype_sample: true,
    items: sorted.slice(start, start + filters.limit),
    total,
    page: safePage,
    limit: filters.limit,
    total_pages: totalPages,
    summary,
    facets,
    capabilities: store.capabilities,
  };
}

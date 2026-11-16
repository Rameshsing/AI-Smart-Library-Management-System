import {
  findCatalogBookByIdentifier,
  SAMPLE_LIBRARY_CATALOG,
  type CatalogBook,
} from './bookCatalog';

export interface BookLocation {
  branch: string;
  floor: string;
  section: string;
  shelf: string;
}

export interface BookCopyRecord {
  copy_id: number;
  book_id: number;
  barcode: string;
  status: 'available' | 'issued' | 'reserved';
  branch: string;
  shelf: string;
}

export type ReservationStatusLabel =
  | 'Active'
  | 'Ready for Pickup'
  | 'Fulfilled'
  | 'Cancelled'
  | 'Expired';

export interface BookReservationRecord {
  reservation_id: number;
  student_id: number;
  book_id: number;
  reservation_date: string;
  status: ReservationStatusLabel;
  queue_position: number | null;
}

export interface BookReviewRecord {
  review_id: number;
  student_id: number;
  book_id: number;
  reviewer_display: string;
  rating: number;
  review: string;
  created_at: string;
  updated_at: string;
  relative_date: string;
  verified_borrower: boolean;
}

export interface RatingBreakdownItem {
  stars: 5 | 4 | 3 | 2 | 1;
  count: number;
  percentage: number;
}

export interface DetailedBookRecord extends CatalogBook {
  edition: string;
  pages: number;
  location?: BookLocation;
  copies?: BookCopyRecord[];
}

export interface StudentBookEligibility {
  is_authenticated: boolean;
  can_borrow: boolean;
  ineligible_reason?: string;
  already_borrowed: boolean;
  active_borrowing?: {
    transaction_id: number;
    issue_date: string;
    due_date: string;
  };
  active_reservation?: BookReservationRecord;
  can_review: boolean;
  review_ineligible_reason?: string;
  existing_review?: BookReviewRecord;
}

export interface BookDetailPayload {
  book: DetailedBookRecord;
  issued_copies: number;
  loan_period_days: number;
  student_eligibility: StudentBookEligibility;
  recommendation_reason: string | null;
  rating_distribution: RatingBreakdownItem[];
  reviews: BookReviewRecord[];
  related_books: CatalogBook[];
  is_prototype_sample: boolean;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDueDateIso(issueDate: Date, loanPeriodDays: number): string {
  const safeDays = Math.max(1, Math.floor(loanPeriodDays));
  const due = new Date(
    issueDate.getFullYear(),
    issueDate.getMonth(),
    issueDate.getDate() + safeDays
  );
  return toIsoDateString(due);
}

export function formatDisplayDate(isoDate: string): string {
  const parts = isoDate.split('-').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return isoDate;
  }
  const [year, month, day] = parts;
  const monthName = MONTH_NAMES[month - 1];
  if (!monthName) return isoDate;
  return `${day} ${monthName} ${year}`;
}

export function validateReviewInput(
  rating: number,
  reviewText: string,
  requireText: boolean = false
): { valid: boolean; error?: string } {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { valid: false, error: 'Please select a star rating between 1 and 5.' };
  }
  const trimmed = reviewText.trim();
  if (requireText && trimmed.length === 0) {
    return { valid: false, error: 'Please write a short review before submitting.' };
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Review text must be 1,000 characters or fewer.' };
  }
  return { valid: true };
}

export function buildRatingDistribution(
  totalRatings: number,
  averageRating: number
): RatingBreakdownItem[] {
  if (totalRatings <= 0) {
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars: stars as 5 | 4 | 3 | 2 | 1,
      count: 0,
      percentage: 0,
    }));
  }

  // Deterministic, realistic distribution anchored to the actual rating_average & rating_count
  const clampAvg = Math.min(5, Math.max(1, averageRating));
  const fiveShare = Math.max(0.15, Math.min(0.75, (clampAvg - 2.5) / 3));
  const fourShare = Math.max(0.12, 0.35 - Math.abs(4.2 - clampAvg) * 0.1);
  const threeShare = Math.max(0.04, 0.18 - (clampAvg - 3.5) * 0.08);
  const twoShare = Math.max(0.01, 0.07 - (clampAvg - 3.5) * 0.03);
  const oneShare = Math.max(0.01, 1 - (fiveShare + fourShare + threeShare + twoShare));

  const rawWeights = [fiveShare, fourShare, threeShare, twoShare, oneShare];
  const weightSum = rawWeights.reduce((acc, val) => acc + val, 0);
  const counts = rawWeights.map((w) => Math.round((w / weightSum) * totalRatings));

  // Reconcile rounding difference on the modal bucket
  const diff = totalRatings - counts.reduce((acc, c) => acc + c, 0);
  counts[0] = Math.max(0, counts[0] + diff);

  return ([5, 4, 3, 2, 1] as const).map((stars, idx) => {
    const count = counts[idx];
    const percentage = Math.round((count / totalRatings) * 100);
    return { stars, count, percentage };
  });
}

export function getRelatedSimilarBooks(
  targetBook: CatalogBook,
  allBooks: CatalogBook[] = SAMPLE_LIBRARY_CATALOG,
  limit: number = 4
): CatalogBook[] {
  const targetKeywords = new Set(targetBook.keywords.map((k) => k.toLowerCase()));

  return allBooks
    .filter((candidate) => candidate.book_id !== targetBook.book_id)
    .map((candidate) => {
      let similarityScore = 0;
      if (candidate.category === targetBook.category) similarityScore += 5;
      if (candidate.subject === targetBook.subject) similarityScore += 4;
      for (const kw of candidate.keywords) {
        if (targetKeywords.has(kw.toLowerCase())) {
          similarityScore += 2;
        }
      }
      return { candidate, similarityScore };
    })
    .filter((entry) => entry.similarityScore > 0)
    .sort(
      (a, b) =>
        b.similarityScore - a.similarityScore ||
        b.candidate.rating_average - a.candidate.rating_average
    )
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

const SAMPLE_EXTENDED_DESCRIPTION_SUFFIX =
  ' Designed for university coursework and self-paced study, this edition includes structured chapter summaries, worked examples, real-world architecture diagrams, and annotated reference lists curated for academic research.';

function getLocationForCategory(category: string, bookId: number): BookLocation {
  const sectionMap: Record<string, { floor: string; prefix: string }> = {
    'Artificial Intelligence': { floor: '2', prefix: 'AI' },
    'Computer Science': { floor: '2', prefix: 'CS' },
    Programming: { floor: '2', prefix: 'PR' },
    'Data Science': { floor: '2', prefix: 'DS' },
    'Web Development': { floor: '2', prefix: 'WD' },
    Database: { floor: '2', prefix: 'DB' },
    Networking: { floor: '3', prefix: 'NW' },
    Cybersecurity: { floor: '3', prefix: 'CY' },
    Mathematics: { floor: '1', prefix: 'MA' },
    Science: { floor: '1', prefix: 'SC' },
    Business: { floor: '3', prefix: 'BU' },
    History: { floor: '4', prefix: 'HS' },
    Literature: { floor: '4', prefix: 'LT' },
    'General Knowledge': { floor: '1', prefix: 'GK' },
  };
  const cfg = sectionMap[category] ?? { floor: '1', prefix: 'GN' };
  const shelfNum = 10 + (bookId % 20);
  return {
    branch: 'Central University Library',
    floor: cfg.floor,
    section: category,
    shelf: `${cfg.prefix}-${shelfNum}`,
  };
}

function buildSampleReviews(book: CatalogBook): BookReviewRecord[] {
  if (book.rating_count === 0) {
    return [];
  }

  return [
    {
      review_id: book.book_id * 10 + 1,
      student_id: 2011,
      book_id: book.book_id,
      reviewer_display: 'Student Borrower · CS Dept',
      rating: 5,
      review: `Very clear explanations and practical examples for ${book.subject.toLowerCase()}. Helped me complete my lab assignments smoothly.`,
      created_at: '2026-10-28',
      updated_at: '2026-10-28',
      relative_date: '2 weeks ago',
      verified_borrower: true,
    },
    {
      review_id: book.book_id * 10 + 2,
      student_id: 2048,
      book_id: book.book_id,
      reviewer_display: 'Student Borrower · Engineering',
      rating: Math.max(4, Math.round(book.rating_average)),
      review: `Well-structured chapters and thorough coverage of ${book.category}. Worth borrowing for exam preparation.`,
      created_at: '2026-10-12',
      updated_at: '2026-10-12',
      relative_date: '1 month ago',
      verified_borrower: true,
    },
    {
      review_id: book.book_id * 10 + 3,
      student_id: 2093,
      book_id: book.book_id,
      reviewer_display: 'Verified Student Reader',
      rating: 4,
      review:
        'Strong foundational reference with readable examples. Recommended alongside lecture notes.',
      created_at: '2026-09-20',
      updated_at: '2026-09-20',
      relative_date: '2 months ago',
      verified_borrower: true,
    },
  ];
}

export function createSampleBookDetailData(
  identifier: string,
  options: { fromRecommendation?: boolean; isAuthenticated?: boolean } = {}
): BookDetailPayload | null {
  const catalogBook = findCatalogBookByIdentifier(identifier);
  if (!catalogBook) {
    return null;
  }

  const isPhysical = catalogBook.format === 'Physical Book';
  const location = isPhysical
    ? getLocationForCategory(catalogBook.category, catalogBook.book_id)
    : undefined;

  const issuedCopies = Math.max(
    0,
    catalogBook.total_copies - catalogBook.available_copies - catalogBook.reserved_copies
  );

  const copies: BookCopyRecord[] | undefined = isPhysical
    ? Array.from({ length: catalogBook.total_copies }, (_, idx) => {
        const status: BookCopyRecord['status'] =
          idx < catalogBook.available_copies
            ? 'available'
            : idx < catalogBook.available_copies + catalogBook.reserved_copies
              ? 'reserved'
              : 'issued';
        return {
          copy_id: catalogBook.book_id * 100 + idx + 1,
          book_id: catalogBook.book_id,
          barcode: `LIB-${catalogBook.book_id}-${String(idx + 1).padStart(2, '0')}`,
          status,
          branch: location!.branch,
          shelf: location!.shelf,
        };
      })
    : undefined;

  const detailedBook: DetailedBookRecord = {
    ...catalogBook,
    description: `${catalogBook.description}${SAMPLE_EXTENDED_DESCRIPTION_SUFFIX}`,
    edition: catalogBook.publication_year >= 2025 ? '3rd Edition' : '2nd Edition',
    pages: 320 + (catalogBook.book_id % 9) * 38,
    location,
    copies,
  };

  // Sample realistic student context for prototype preview:
  // Book 105 matches recommendation context; Book 106 is already borrowed by the sample student;
  // Book 104 is unavailable & reserved by the sample student; Book 102 is eligible for review (returned earlier).
  const isAlreadyBorrowed = catalogBook.book_id === 106;
  const hasActiveReservation = catalogBook.book_id === 104;
  const hasCompletedPastBorrow = catalogBook.book_id === 102 || catalogBook.book_id === 101;
  const isAuthenticated = options.isAuthenticated ?? true;

  const recommendationReason =
    options.fromRecommendation || catalogBook.book_id === 105 || catalogBook.book_id === 101
      ? `Matches your saved interests in ${catalogBook.category} and ${catalogBook.subject}, and is highly rated by students in your department.`
      : null;

  return {
    book: detailedBook,
    issued_copies: issuedCopies,
    loan_period_days: 14, // Sample institutional default returned by backend settings (not hardcoded in UI)
    student_eligibility: {
      is_authenticated: isAuthenticated,
      can_borrow:
        isAuthenticated &&
        catalogBook.available_copies > 0 &&
        !isAlreadyBorrowed,
      ineligible_reason: !isAuthenticated
        ? 'Sign in with your student account to borrow or reserve books.'
        : isAlreadyBorrowed
          ? 'You currently have an active loan for this title.'
          : catalogBook.available_copies === 0
            ? 'All copies are currently issued or reserved.'
            : undefined,
      already_borrowed: isAlreadyBorrowed,
      active_borrowing: isAlreadyBorrowed
        ? {
            transaction_id: 502,
            issue_date: '2026-11-07',
            due_date: '2026-11-21',
          }
        : undefined,
      active_reservation: hasActiveReservation
        ? {
            reservation_id: 309,
            student_id: 1042,
            book_id: catalogBook.book_id,
            reservation_date: '2026-11-11',
            status: 'Active',
            queue_position: 1,
          }
        : undefined,
      can_review: isAuthenticated && hasCompletedPastBorrow,
      review_ineligible_reason: !isAuthenticated
        ? 'Sign in to submit a rating and review.'
        : !hasCompletedPastBorrow
          ? 'Ratings and reviews are enabled after you borrow and return this book.'
          : undefined,
    },
    recommendation_reason: recommendationReason,
    rating_distribution: buildRatingDistribution(
      catalogBook.rating_count,
      catalogBook.rating_average
    ),
    reviews: buildSampleReviews(catalogBook),
    related_books: getRelatedSimilarBooks(catalogBook, SAMPLE_LIBRARY_CATALOG, 4),
    is_prototype_sample: true,
  };
}

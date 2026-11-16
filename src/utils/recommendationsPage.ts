import {
  getBookAvailabilityInfo,
  SAMPLE_LIBRARY_CATALOG,
  type CatalogBook,
} from './bookCatalog';
import type { BookRatingReview, StudentProfile } from './studentDashboard';

export type RecommendationSource =
  | 'content_based'
  | 'collaborative'
  | 'hybrid'
  | 'popular'
  | 'interest_based';

export type RecommendationFeedbackValue = 'useful' | 'not_useful' | 'not_interested';

export interface RecommendationScoringWeights {
  interests: number;
  reading_history: number;
  ratings_feedback: number;
  collaborative: number;
}

// Single source of truth for hybrid recommendation weights (mirrors RECOMMENDATION_SCORING_CONFIG)
export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationScoringWeights = {
  interests: 0.3,
  reading_history: 0.25,
  ratings_feedback: 0.25,
  collaborative: 0.2,
};

export type RecommendationSectionKey =
  | 'top_picks'
  | 'because_you_read'
  | 'based_on_interests'
  | 'students_like_you'
  | 'highly_rated_subjects'
  | 'available_now'
  | 'read_again';

export interface RecommendationItem {
  book_id: number;
  slug: string;
  title: string;
  author: string;
  cover_image: string;
  category: string;
  subject: string;
  language: string;
  format: string;
  publication_year: number;
  rating: number;
  rating_count: number;
  student_user_rating?: number;
  availability: 'Available' | 'Currently Issued' | 'Reserved' | 'Unavailable';
  availability_detail: string;
  available_copies: number;
  total_copies: number;
  reserved_copies: number;
  is_available: boolean;
  recommendation_score: number | null;
  recommendation_reason: string;
  explanation_factors: string[];
  recommendation_source: RecommendationSource;
  section_tags: RecommendationSectionKey[];
  reference_book_title?: string;
  already_completed?: boolean;
  feedback?: RecommendationFeedbackValue | null;
}

export interface RecommendationOverviewSummary {
  interests: string[];
  preferred_subjects: string[];
  books_read: number;
  books_rated: number;
  recommendation_confidence: string | null;
}

export interface RecommendationFilterState {
  category: string;
  subject: string;
  availability: 'all' | 'available' | 'reservable';
  language: string;
  minRating: string;
  format: string;
}

export const DEFAULT_RECOMMENDATION_FILTERS: RecommendationFilterState = {
  category: '',
  subject: '',
  availability: 'all',
  language: '',
  minRating: '',
  format: '',
};

export interface RecommendationsPayload {
  is_prototype_sample: boolean;
  is_cold_start: boolean;
  last_updated_at: string | null;
  scoring_weights: RecommendationScoringWeights;
  summary: RecommendationOverviewSummary;
  because_you_read_anchor: string | null;
  items: RecommendationItem[];
  facets: {
    categories: string[];
    subjects: string[];
    languages: string[];
    formats: string[];
  };
}

export interface PartitionedRecommendationSections {
  topPicks: RecommendationItem[];
  becauseYouRead: RecommendationItem[];
  basedOnInterests: RecommendationItem[];
  studentsLikeYou: RecommendationItem[];
  highlyRatedSubjects: RecommendationItem[];
  availableNow: RecommendationItem[];
  readAgain: RecommendationItem[];
}

export function buildRecommendationsApiParams(
  filters: RecommendationFilterState,
  limit: number = 20
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (filters.category) params.set('category', filters.category);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.availability !== 'all') params.set('availability', filters.availability);
  if (filters.language) params.set('language', filters.language);
  if (filters.minRating) params.set('min_rating', filters.minRating);
  if (filters.format) params.set('format', filters.format);
  return params;
}

export function filterRecommendations(
  items: RecommendationItem[],
  filters: RecommendationFilterState
): RecommendationItem[] {
  const minRatingNum = filters.minRating ? Number.parseFloat(filters.minRating) : Number.NaN;

  return items.filter((item) => {
    if (item.feedback === 'not_interested') {
      return false;
    }
    if (filters.category && item.category !== filters.category) {
      return false;
    }
    if (filters.subject && item.subject !== filters.subject) {
      return false;
    }
    if (filters.availability === 'available' && !item.is_available) {
      return false;
    }
    if (filters.availability === 'reservable' && (item.is_available || item.total_copies === 0)) {
      return false;
    }
    if (filters.language && item.language !== filters.language) {
      return false;
    }
    if (filters.format && item.format !== filters.format) {
      return false;
    }
    if (!Number.isNaN(minRatingNum) && item.rating < minRatingNum) {
      return false;
    }
    return true;
  });
}

export function countActiveRecommendationFilters(filters: RecommendationFilterState): number {
  let count = 0;
  if (filters.category) count += 1;
  if (filters.subject) count += 1;
  if (filters.availability !== 'all') count += 1;
  if (filters.language) count += 1;
  if (filters.minRating) count += 1;
  if (filters.format) count += 1;
  return count;
}

export function partitionRecommendationSections(
  items: RecommendationItem[],
  limitTopPicks: number = 8
): PartitionedRecommendationSections {
  const activeItems = items.filter((item) => item.feedback !== 'not_interested');

  const topPicks = activeItems
    .filter((item) => !item.already_completed && item.section_tags.includes('top_picks'))
    .sort((a, b) => (b.recommendation_score ?? 0) - (a.recommendation_score ?? 0))
    .slice(0, limitTopPicks);

  const becauseYouRead = activeItems
    .filter((item) => !item.already_completed && item.section_tags.includes('because_you_read'))
    .slice(0, 4);

  const basedOnInterests = activeItems
    .filter((item) => !item.already_completed && item.section_tags.includes('based_on_interests'))
    .slice(0, 4);

  const studentsLikeYou = activeItems
    .filter((item) => !item.already_completed && item.section_tags.includes('students_like_you'))
    .slice(0, 4);

  const highlyRatedSubjects = activeItems
    .filter(
      (item) => !item.already_completed && item.section_tags.includes('highly_rated_subjects')
    )
    .slice(0, 4);

  const availableNow = activeItems
    .filter((item) => !item.already_completed && item.is_available)
    .slice(0, 4);

  const readAgain = activeItems
    .filter((item) => Boolean(item.already_completed) || item.section_tags.includes('read_again'))
    .slice(0, 4);

  return {
    topPicks,
    becauseYouRead,
    basedOnInterests,
    studentsLikeYou,
    highlyRatedSubjects,
    availableNow,
    readAgain,
  };
}

export function updateRecommendationFeedback(
  items: RecommendationItem[],
  bookId: number,
  feedback: RecommendationFeedbackValue
): RecommendationItem[] {
  return items.map((item) =>
    item.book_id === bookId
      ? {
          ...item,
          feedback: item.feedback === feedback ? null : feedback,
        }
      : item
  );
}

export function getRecommendationSourceLabel(source: RecommendationSource): string {
  switch (source) {
    case 'hybrid':
      return 'Hybrid Match';
    case 'content_based':
      return 'Content Similarity';
    case 'collaborative':
      return 'Similar Readers';
    case 'interest_based':
      return 'Interest Match';
    case 'popular':
      return 'Popular in Subject';
  }
}

function mapCatalogBookToRecommendation(
  book: CatalogBook,
  config: {
    score: number | null;
    reason: string;
    factors: string[];
    source: RecommendationSource;
    tags: RecommendationSectionKey[];
    studentRating?: number;
    referenceBookTitle?: string;
    alreadyCompleted?: boolean;
  }
): RecommendationItem {
  const availInfo = getBookAvailabilityInfo(book);
  const availability: RecommendationItem['availability'] =
    availInfo.status === 'available'
      ? 'Available'
      : availInfo.status === 'reserved'
        ? 'Reserved'
        : book.total_copies > 0
          ? 'Currently Issued'
          : 'Unavailable';

  const availabilityDetail =
    availInfo.status === 'available'
      ? book.format === 'E-Book'
        ? 'Available (E-Book)'
        : book.total_copies > 1
          ? `${book.available_copies} copies available`
          : 'Available'
      : book.total_copies > 0
        ? 'Reserve Available'
        : 'Unavailable';

  return {
    book_id: book.book_id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    cover_image: book.cover_image,
    category: book.category,
    subject: book.subject,
    language: book.language,
    format: book.format,
    publication_year: book.publication_year,
    rating: book.rating_average,
    rating_count: book.rating_count,
    student_user_rating: config.studentRating,
    availability,
    availability_detail: availabilityDetail,
    available_copies: book.available_copies,
    total_copies: book.total_copies,
    reserved_copies: book.reserved_copies,
    is_available: book.available_copies > 0,
    recommendation_score: config.score,
    recommendation_reason: config.reason,
    explanation_factors: config.factors,
    recommendation_source: config.source,
    section_tags: config.tags,
    reference_book_title: config.referenceBookTitle,
    already_completed: config.alreadyCompleted,
    feedback: null,
  };
}

export function createSampleRecommendationsData(
  student: StudentProfile,
  readingHistoryCount: number,
  recentReviews: BookRatingReview[]
): RecommendationsPayload {
  const byId = (id: number): CatalogBook =>
    SAMPLE_LIBRARY_CATALOG.find((b) => b.book_id === id) ?? SAMPLE_LIBRARY_CATALOG[0];

  const isColdStart = readingHistoryCount === 0 && recentReviews.length === 0;
  const anchorTitle = 'Python for Data Analysis & Pandas Workflows';

  const rawItems: RecommendationItem[] = [
    mapCatalogBookToRecommendation(byId(105), {
      score: isColdStart ? null : 0.96,
      reason: 'Matches your interest in Artificial Intelligence and is currently available.',
      factors: [
        'Matches your interest in Artificial Intelligence',
        'Highly rated by students in Computer Science',
        'Currently available (4 copies)',
      ],
      source: isColdStart ? 'interest_based' : 'hybrid',
      tags: ['top_picks', 'based_on_interests', 'highly_rated_subjects', 'available_now'],
    }),
    mapCatalogBookToRecommendation(byId(126), {
      score: isColdStart ? null : 0.94,
      reason: 'Matches your preferred subject: Python, and extends your AI coursework.',
      factors: [
        'Matches your preferred subject: Python Programming',
        'Similar to books you previously borrowed',
        'Currently available (3 copies)',
      ],
      source: isColdStart ? 'interest_based' : 'hybrid',
      tags: ['top_picks', 'because_you_read', 'based_on_interests', 'available_now'],
      referenceBookTitle: anchorTitle,
    }),
    mapCatalogBookToRecommendation(byId(109), {
      score: isColdStart ? null : 0.92,
      reason: 'Highly rated by students with reading preferences similar to yours.',
      factors: [
        'Matches your interest in Artificial Intelligence',
        'Popular among students with reading preferences similar to yours',
        'Instant E-Book access available',
      ],
      source: 'collaborative',
      tags: ['top_picks', 'students_like_you', 'highly_rated_subjects', 'available_now'],
    }),
    mapCatalogBookToRecommendation(byId(115), {
      score: isColdStart ? null : 0.89,
      reason: 'You rated similar Data Science and Algorithms books highly.',
      factors: [
        'Supports Machine Learning mathematical foundations',
        'You rated similar quantitative titles highly',
        'Currently available (3 copies)',
      ],
      source: 'content_based',
      tags: ['top_picks', 'because_you_read', 'highly_rated_subjects', 'available_now'],
      referenceBookTitle: anchorTitle,
    }),
    mapCatalogBookToRecommendation(byId(101), {
      score: isColdStart ? null : 0.87,
      reason: 'Matches your selected interest in Python Programming.',
      factors: [
        'Matches your interest in Python Programming',
        'Strong community rating (4.8 ★ across 142 ratings)',
        'Currently available (3 copies)',
      ],
      source: 'interest_based',
      tags: ['top_picks', 'based_on_interests', 'available_now'],
    }),
    mapCatalogBookToRecommendation(byId(107), {
      score: isColdStart ? null : 0.85,
      reason: 'Similar to Data Science books you previously borrowed.',
      factors: [
        'Matches your Data Science interest',
        'Similar to Python for Data Analysis & Pandas Workflows',
        'Currently available (1 copy)',
      ],
      source: 'content_based',
      tags: ['top_picks', 'because_you_read', 'students_like_you'],
      referenceBookTitle: anchorTitle,
    }),
    mapCatalogBookToRecommendation(byId(127), {
      score: isColdStart ? null : 0.83,
      reason: 'Popular among students with reading preferences similar to yours.',
      factors: [
        'Popular among students with similar computer science preferences',
        'Highly rated across 184 student reviews',
        'Currently available (1 copy)',
      ],
      source: 'collaborative',
      tags: ['top_picks', 'students_like_you', 'highly_rated_subjects'],
    }),
    mapCatalogBookToRecommendation(byId(114), {
      score: isColdStart ? null : 0.8,
      reason: 'Broadens your Computer Science profile with high peer ratings.',
      factors: [
        'Recommended for subject diversity in Computer Science',
        'Highly rated by similar student cohorts',
        'Currently available (1 copy)',
      ],
      source: 'collaborative',
      tags: ['top_picks', 'students_like_you'],
    }),
    mapCatalogBookToRecommendation(byId(111), {
      score: isColdStart ? null : 0.78,
      reason: 'Matches your Python background (all copies currently issued — reserve available).',
      factors: [
        'Matches your Python & backend engineering interests',
        'All physical copies are currently issued; reservation queue is open',
      ],
      source: 'content_based',
      tags: ['because_you_read', 'based_on_interests'],
      referenceBookTitle: anchorTitle,
    }),
    mapCatalogBookToRecommendation(byId(106), {
      score: isColdStart ? null : 0.76,
      reason: 'Reference title you rated 5 stars — keep handy for algorithm interview prep.',
      factors: [
        'You rated this book 5 stars previously',
        'Recommended in Read Again for ongoing reference',
      ],
      source: 'content_based',
      tags: ['read_again'],
      studentRating: recentReviews[0]?.rating ?? 5,
      alreadyCompleted: true,
    }),
  ];

  const categories = Array.from(new Set(rawItems.map((i) => i.category))).sort((a, b) =>
    a.localeCompare(b)
  );
  const subjects = Array.from(new Set(rawItems.map((i) => i.subject))).sort((a, b) =>
    a.localeCompare(b)
  );
  const languages = Array.from(new Set(rawItems.map((i) => i.language))).sort((a, b) =>
    a.localeCompare(b)
  );
  const formats = Array.from(new Set(rawItems.map((i) => i.format))).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    is_prototype_sample: true,
    is_cold_start: isColdStart,
    last_updated_at: null,
    scoring_weights: DEFAULT_RECOMMENDATION_WEIGHTS,
    summary: {
      interests: student.interests,
      preferred_subjects: student.preferred_subjects,
      books_read: readingHistoryCount,
      books_rated: recentReviews.length,
      recommendation_confidence: isColdStart ? null : 'Strong Hybrid Profile',
    },
    because_you_read_anchor: isColdStart ? null : anchorTitle,
    items: rawItems,
    facets: {
      categories,
      subjects,
      languages,
      formats,
    },
  };
}

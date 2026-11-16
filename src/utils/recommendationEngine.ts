import type {
  RecommendationFeedbackValue,
  RecommendationItem,
  RecommendationSectionKey,
  RecommendationSource,
  RecommendationsPayload,
  RecommendationScoringWeights,
} from './recommendationsPage';

export const RECOMMENDATION_SCORING_CONFIG: RecommendationScoringWeights = {
  interests: 0.3,
  reading_history: 0.25,
  ratings_feedback: 0.25,
  collaborative: 0.2,
};

export interface RecommendationEngineBookInput {
  book_id: number;
  slug: string;
  title: string;
  author: string;
  cover_image: string;
  category: string;
  subject: string;
  keywords: string[];
  language: string;
  format: string;
  publication_year: number;
  rating_average: number;
  rating_count: number;
  available_copies: number;
  total_copies: number;
  reserved_copies: number;
  borrow_count: number;
  status?: 'Active' | 'Archived';
}

export interface RecommendationEngineStudentInput {
  student_id: number;
  department: string;
  interests: string[];
  preferred_subjects: string[];
}

export interface RecommendationEngineBorrowingInput {
  student_id: number;
  book_id: number;
  status: 'borrowed' | 'returned' | 'overdue';
  issue_date: string;
  return_date: string | null;
}

export interface RecommendationEngineReviewInput {
  student_id: number;
  book_id: number;
  rating: number;
  updated_at: string;
}

export interface RecommendationEngineFeedbackInput {
  student_id: number;
  book_id: number;
  feedback: RecommendationFeedbackValue;
  updated_at: string;
}

export interface ComputeLiveRecommendationsInput {
  student: RecommendationEngineStudentInput;
  books: RecommendationEngineBookInput[];
  allBorrowings: RecommendationEngineBorrowingInput[];
  allReviews: RecommendationEngineReviewInput[];
  studentFeedback: RecommendationEngineFeedbackInput[];
  allStudents?: RecommendationEngineStudentInput[];
  weights?: RecommendationScoringWeights;
  nowIso?: string;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function tokenizeList(values: string[]): string[] {
  const tokens: string[] = [];
  for (const val of values) {
    const clean = normalizeToken(val);
    if (!clean) continue;
    tokens.push(clean);
    for (const part of clean.split(/[\s,&/+-]+/)) {
      if (part.length >= 3) {
        tokens.push(part);
      }
    }
  }
  return Array.from(new Set(tokens));
}

function computeTokenOverlap(studentTokens: string[], bookTokens: string[]): number {
  if (studentTokens.length === 0 || bookTokens.length === 0) return 0;
  let matches = 0;
  for (const sToken of studentTokens) {
    if (
      bookTokens.some(
        (bToken) => bToken === sToken || bToken.includes(sToken) || sToken.includes(bToken)
      )
    ) {
      matches += 1;
    }
  }
  return Math.min(1, matches / Math.max(2, Math.min(studentTokens.length, 4)));
}

/**
 * Computes real, live hybrid recommendations driven by the student's saved interests,
 * reading history, ratings/feedback, collaborative peer reading overlap, and live copy availability.
 */
export function computeLiveRecommendations(
  input: ComputeLiveRecommendationsInput
): RecommendationsPayload {
  const weights = input.weights ?? RECOMMENDATION_SCORING_CONFIG;
  const studentId = input.student.student_id;

  const activeCatalogBooks = input.books.filter((book) => book.status !== 'Archived');
  const bookById = new Map(activeCatalogBooks.map((b) => [b.book_id, b]));

  const studentBorrowings = input.allBorrowings.filter((b) => b.student_id === studentId);
  const completedBookIds = new Set(
    studentBorrowings.filter((b) => b.status === 'returned').map((b) => b.book_id)
  );
  const currentlyBorrowedIds = new Set(
    studentBorrowings.filter((b) => b.status !== 'returned').map((b) => b.book_id)
  );
  const studentBorrowedAllIds = new Set(studentBorrowings.map((b) => b.book_id));

  const studentReviews = input.allReviews.filter((r) => r.student_id === studentId);
  const studentReviewMap = new Map(studentReviews.map((r) => [r.book_id, r]));

  const feedbackMap = new Map(
    input.studentFeedback
      .filter((f) => f.student_id === studentId)
      .map((f) => [f.book_id, f.feedback])
  );

  // Determine cold start strictly: zero reading history AND zero ratings
  const readingHistoryCount = completedBookIds.size;
  const booksRatedCount = studentReviews.length;
  const isColdStart = readingHistoryCount === 0 && booksRatedCount === 0;

  // Determine "Because you read" anchor strictly from actual completed/rated books
  const sortedCompletedOrRated = [
    ...studentBorrowings
      .filter((b) => b.status === 'returned')
      .sort((a, b) => (b.return_date ?? b.issue_date).localeCompare(a.return_date ?? a.issue_date))
      .map((b) => ({
        book: bookById.get(b.book_id),
        rating: studentReviewMap.get(b.book_id)?.rating ?? 4,
      })),
    ...studentReviews
      .filter((r) => !completedBookIds.has(r.book_id))
      .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at))
      .map((r) => ({
        book: bookById.get(r.book_id),
        rating: r.rating,
      })),
  ].filter((entry): entry is { book: RecommendationEngineBookInput; rating: number } => Boolean(entry.book));

  const preferredAnchor =
    sortedCompletedOrRated.find((e) => e.rating >= 4)?.book ??
    sortedCompletedOrRated[0]?.book ??
    null;

  const becauseYouReadAnchor = !isColdStart && preferredAnchor ? preferredAnchor.title : null;

  // Student explicit interest tokens
  const explicitInterestTokens = tokenizeList([
    ...input.student.interests,
    ...input.student.preferred_subjects,
    input.student.department,
  ]);

  // History-derived subjects & categories (weighted by rating if present)
  const historyAffinityTokens: string[] = [];
  const positiveRatedSubjects = new Set<string>();
  const negativeRatedSubjects = new Set<string>();

  for (const bId of studentBorrowedAllIds) {
    const book = bookById.get(bId);
    if (!book) continue;
    const rev = studentReviewMap.get(bId);
    if (rev && rev.rating <= 2) {
      negativeRatedSubjects.add(normalizeToken(book.subject));
      continue;
    }
    historyAffinityTokens.push(book.subject, book.category, ...book.keywords.slice(0, 3));
    if (rev && rev.rating >= 4) {
      positiveRatedSubjects.add(normalizeToken(book.subject));
      historyAffinityTokens.push(book.subject, book.subject);
    }
  }
  for (const rev of studentReviews) {
    const book = bookById.get(rev.book_id);
    if (!book) continue;
    if (rev.rating >= 4) {
      positiveRatedSubjects.add(normalizeToken(book.subject));
      historyAffinityTokens.push(book.subject, book.category, ...book.keywords.slice(0, 3));
    } else if (rev.rating <= 2) {
      negativeRatedSubjects.add(normalizeToken(book.subject));
    }
  }
  const normalizedHistoryTokens = tokenizeList(historyAffinityTokens);

  // Feedback subject adjustments (`useful` boosts subject, `not_useful` slightly dampens)
  const usefulSubjects = new Set<string>();
  const notUsefulSubjects = new Set<string>();
  for (const [bId, fb] of feedbackMap.entries()) {
    const book = bookById.get(bId);
    if (!book) continue;
    if (fb === 'useful') usefulSubjects.add(normalizeToken(book.subject));
    if (fb === 'not_useful') notUsefulSubjects.add(normalizeToken(book.subject));
  }

  // Collaborative peer cohort: other students who borrowed/liked same books or share department/interests
  const peerIds = new Set<number>();
  for (const b of input.allBorrowings) {
    if (b.student_id !== studentId && studentBorrowedAllIds.has(b.book_id)) {
      peerIds.add(b.student_id);
    }
  }
  for (const r of input.allReviews) {
    if (r.student_id !== studentId && r.rating >= 4 && studentBorrowedAllIds.has(r.book_id)) {
      peerIds.add(r.student_id);
    }
  }
  if (peerIds.size === 0 && input.allStudents) {
    for (const other of input.allStudents) {
      if (other.student_id === studentId) continue;
      if (
        normalizeToken(other.department) === normalizeToken(input.student.department) ||
        other.interests.some((i) => explicitInterestTokens.includes(normalizeToken(i)))
      ) {
        peerIds.add(other.student_id);
      }
    }
  }

  const peerBookScores = new Map<number, number>();
  for (const b of input.allBorrowings) {
    if (peerIds.has(b.student_id)) {
      peerBookScores.set(b.book_id, (peerBookScores.get(b.book_id) ?? 0) + 1);
    }
  }
  for (const r of input.allReviews) {
    if (peerIds.has(r.student_id) && r.rating >= 4) {
      peerBookScores.set(r.book_id, (peerBookScores.get(r.book_id) ?? 0) + r.rating * 0.5);
    }
  }
  const maxPeerSignal = Math.max(1, ...Array.from(peerBookScores.values()));

  const maxBorrowCount = Math.max(1, ...activeCatalogBooks.map((b) => b.borrow_count));

  const scoredItems: RecommendationItem[] = [];

  for (const book of activeCatalogBooks) {
    const feedback = feedbackMap.get(book.book_id) ?? null;
    if (feedback === 'not_interested') {
      continue;
    }

    // Skip books currently actively borrowed by this student unless already completed earlier
    const isCurrentlyBorrowed = currentlyBorrowedIds.has(book.book_id);
    const alreadyCompleted = completedBookIds.has(book.book_id);
    if (isCurrentlyBorrowed && !alreadyCompleted) {
      continue;
    }

    const bookTokens = tokenizeList([
      book.title,
      book.subject,
      book.category,
      ...book.keywords,
    ]);

    const interestMatch = computeTokenOverlap(explicitInterestTokens, bookTokens);
    const historyMatch = computeTokenOverlap(normalizedHistoryTokens, bookTokens);
    const anchorMatch =
      preferredAnchor && preferredAnchor.book_id !== book.book_id
        ? computeTokenOverlap(
            tokenizeList([
              preferredAnchor.subject,
              preferredAnchor.category,
              ...preferredAnchor.keywords,
            ]),
            bookTokens
          )
        : 0;

    // Ratings & feedback component (normalized 0..1)
    let ratingsFeedbackSignal = Math.min(1, Math.max(0, (book.rating_average - 2.5) / 2.5));
    const normSubject = normalizeToken(book.subject);
    if (positiveRatedSubjects.has(normSubject)) {
      ratingsFeedbackSignal = Math.min(1, ratingsFeedbackSignal + 0.25);
    }
    if (negativeRatedSubjects.has(normSubject)) {
      ratingsFeedbackSignal = Math.max(0.05, ratingsFeedbackSignal - 0.35);
    }
    if (usefulSubjects.has(normSubject)) {
      ratingsFeedbackSignal = Math.min(1, ratingsFeedbackSignal + 0.15);
    }
    if (notUsefulSubjects.has(normSubject)) {
      ratingsFeedbackSignal = Math.max(0.05, ratingsFeedbackSignal - 0.2);
    }
    if (feedback === 'useful') {
      ratingsFeedbackSignal = Math.min(1, ratingsFeedbackSignal + 0.12);
    } else if (feedback === 'not_useful') {
      ratingsFeedbackSignal = Math.max(0.05, ratingsFeedbackSignal - 0.25);
    }

    // Collaborative component
    const peerRaw = peerBookScores.get(book.book_id) ?? 0;
    const popularityFallback = (book.borrow_count / maxBorrowCount) * 0.45;
    const collaborativeSignal = Math.min(
      1,
      peerRaw > 0 ? peerRaw / maxPeerSignal : popularityFallback
    );

    // Compute weighted raw score
    let combinedScore: number;
    if (isColdStart) {
      // Cold-start relies on explicit interests, department, community quality, and live availability
      const availabilityBoost = book.available_copies > 0 ? 0.12 : -0.15;
      combinedScore = Math.max(
        0.1,
        Math.min(
          0.99,
          interestMatch * 0.55 +
            ratingsFeedbackSignal * 0.25 +
            (book.borrow_count / maxBorrowCount) * 0.2 +
            availabilityBoost
        )
      );
    } else {
      const effectiveHistory = Math.max(historyMatch, anchorMatch);
      const rawWeighted =
        interestMatch * weights.interests +
        effectiveHistory * weights.reading_history +
        ratingsFeedbackSignal * weights.ratings_feedback +
        collaborativeSignal * weights.collaborative;

      // Live availability boost keeps available titles higher without hiding out-of-stock reservables completely
      const availabilityFactor =
        book.available_copies > 0 ? 0.08 : book.total_copies > 0 ? -0.12 : -0.35;
      combinedScore = Math.max(0.1, Math.min(0.99, rawWeighted + availabilityFactor));
    }

    // Determine primary source and section tags
    const tags: RecommendationSectionKey[] = [];
    if (alreadyCompleted) {
      tags.push('read_again');
    } else {
      tags.push('top_picks');
      if (!isColdStart && (anchorMatch >= 0.35 || historyMatch >= 0.4)) {
        tags.push('because_you_read');
      }
      if (interestMatch >= 0.3) {
        tags.push('based_on_interests');
      }
      if (collaborativeSignal >= 0.35 && peerRaw > 0) {
        tags.push('students_like_you');
      }
      if (book.rating_average >= 4.4 && (interestMatch >= 0.25 || positiveRatedSubjects.has(normSubject))) {
        tags.push('highly_rated_subjects');
      }
      if (book.available_copies > 0) {
        tags.push('available_now');
      }
    }

    let source: RecommendationSource = 'hybrid';
    if (isColdStart) {
      source = interestMatch >= 0.3 ? 'interest_based' : 'popular';
    } else if (collaborativeSignal > interestMatch && collaborativeSignal > historyMatch && peerRaw > 0) {
      source = 'collaborative';
    } else if (historyMatch > interestMatch) {
      source = 'content_based';
    } else if (interestMatch > historyMatch && historyMatch < 0.25) {
      source = 'interest_based';
    }

    // Build honest, plain-language explanations
    const factors: string[] = [];
    const matchedInterest = input.student.interests.find((int) =>
      bookTokens.some(
        (bt) => bt.includes(normalizeToken(int)) || normalizeToken(int).includes(bt)
      )
    );
    if (matchedInterest) {
      factors.push(`Matches your interest in ${matchedInterest}`);
    } else if (
      input.student.preferred_subjects.some(
        (sub) => normalizeToken(sub) === normSubject
      )
    ) {
      factors.push(`Matches your preferred subject: ${book.subject}`);
    }

    if (!isColdStart && preferredAnchor && anchorMatch >= 0.35 && preferredAnchor.book_id !== book.book_id) {
      factors.push(`Similar to "${preferredAnchor.title}" from your reading activity`);
    }
    if (positiveRatedSubjects.has(normSubject)) {
      factors.push(`You rated ${book.subject} titles highly`);
    }
    if (peerRaw > 0) {
      factors.push(`Popular among students with reading preferences similar to yours`);
    }
    if (book.rating_average >= 4.4 && book.rating_count > 0) {
      factors.push(`Highly rated (${book.rating_average.toFixed(1)} ★ across ${book.rating_count} ratings)`);
    }
    if (book.available_copies > 0) {
      factors.push(
        book.format === 'E-Book'
          ? 'Instant E-Book access available'
          : `Currently available (${book.available_copies} ${book.available_copies === 1 ? 'copy' : 'copies'})`
      );
    } else if (book.total_copies > 0) {
      factors.push('All copies currently issued — reserve to join queue');
    }

    if (factors.length === 0) {
      factors.push(`Popular title in ${book.subject} (${book.category})`);
    }

    const primaryReason = factors[0] + (book.available_copies > 0 ? ' and ready to borrow.' : '.');

    const availability: RecommendationItem['availability'] =
      book.available_copies > 0
        ? 'Available'
        : book.reserved_copies > 0
          ? 'Reserved'
          : book.total_copies > 0
            ? 'Currently Issued'
            : 'Unavailable';

    const availabilityDetail =
      book.available_copies > 0
        ? book.format === 'E-Book'
          ? 'Available (E-Book)'
          : book.total_copies > 1
            ? `${book.available_copies} copies available`
            : 'Available'
        : book.total_copies > 0
          ? 'Reserve Available'
          : 'Unavailable';

    scoredItems.push({
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
      student_user_rating: studentReviewMap.get(book.book_id)?.rating,
      availability,
      availability_detail: availabilityDetail,
      available_copies: book.available_copies,
      total_copies: book.total_copies,
      reserved_copies: book.reserved_copies,
      is_available: book.available_copies > 0,
      recommendation_score: isColdStart ? null : Number(combinedScore.toFixed(2)),
      recommendation_reason: primaryReason,
      explanation_factors: factors.slice(0, 4),
      recommendation_source: source,
      section_tags: tags,
      reference_book_title: !isColdStart && anchorMatch >= 0.35 ? preferredAnchor?.title : undefined,
      already_completed: alreadyCompleted,
      feedback,
    });
  }

  // Sort by availability boost + score descending
  scoredItems.sort((a, b) => {
    if (Boolean(a.already_completed) !== Boolean(b.already_completed)) {
      return a.already_completed ? 1 : -1;
    }
    const scoreDiff = (b.recommendation_score ?? 0) - (a.recommendation_score ?? 0);
    if (Math.abs(scoreDiff) > 0.03) return scoreDiff;
    if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
    return b.rating - a.rating;
  });

  // For cold start, still rank best available matches first using our internal match rank
  if (isColdStart) {
    scoredItems.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
      const aInterest = a.section_tags.includes('based_on_interests') ? 1 : 0;
      const bInterest = b.section_tags.includes('based_on_interests') ? 1 : 0;
      if (aInterest !== bInterest) return bInterest - aInterest;
      return b.rating - a.rating;
    });
  }

  const topItems = scoredItems.slice(0, 24);
  const categories = Array.from(new Set(topItems.map((i) => i.category))).sort((a, b) =>
    a.localeCompare(b)
  );
  const subjects = Array.from(new Set(topItems.map((i) => i.subject))).sort((a, b) =>
    a.localeCompare(b)
  );
  const languages = Array.from(new Set(topItems.map((i) => i.language))).sort((a, b) =>
    a.localeCompare(b)
  );
  const formats = Array.from(new Set(topItems.map((i) => i.format))).sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    is_prototype_sample: false,
    is_cold_start: isColdStart,
    last_updated_at: input.nowIso ?? new Date().toISOString(),
    scoring_weights: weights,
    summary: {
      interests: input.student.interests,
      preferred_subjects: input.student.preferred_subjects,
      books_read: readingHistoryCount,
      books_rated: booksRatedCount,
      recommendation_confidence: isColdStart
        ? null
        : readingHistoryCount >= 3 || booksRatedCount >= 2
          ? 'Strong Hybrid Profile'
          : 'Growing Profile',
    },
    because_you_read_anchor: becauseYouReadAnchor,
    items: topItems,
    facets: {
      categories,
      subjects,
      languages,
      formats,
    },
  };
}

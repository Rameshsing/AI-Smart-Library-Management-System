import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRatingDistribution,
  calculateDueDateIso,
  createSampleBookDetailData,
  formatDisplayDate,
  getRelatedSimilarBooks,
  validateReviewInput,
} from './bookDetails.ts';
import { SAMPLE_LIBRARY_CATALOG } from './bookCatalog.ts';

test('calculateDueDateIso uses configured loan period dynamically and formats display date', () => {
  const issueDate = new Date(2026, 10, 14); // 14 Nov 2026
  const due7 = calculateDueDateIso(issueDate, 7);
  const due14 = calculateDueDateIso(issueDate, 14);

  assert.equal(due7, '2026-11-21');
  assert.equal(due14, '2026-11-28');
  assert.equal(formatDisplayDate(due7), '21 Nov 2026');
  assert.equal(formatDisplayDate('2026-11-14'), '14 Nov 2026');
});

test('validateReviewInput validates star range, optional/required text, and length cap', () => {
  assert.equal(validateReviewInput(0, 'Great book').valid, false);
  assert.equal(validateReviewInput(6, 'Great book').valid, false);
  assert.equal(validateReviewInput(5, '').valid, true);
  assert.equal(validateReviewInput(5, '', true).valid, false);
  assert.equal(validateReviewInput(4, 'Very clear Python examples.', true).valid, true);
});

test('buildRatingDistribution sums cleanly to totalRatings and handles zero ratings', () => {
  const zero = buildRatingDistribution(0, 0);
  assert.equal(
    zero.reduce((acc, item) => acc + item.count, 0),
    0
  );

  const dist = buildRatingDistribution(128, 4.7);
  assert.equal(dist.length, 5);
  assert.equal(
    dist.reduce((acc, item) => acc + item.count, 0),
    128
  );
  assert.ok(dist[0]!.count > dist[4]!.count);
});

test('getRelatedSimilarBooks excludes current book and ranks by content/metadata similarity', () => {
  const target = SAMPLE_LIBRARY_CATALOG.find((b) => b.book_id === 101)!;
  const related = getRelatedSimilarBooks(target, SAMPLE_LIBRARY_CATALOG, 4);

  assert.equal(related.length, 4);
  assert.ok(related.every((b) => b.book_id !== target.book_id));
  assert.ok(
    related.some(
      (b) => b.category === 'Programming' || b.keywords.includes('python')
    )
  );
});

test('createSampleBookDetailData resolves IDs and slugs with accurate eligibility and location metadata', () => {
  const availableBook = createSampleBookDetailData('101');
  assert.ok(availableBook !== null);
  assert.equal(availableBook.book.book_id, 101);
  assert.ok(availableBook.book.location?.shelf);
  assert.equal(availableBook.student_eligibility.can_borrow, true);
  assert.equal(availableBook.student_eligibility.can_review, true);

  const reservedBook = createSampleBookDetailData('104');
  assert.ok(reservedBook !== null);
  assert.equal(reservedBook.student_eligibility.active_reservation?.status, 'Active');

  const unreviewedBook = createSampleBookDetailData('128');
  assert.ok(unreviewedBook !== null);
  assert.equal(unreviewedBook.reviews.length, 0);

  assert.equal(createSampleBookDetailData('999999'), null);
});

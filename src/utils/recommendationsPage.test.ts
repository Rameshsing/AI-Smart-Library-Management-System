import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRecommendationsApiParams,
  countActiveRecommendationFilters,
  createSampleRecommendationsData,
  DEFAULT_RECOMMENDATION_FILTERS,
  filterRecommendations,
  partitionRecommendationSections,
  updateRecommendationFeedback,
} from './recommendationsPage.ts';
import { createSampleStudentDashboardData } from './studentDashboard.ts';

test('createSampleRecommendationsData handles active history vs cold-start student cleanly', () => {
  const sampleDash = createSampleStudentDashboardData();
  const activePayload = createSampleRecommendationsData(
    sampleDash.student,
    sampleDash.reading_history_count,
    sampleDash.recent_reviews
  );

  assert.equal(activePayload.is_cold_start, false);
  assert.equal(activePayload.summary.books_read, 24);
  assert.equal(activePayload.summary.books_rated, 1);
  assert.ok(activePayload.summary.recommendation_confidence);
  assert.ok(activePayload.items.length >= 8);

  const coldPayload = createSampleRecommendationsData(sampleDash.student, 0, []);
  assert.equal(coldPayload.is_cold_start, true);
  assert.equal(coldPayload.summary.recommendation_confidence, null);
  assert.equal(coldPayload.because_you_read_anchor, null);
  assert.ok(coldPayload.items.length > 0);
});

test('filterRecommendations refines by category, availability, rating, and excludes not_interested items', () => {
  const sampleDash = createSampleStudentDashboardData();
  const payload = createSampleRecommendationsData(
    sampleDash.student,
    sampleDash.reading_history_count,
    sampleDash.recent_reviews
  );

  const availOnly = filterRecommendations(payload.items, {
    ...DEFAULT_RECOMMENDATION_FILTERS,
    availability: 'available',
    minRating: '4.5',
  });
  assert.ok(availOnly.length > 0);
  assert.ok(availOnly.every((item) => item.is_available && item.rating >= 4.5));

  const reservableOnly = filterRecommendations(payload.items, {
    ...DEFAULT_RECOMMENDATION_FILTERS,
    availability: 'reservable',
  });
  assert.ok(reservableOnly.length >= 1);
  assert.ok(reservableOnly.every((item) => !item.is_available));

  const hiddenAfterFeedback = updateRecommendationFeedback(
    payload.items,
    payload.items[0]!.book_id,
    'not_interested'
  );
  const filteredAfterFeedback = filterRecommendations(
    hiddenAfterFeedback,
    DEFAULT_RECOMMENDATION_FILTERS
  );
  assert.equal(filteredAfterFeedback.length, payload.items.length - 1);
});

test('partitionRecommendationSections avoids already-completed duplicates in primary picks and places them in readAgain', () => {
  const sampleDash = createSampleStudentDashboardData();
  const payload = createSampleRecommendationsData(
    sampleDash.student,
    sampleDash.reading_history_count,
    sampleDash.recent_reviews
  );

  const sections = partitionRecommendationSections(payload.items, 8);
  assert.ok(sections.topPicks.length >= 5 && sections.topPicks.length <= 8);
  assert.ok(sections.topPicks.every((item) => !item.already_completed));
  assert.ok(sections.readAgain.some((item) => item.book_id === 106));
  assert.ok(sections.becauseYouRead.length >= 1);
  assert.ok(sections.basedOnInterests.length >= 1);
  assert.ok(sections.studentsLikeYou.length >= 1);
  assert.ok(sections.availableNow.every((item) => item.is_available));
});

test('buildRecommendationsApiParams and countActiveRecommendationFilters serialize cleanly without studentId authority', () => {
  const filters = {
    ...DEFAULT_RECOMMENDATION_FILTERS,
    category: 'Artificial Intelligence',
    availability: 'available' as const,
    minRating: '4',
  };
  assert.equal(countActiveRecommendationFilters(filters), 3);

  const params = buildRecommendationsApiParams(filters, 10);
  assert.equal(params.get('limit'), '10');
  assert.equal(params.get('category'), 'Artificial Intelligence');
  assert.equal(params.get('availability'), 'available');
  assert.equal(params.get('min_rating'), '4');
  assert.equal(params.get('student_id'), null);
});

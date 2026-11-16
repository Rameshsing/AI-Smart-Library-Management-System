import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationsApiParams,
  computeNotificationsSummary,
  createSampleNotificationsPayload,
  filterAndSortNotifications,
  paginateNotifications,
  toggleReminderTiming,
  updatePreferenceCategoryToggle,
  validateSafeNotificationActionRoute,
} from './notificationsPage';

const FIXED_DATE = new Date('2026-11-13T12:00:00');

describe('notificationsPage utilities', () => {
  it('computes dynamic summary counts from actual notification records', () => {
    const payload = createSampleNotificationsPayload(FIXED_DATE);
    const summary = computeNotificationsSummary(payload.items, FIXED_DATE);

    assert.equal(summary.total_notifications, 9);
    assert.equal(summary.unread, 4);
    assert.equal(summary.important, 5); // 1 Urgent + 4 Important
    assert.equal(summary.recent, 8); // 8 within 7 days, 1 from 10 days ago
  });

  it('computes zero summary counts cleanly for empty list', () => {
    const summary = computeNotificationsSummary([], FIXED_DATE);
    assert.deepEqual(summary, {
      total_notifications: 0,
      unread: 0,
      important: 0,
      recent: 0,
    });
  });

  it('filters by read tab, important tab, category, search query, and sort order', () => {
    const payload = createSampleNotificationsPayload(FIXED_DATE);

    const unreadOnly = filterAndSortNotifications(payload.items, {
      tab: 'unread',
      category: '',
      search: '',
      sort: 'newest',
    });
    assert.equal(unreadOnly.length, 4);
    assert.equal(unreadOnly.every((n) => !n.is_read), true);

    const importantOnly = filterAndSortNotifications(payload.items, {
      tab: 'important',
      category: '',
      search: '',
      sort: 'newest',
    });
    assert.equal(importantOnly.length, 5);

    const reservationFilter = filterAndSortNotifications(payload.items, {
      tab: 'all',
      category: 'Reservations',
      search: 'Automating',
      sort: 'newest',
    });
    assert.equal(reservationFilter.length, 1);
    assert.equal(reservationFilter[0].notification_id, 9102);

    const oldestFirst = filterAndSortNotifications(payload.items, {
      tab: 'all',
      category: '',
      search: '',
      sort: 'oldest',
    });
    assert.equal(oldestFirst[0].notification_id, 9109);
  });

  it('paginates notifications reliably', () => {
    const payload = createSampleNotificationsPayload(FIXED_DATE);
    const page1 = paginateNotifications(payload.items, 1, 6);
    const page2 = paginateNotifications(payload.items, 2, 6);

    assert.equal(page1.items.length, 6);
    assert.equal(page1.totalPages, 2);
    assert.equal(page2.items.length, 3);
    assert.equal(page2.page, 2);
  });

  it('builds API params cleanly without passing student_id', () => {
    const params = buildNotificationsApiParams({
      tab: 'unread',
      category: 'Reservations',
      search: 'pickup',
      sort: 'oldest',
      page: 2,
      limit: 6,
    });

    assert.equal(params.has('student_id'), false);
    assert.equal(params.get('read_status'), 'unread');
    assert.equal(params.get('category'), 'Reservations');
    assert.equal(params.get('q'), 'pickup');
    assert.equal(params.get('sort'), 'oldest');
    assert.equal(params.get('page'), '2');
  });

  it('rejects unsafe external or javascript notification action URLs', () => {
    assert.equal(validateSafeNotificationActionRoute('javascript:alert(1)', null), null);
    assert.equal(validateSafeNotificationActionRoute('https://evil.example.com/phish', null), null);
    assert.equal(validateSafeNotificationActionRoute('//evil.example.com', null), null);

    const safe = validateSafeNotificationActionRoute('/student/reservations', null);
    assert.deepEqual(safe, { name: 'student-reservations' });
  });

  it('prevents disabling mandatory notifications and unsupported email channels', () => {
    const payload = createSampleNotificationsPayload(FIXED_DATE);

    const afterAttemptMandatory = updatePreferenceCategoryToggle(
      payload.preferences,
      'Overdue',
      'in_app_enabled',
      false
    );
    const overduePref = afterAttemptMandatory.categories.find((c) => c.category === 'Overdue');
    assert.equal(overduePref?.in_app_enabled, true);

    const afterAttemptOptional = updatePreferenceCategoryToggle(
      payload.preferences,
      'Recommendations',
      'in_app_enabled',
      false
    );
    const recPref = afterAttemptOptional.categories.find((c) => c.category === 'Recommendations');
    assert.equal(recPref?.in_app_enabled, false);

    const afterAttemptUnsupportedEmail = updatePreferenceCategoryToggle(
      payload.preferences,
      'Reviews & Feedback',
      'email_enabled',
      true
    );
    const reviewPref = afterAttemptUnsupportedEmail.categories.find(
      (c) => c.category === 'Reviews & Feedback'
    );
    assert.equal(reviewPref?.email_enabled, false);
  });

  it('toggles reminder timing options in deterministic chronological order', () => {
    const next = toggleReminderTiming(['2_days_before'], 'on_due_date');
    assert.deepEqual(next, ['2_days_before', 'on_due_date']);
    const removed = toggleReminderTiming(next, '2_days_before');
    assert.deepEqual(removed, ['on_due_date']);
  });
});

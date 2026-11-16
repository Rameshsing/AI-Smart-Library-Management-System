import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardSummary,
  createSampleStudentDashboardData,
  formatDueRemainingLabel,
  getBorrowUrgency,
  getDaysRemaining,
  getEligibleRecommendations,
  getMostUrgentDueBook,
  getTimeGreeting,
  isStudentSectionRoute,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './studentDashboard';

test('getTimeGreeting returns Morning, Afternoon, and Evening accurately', () => {
  assert.equal(getTimeGreeting(8), 'Good Morning');
  assert.equal(getTimeGreeting(14), 'Good Afternoon');
  assert.equal(getTimeGreeting(19), 'Good Evening');
});

test('getDaysRemaining, getBorrowUrgency, and formatDueRemainingLabel compute urgency from due_date', () => {
  const ref = new Date(2026, 10, 13); // 2026-11-13
  assert.equal(getDaysRemaining('2026-11-15', ref), 2);
  assert.equal(getBorrowUrgency(2), 'due-soon');
  assert.equal(formatDueRemainingLabel(2), 'Due in 2 days');

  assert.equal(getDaysRemaining('2026-11-13', ref), 0);
  assert.equal(getBorrowUrgency(0), 'due-soon');
  assert.equal(formatDueRemainingLabel(0), 'Due today');

  assert.equal(getDaysRemaining('2026-11-11', ref), -2);
  assert.equal(getBorrowUrgency(-2), 'overdue');
  assert.equal(formatDueRemainingLabel(-2), 'Overdue by 2 days');

  assert.equal(getDaysRemaining('2026-11-20', ref), 7);
  assert.equal(getBorrowUrgency(7), 'normal');
});

test('computeDashboardSummary and getMostUrgentDueBook derive metrics dynamically from borrowing and reservation records', () => {
  const ref = new Date(2026, 10, 13);
  const sample = createSampleStudentDashboardData(ref);
  const summary = computeDashboardSummary(sample, ref);

  assert.equal(summary.currentlyBorrowedCount, 3);
  assert.equal(summary.dueSoonCount, 1);
  assert.equal(summary.readingHistoryCount, 24);
  assert.equal(summary.activeReservationsCount, 2);
  assert.equal(summary.unreadNotificationsCount, 2);

  const urgent = getMostUrgentDueBook(sample.current_borrowings, ref);
  assert.ok(urgent);
  assert.equal(urgent.daysRemaining, 2);
  assert.equal(urgent.borrowing.book.title, 'Introduction to Machine Learning Systems');

  const noDueSoon = getMostUrgentDueBook(
    sample.current_borrowings.filter((b) => getDaysRemaining(b.due_date, ref) > 3),
    ref
  );
  assert.equal(noDueSoon, null);
});

test('getEligibleRecommendations filters out unavailable books and sorts by recommendation score', () => {
  const sample = createSampleStudentDashboardData(new Date(2026, 10, 13));
  const unavailableBook = {
    ...sample.recommendations[0],
    book_id: 999,
    recommendation_score: 0.99,
    book: {
      ...sample.recommendations[0].book,
      book_id: 999,
      availability: 'Checked Out' as const,
      available_copies: 0,
    },
  };

  const eligible = getEligibleRecommendations([unavailableBook, ...sample.recommendations], 5);
  assert.equal(eligible.length, 5);
  assert.equal(eligible.some((item) => item.book_id === 999), false);
  assert.ok(eligible[0].recommendation_score >= eligible[1].recommendation_score);
});

test('markNotificationAsRead and markAllNotificationsAsRead return updated copies immutably', () => {
  const sample = createSampleStudentDashboardData(new Date(2026, 10, 13));
  const afterOne = markNotificationAsRead(sample.notifications, 901);
  assert.equal(afterOne.filter((n) => !n.is_read).length, 1);
  assert.equal(sample.notifications.filter((n) => !n.is_read).length, 2);

  const afterAll = markAllNotificationsAsRead(sample.notifications);
  assert.equal(afterAll.filter((n) => !n.is_read).length, 0);
});

test('isStudentSectionRoute identifies student workspace routes accurately', () => {
  assert.equal(isStudentSectionRoute('student-dashboard'), true);
  assert.equal(isStudentSectionRoute('student-recommendations'), true);
  assert.equal(isStudentSectionRoute('home'), false);
  assert.equal(isStudentSectionRoute('admin-dashboard'), false);
});

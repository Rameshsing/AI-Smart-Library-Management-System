import { reconcileBookCounts } from './seedData.ts';
import type { DbNotification, LibraryDbState } from './types.ts';

const MS_PER_DAY = 86_400_000;

function toUtcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function getDaysDifferenceFromToday(dueIso: string, now: Date): number {
  const parsed = new Date(dueIso);
  if (Number.isNaN(parsed.getTime())) return 0;
  return Math.round((toUtcDayStart(parsed) - toUtcDayStart(now)) / MS_PER_DAY);
}

function appendNotificationIfNew(
  state: LibraryDbState,
  candidate: Omit<DbNotification, 'notification_id'>
): boolean {
  if (
    candidate.dedupe_key &&
    state.notifications.some(
      (n) => n.user_id === candidate.user_id && n.dedupe_key === candidate.dedupe_key
    )
  ) {
    return false;
  }
  const notificationId = state.nextIds.notification++;
  state.notifications.unshift({
    ...candidate,
    notification_id: notificationId,
  });
  return true;
}

export interface MaintenanceSchedulerSummary {
  overdueUpdatedCount: number;
  dueSoonRemindersSent: number;
  overdueRemindersSent: number;
  expiredReservationsCount: number;
  promotedReservationsCount: number;
  publishedAnnouncementsCount: number;
}

/**
 * Idempotent maintenance pass:
 * 1) Transitions past-due active borrowings to `Overdue`.
 * 2) Generates due-soon & overdue reminders respecting Admin frequency/settings without duplicates.
 * 3) Expires unclaimed pickup holds past `pickup_deadline` and advances queue/releases copy.
 * 4) Publishes any `Scheduled` announcements whose `publish_at` has arrived.
 */
export function runMaintenanceScheduler(
  state: LibraryDbState,
  now: Date = new Date()
): MaintenanceSchedulerSummary {
  const summary: MaintenanceSchedulerSummary = {
    overdueUpdatedCount: 0,
    dueSoonRemindersSent: 0,
    overdueRemindersSent: 0,
    expiredReservationsCount: 0,
    promotedReservationsCount: 0,
    publishedAnnouncementsCount: 0,
  };

  const nowIso = now.toISOString();
  const todayDateStr = nowIso.slice(0, 10);
  const { reminder_policy, reservation_policy } = state.librarySettings;

  // 1 & 2. Overdue detection & deduplicated reminders
  for (const borrowing of state.borrowings) {
    if (borrowing.status === 'Returned') continue;

    const daysRemaining = getDaysDifferenceFromToday(borrowing.due_date, now);
    const book = state.books.find((b) => b.book_id === borrowing.book_id);
    const bookTitle = book?.title ?? `Book #${borrowing.book_id}`;

    if (daysRemaining < 0) {
      if (borrowing.status !== 'Overdue') {
        borrowing.status = 'Overdue';
        borrowing.updated_at = nowIso;
        summary.overdueUpdatedCount += 1;
      }

      const daysOverdue = Math.abs(daysRemaining);
      const freqDays = Math.max(1, reminder_policy.overdue_reminder_frequency_days || 3);
      const lastReminderMs = borrowing.last_reminder_at
        ? new Date(borrowing.last_reminder_at).getTime()
        : 0;
      const hoursSinceLast = lastReminderMs ? (now.getTime() - lastReminderMs) / 3_600_000 : Infinity;

      if (hoursSinceLast >= freqDays * 24 && reminder_policy.in_app_notifications_enabled) {
        const bucketWindow = Math.floor(daysOverdue / freqDays);
        const dedupeKey = `auto-overdue-${borrowing.borrowing_id}-${bucketWindow}`;
        const created = appendNotificationIfNew(state, {
          user_id: borrowing.student_id,
          title: `Overdue Book Reminder (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue)`,
          message: `"${bookTitle}" was due on ${borrowing.due_date}. Please return it to the circulation desk promptly.`,
          category: 'Overdue',
          priority: 'Urgent',
          is_read: false,
          related_entity_type: 'borrowing',
          related_entity_id: borrowing.borrowing_id,
          related_book_id: borrowing.book_id,
          related_book_title: bookTitle,
          action_label: 'View My Books',
          action_url: '/student/my-books',
          created_at: nowIso,
          read_at: null,
          can_delete: true,
          is_mandatory: true,
          announcement_author: null,
          dedupe_key: dedupeKey,
        });
        if (created) {
          borrowing.last_reminder_at = nowIso;
          borrowing.reminder_history.unshift({
            reminder_id: `REM-${borrowing.borrowing_id}-${todayDateStr}`,
            sent_at: nowIso,
            channel: reminder_policy.email_notifications_enabled ? 'In-App + Email' : 'In-App',
            sent_by: 'Automated Reminder Scheduler',
            status: 'Delivered',
          });
          summary.overdueRemindersSent += 1;
        }
      }
    } else if (
      reminder_policy.send_due_date_reminder &&
      reminder_policy.in_app_notifications_enabled &&
      daysRemaining <= reminder_policy.days_before_due_reminder
    ) {
      const dedupeKey = `auto-due-soon-${borrowing.borrowing_id}-${borrowing.due_date}`;
      const created = appendNotificationIfNew(state, {
        user_id: borrowing.student_id,
        title:
          daysRemaining === 0
            ? `Due Today: ${bookTitle}`
            : `Due Soon: ${bookTitle}`,
        message:
          daysRemaining === 0
            ? `Your loan for "${bookTitle}" is due today (${borrowing.due_date}).`
            : `Your loan for "${bookTitle}" is due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${borrowing.due_date}).`,
        category: 'Due Date Reminders',
        priority: daysRemaining === 0 ? 'Important' : 'Normal',
        is_read: false,
        related_entity_type: 'borrowing',
        related_entity_id: borrowing.borrowing_id,
        related_book_id: borrowing.book_id,
        related_book_title: bookTitle,
        action_label: 'View My Books',
        action_url: '/student/my-books',
        created_at: nowIso,
        read_at: null,
        can_delete: true,
        is_mandatory: true,
        announcement_author: null,
        dedupe_key: dedupeKey,
      });
      if (created) {
        summary.dueSoonRemindersSent += 1;
      }
    }
  }

  // 3. Expire unclaimed pickup holds
  const touchedBooks = new Set<number>();
  for (const reservation of state.reservations) {
    if (reservation.status !== 'Ready for Pickup' || !reservation.pickup_deadline) continue;
    const deadlineMs = new Date(reservation.pickup_deadline).getTime();
    if (Number.isNaN(deadlineMs) || now.getTime() <= deadlineMs) continue;

    reservation.status = 'Expired';
    reservation.updated_at = nowIso;
    summary.expiredReservationsCount += 1;
    touchedBooks.add(reservation.book_id);

    const book = state.books.find((b) => b.book_id === reservation.book_id);
    const heldCopyId = reservation.assigned_copy_id;
    reservation.assigned_copy_id = null;

    appendNotificationIfNew(state, {
      user_id: reservation.student_id,
      title: 'Reservation Pickup Window Expired',
      message: `Your hold for "${book?.title ?? `Book #${reservation.book_id}`}" expired after ${reservation_policy.pickup_window_hours} hours.`,
      category: 'Reservations',
      priority: 'Normal',
      is_read: false,
      related_entity_type: 'reservation',
      related_entity_id: reservation.reservation_id,
      related_book_id: reservation.book_id,
      related_book_title: book?.title ?? null,
      action_label: 'View Reservations',
      action_url: '/student/reservations',
      created_at: nowIso,
      read_at: null,
      can_delete: true,
      is_mandatory: false,
      announcement_author: null,
      dedupe_key: `res-expired-${reservation.reservation_id}`,
    });

    if (heldCopyId) {
      const heldCopy = state.copies.find((c) => c.copy_id === heldCopyId);
      if (heldCopy && heldCopy.status === 'Reserved') {
        const nextWaiting =
          reservation_policy.expiry_behavior === 'auto_expire_and_advance_queue'
            ? state.reservations
                .filter((r) => r.book_id === reservation.book_id && r.status === 'Waiting')
                .sort((a, b) => a.reservation_date.localeCompare(b.reservation_date) || a.reservation_id - b.reservation_id)[0]
            : undefined;

        if (nextWaiting) {
          const pickupDeadlineIso = new Date(
            now.getTime() + reservation_policy.pickup_window_hours * 3_600_000
          ).toISOString();
          nextWaiting.status = 'Ready for Pickup';
          nextWaiting.ready_date = nowIso;
          nextWaiting.pickup_deadline = pickupDeadlineIso;
          nextWaiting.assigned_copy_id = heldCopy.copy_id;
          nextWaiting.updated_at = nowIso;
          heldCopy.status = 'Reserved';
          heldCopy.updated_at = nowIso;
          summary.promotedReservationsCount += 1;

          appendNotificationIfNew(state, {
            user_id: nextWaiting.student_id,
            title: 'Reserved Book Ready for Pickup',
            message: `"${book?.title ?? `Book #${nextWaiting.book_id}`}" is now ready for pickup (${heldCopy.accession_number}). Collect within ${reservation_policy.pickup_window_hours} hours.`,
            category: 'Reservations',
            priority: 'Important',
            is_read: false,
            related_entity_type: 'reservation',
            related_entity_id: nextWaiting.reservation_id,
            related_book_id: nextWaiting.book_id,
            related_book_title: book?.title ?? null,
            action_label: 'View Reservations',
            action_url: '/student/reservations',
            created_at: nowIso,
            read_at: null,
            can_delete: true,
            is_mandatory: false,
            announcement_author: null,
            dedupe_key: `res-ready-${nextWaiting.reservation_id}`,
          });
        } else {
          heldCopy.status = 'Available';
          heldCopy.updated_at = nowIso;
        }
      }
    }
  }
  for (const bookId of touchedBooks) {
    reconcileBookCounts(state, bookId);
  }

  // 4. Publish due scheduled announcements cleanly without duplicate notifications
  for (const ann of state.announcements) {
    if (ann.status !== 'Scheduled' || !ann.publish_at) continue;
    const publishMs = new Date(ann.publish_at).getTime();
    if (Number.isNaN(publishMs) || now.getTime() < publishMs) continue;

    ann.status = 'Published';
    ann.updated_at = nowIso;
    summary.publishedAnnouncementsCount += 1;

    if (!ann.notifications_sent) {
      const targetStudents = resolveTargetStudents(state, ann.target_type, ann.target_value);
      let createdCount = 0;
      for (const student of targetStudents) {
        const added = appendNotificationIfNew(state, {
          user_id: student.user_id,
          title: ann.title,
          message: ann.content,
          category: 'Library Announcements',
          priority: ann.priority,
          is_read: false,
          related_entity_type: 'announcement',
          related_entity_id: ann.announcement_id,
          related_book_id: null,
          related_book_title: null,
          action_label: 'View Notifications',
          action_url: '/student/notifications',
          created_at: nowIso,
          read_at: null,
          can_delete: true,
          is_mandatory: false,
          announcement_author: ann.created_by,
          dedupe_key: `announcement-${ann.announcement_id}`,
        });
        if (added) createdCount += 1;
      }
      ann.notifications_sent = true;
      ann.notifications_created = createdCount;
      ann.recipients_count = targetStudents.length;
    }
  }

  return summary;
}

export function resolveTargetStudents(
  state: LibraryDbState,
  targetType: 'all_students' | 'department' | 'course' | 'academic_year',
  targetValue: string | null
) {
  const activeStudents = state.users.filter(
    (u) => u.role === 'student' && u.account_status === 'Active'
  );
  const val = targetValue?.trim().toLowerCase() ?? '';
  switch (targetType) {
    case 'all_students':
      return activeStudents;
    case 'department':
      return activeStudents.filter((s) => (s.department ?? '').toLowerCase() === val);
    case 'course':
      return activeStudents.filter((s) => (s.program ?? '').toLowerCase().includes(val));
    case 'academic_year':
      return activeStudents.filter((s) => (s.academic_year ?? '').toLowerCase() === val);
  }
}

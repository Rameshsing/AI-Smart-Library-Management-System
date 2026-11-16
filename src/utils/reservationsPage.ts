import { SAMPLE_LIBRARY_CATALOG, type CatalogBook } from './bookCatalog';
import { formatDisplayDate } from './bookDetails';
import type { StudentNotification } from './studentDashboard';

export type ReservationStatus =
  | 'Waiting'
  | 'Ready for Pickup'
  | 'Borrowed'
  | 'Completed'
  | 'Cancelled'
  | 'Expired';

export type ReservationTabKey =
  | 'all'
  | 'active'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled_expired';

export type ReservationWorkflowMode = 'librarian_issue' | 'student_borrow';

export interface ReservationRecord {
  reservation_id: number;
  reference_code: string;
  book_id: number;
  slug: string;
  title: string;
  author: string;
  category: string;
  subject: string;
  cover_image: string;
  reservation_date: string;
  status: ReservationStatus;
  queue_position: number | null;
  people_ahead: number | null;
  estimated_availability: string | null;
  ready_date: string | null;
  pickup_deadline: string | null;
  hold_days: number | null;
  fulfilled_date: string | null;
  cancelled_date: string | null;
  expired_date: string | null;
  available_copies: number;
  total_copies: number;
  location_summary: string | null;
  instructions: string | null;
  can_cancel: boolean;
  can_collect_online: boolean;
}

export interface ReservationPolicySummary {
  reservation_limit: number | null;
  active_count: number;
  pickup_hold_days: number | null;
  priority_policy_label: string;
  workflow_mode: ReservationWorkflowMode;
}

export interface ReservationsSummaryCounts {
  active_reservations: number;
  ready_for_pickup: number;
  waiting: number;
  expiring_soon: number;
}

export interface ReservationsPayload {
  is_prototype_sample: boolean;
  items: ReservationRecord[];
  total_count: number;
  filtered_count: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: ReservationsSummaryCounts;
  supported_statuses: ReservationStatus[];
  policy: ReservationPolicySummary;
}

export interface ReservationTabDefinition {
  key: ReservationTabKey;
  label: string;
  statuses: ReservationStatus[];
  count: number;
}

export type ReservationNotificationEvent =
  | 'created'
  | 'ready'
  | 'reminder'
  | 'expiring'
  | 'expired'
  | 'cancelled'
  | 'collected';

export const DEFAULT_RESERVATIONS_PAGE_LIMIT = 6;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function toUtcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addDaysIso(baseDate: Date, offsetDays: number): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatReservationDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  return formatDisplayDate(isoDate);
}

export function getPeopleAhead(queuePosition: number | null): number | null {
  if (queuePosition === null || !Number.isFinite(queuePosition) || queuePosition < 1) {
    return null;
  }
  return Math.max(0, Math.floor(queuePosition) - 1);
}

export function formatPeopleAheadLabel(queuePosition: number | null): string | null {
  const ahead = getPeopleAhead(queuePosition);
  if (ahead === null) return null;
  if (ahead === 0) return 'Next in line (0 students ahead of you)';
  if (ahead === 1) return '1 student ahead of you';
  return `${ahead} students ahead of you`;
}

export function getPickupDaysRemaining(
  pickupDeadlineIso: string | null,
  referenceDate: Date = new Date()
): number | null {
  if (!pickupDeadlineIso) return null;
  const parsed = new Date(`${pickupDeadlineIso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const refUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  return Math.round((toUtcDayStart(parsed) - refUtc) / MS_PER_DAY);
}

export function isReservationExpiringSoon(
  record: Pick<ReservationRecord, 'status' | 'pickup_deadline'>,
  referenceDate: Date = new Date()
): boolean {
  if (record.status !== 'Ready for Pickup') return false;
  const days = getPickupDaysRemaining(record.pickup_deadline, referenceDate);
  if (days === null) return false;
  return days <= 2;
}

export function formatPickupCountdownLabel(
  pickupDeadlineIso: string | null,
  referenceDate: Date = new Date()
): string | null {
  const days = getPickupDaysRemaining(pickupDeadlineIso, referenceDate);
  if (days === null) return null;
  if (days < 0) return 'Pickup window elapsed';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires in 1 day';
  return `Expires in ${days} days`;
}

export function computeReservationsSummary(
  records: ReservationRecord[],
  referenceDate: Date = new Date()
): ReservationsSummaryCounts {
  let activeReservations = 0;
  let readyForPickup = 0;
  let waiting = 0;
  let expiringSoon = 0;

  for (const record of records) {
    if (record.status === 'Waiting') {
      waiting += 1;
      activeReservations += 1;
    } else if (record.status === 'Ready for Pickup') {
      readyForPickup += 1;
      activeReservations += 1;
      if (isReservationExpiringSoon(record, referenceDate)) {
        expiringSoon += 1;
      }
    }
  }

  return {
    active_reservations: activeReservations,
    ready_for_pickup: readyForPickup,
    waiting,
    expiring_soon: expiringSoon,
  };
}

export function getAvailableReservationTabs(
  records: ReservationRecord[],
  supportedStatuses: ReservationStatus[]
): ReservationTabDefinition[] {
  const supported = new Set<ReservationStatus>(supportedStatuses);
  const candidateTabs: Array<Omit<ReservationTabDefinition, 'count'>> = [
    {
      key: 'all',
      label: 'All',
      statuses: ['Waiting', 'Ready for Pickup', 'Borrowed', 'Completed', 'Cancelled', 'Expired'],
    },
    {
      key: 'active',
      label: 'Active',
      statuses: ['Waiting', 'Ready for Pickup'],
    },
    {
      key: 'ready_for_pickup',
      label: 'Ready for Pickup',
      statuses: ['Ready for Pickup'],
    },
    {
      key: 'completed',
      label: 'Completed',
      statuses: ['Completed', 'Borrowed'],
    },
    {
      key: 'cancelled_expired',
      label: 'Cancelled/Expired',
      statuses: ['Cancelled', 'Expired'],
    },
  ];

  return candidateTabs
    .filter(
      (tab) =>
        tab.key === 'all' || tab.statuses.some((status) => supported.has(status))
    )
    .map((tab) => {
      const allowedStatuses = new Set(tab.statuses);
      const count =
        tab.key === 'all'
          ? records.length
          : records.filter((item) => allowedStatuses.has(item.status)).length;
      return {
        ...tab,
        count,
      };
    });
}

export function filterReservations(
  records: ReservationRecord[],
  tab: ReservationTabKey,
  searchQuery: string = ''
): ReservationRecord[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return records.filter((item) => {
    if (tab === 'active') {
      if (item.status !== 'Waiting' && item.status !== 'Ready for Pickup') {
        return false;
      }
    } else if (tab === 'ready_for_pickup') {
      if (item.status !== 'Ready for Pickup') {
        return false;
      }
    } else if (tab === 'completed') {
      if (item.status !== 'Completed' && item.status !== 'Borrowed') {
        return false;
      }
    } else if (tab === 'cancelled_expired') {
      if (item.status !== 'Cancelled' && item.status !== 'Expired') {
        return false;
      }
    }

    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.author,
      item.category,
      item.subject,
      item.reference_code,
      item.status,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function paginateReservations(
  records: ReservationRecord[],
  page: number,
  limit: number = DEFAULT_RESERVATIONS_PAGE_LIMIT
): {
  items: ReservationRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} {
  const safeLimit = Math.max(1, Math.floor(limit));
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const startIndex = (safePage - 1) * safeLimit;
  return {
    items: records.slice(startIndex, startIndex + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

export function buildReservationsApiParams(
  tab: ReservationTabKey,
  searchQuery: string,
  page: number,
  limit: number = DEFAULT_RESERVATIONS_PAGE_LIMIT
): URLSearchParams {
  const params = new URLSearchParams();
  if (tab !== 'all') {
    params.set('status_group', tab);
  }
  const trimmed = searchQuery.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  params.set('page', String(Math.max(1, Math.floor(page))));
  params.set('limit', String(Math.max(1, Math.floor(limit))));
  return params;
}

export function createReservationEventNotification(
  existing: StudentNotification[],
  studentId: number,
  eventType: ReservationNotificationEvent,
  bookTitle: string,
  dateIso: string
): StudentNotification[] {
  let message: string;
  switch (eventType) {
    case 'created':
      message = `Reservation confirmed for "${bookTitle}". You will be notified when a copy is ready.`;
      break;
    case 'ready':
      message = `Your reserved copy of "${bookTitle}" is now available for pickup at the library desk.`;
      break;
    case 'reminder':
      message = `Pickup reminder: collect your reserved copy of "${bookTitle}" before the hold deadline.`;
      break;
    case 'expiring':
      message = `Hold expiring soon: pick up "${bookTitle}" before your reservation expires.`;
      break;
    case 'expired':
      message = `Reservation expired for "${bookTitle}" because the pickup deadline passed.`;
      break;
    case 'collected':
      message = `Reserved copy of "${bookTitle}" was collected and checked out to your account.`;
      break;
    case 'cancelled':
      message = `Your reservation for "${bookTitle}" has been cancelled.`;
      break;
  }

  const alreadyExists = existing.some(
    (item) => item.student_id === studentId && item.message === message
  );
  if (alreadyExists) {
    return existing;
  }

  const nextId =
    existing.reduce((maxId, item) => Math.max(maxId, item.notification_id), 0) + 1;

  const newNotification: StudentNotification = {
    notification_id: nextId,
    student_id: studentId,
    type: 'reservation_ready',
    message,
    created_at: dateIso,
    relative_time: 'Just now',
    is_read: false,
  };

  return [newNotification, ...existing];
}

function getCatalogBookOrThrow(bookId: number): CatalogBook {
  const found = SAMPLE_LIBRARY_CATALOG.find((book) => book.book_id === bookId);
  if (found) return found;
  return SAMPLE_LIBRARY_CATALOG[0];
}

export function createSampleReservationsPayload(
  referenceDate: Date = new Date()
): ReservationsPayload {
  const readySoonBook = getCatalogBookOrThrow(104); // Automating with Python: Practical Lab Workflows
  const waitingFlaskBook = getCatalogBookOrThrow(111); // Building Scalable Web APIs with Python Flask & MySQL
  const readyHistoryBook = getCatalogBookOrThrow(121); // World History of Ideas & Scientific Revolutions
  const waitingPsychBook = getCatalogBookOrThrow(117); // Understanding Mind: An Exploration of Academic Psychology
  const completedAlgoBook = getCatalogBookOrThrow(106); // Algorithms & Data Structures: Computational Thinking
  const cancelledDeepBook = getCatalogBookOrThrow(109); // Neural Networks & Deep Learning Principles
  const expiredSecBook = getCatalogBookOrThrow(114); // Cybersecurity & Applied Cryptographic Defense

  const items: ReservationRecord[] = [
    {
      reservation_id: 501,
      reference_code: 'RSV-2026-0501',
      book_id: readySoonBook.book_id,
      slug: readySoonBook.slug,
      title: readySoonBook.title,
      author: readySoonBook.author,
      category: readySoonBook.category,
      subject: readySoonBook.subject,
      cover_image: readySoonBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -5),
      status: 'Ready for Pickup',
      queue_position: null,
      people_ahead: null,
      estimated_availability: null,
      ready_date: addDaysIso(referenceDate, -2),
      pickup_deadline: addDaysIso(referenceDate, 1),
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: null,
      expired_date: null,
      available_copies: 1,
      total_copies: readySoonBook.total_copies,
      location_summary: 'Main Library · Floor 2 Hold Shelf B-04',
      instructions:
        'Present your Student ID card at the Circulation Desk before the pickup deadline to issue this reserved copy.',
      can_cancel: true,
      can_collect_online: false,
    },
    {
      reservation_id: 502,
      reference_code: 'RSV-2026-0502',
      book_id: waitingFlaskBook.book_id,
      slug: waitingFlaskBook.slug,
      title: waitingFlaskBook.title,
      author: waitingFlaskBook.author,
      category: waitingFlaskBook.category,
      subject: waitingFlaskBook.subject,
      cover_image: waitingFlaskBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -3),
      status: 'Waiting',
      queue_position: 2,
      people_ahead: 1,
      estimated_availability: 'Estimated return window around ' + formatDisplayDate(addDaysIso(referenceDate, 4)),
      ready_date: null,
      pickup_deadline: null,
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: null,
      expired_date: null,
      available_copies: waitingFlaskBook.available_copies,
      total_copies: waitingFlaskBook.total_copies,
      location_summary: 'Main Library · Computer Science Wing, Shelf CS-18',
      instructions:
        'You will receive a pickup notification automatically as soon as the current borrower returns a copy.',
      can_cancel: true,
      can_collect_online: false,
    },
    {
      reservation_id: 503,
      reference_code: 'RSV-2026-0503',
      book_id: readyHistoryBook.book_id,
      slug: readyHistoryBook.slug,
      title: readyHistoryBook.title,
      author: readyHistoryBook.author,
      category: readyHistoryBook.category,
      subject: readyHistoryBook.subject,
      cover_image: readyHistoryBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -4),
      status: 'Ready for Pickup',
      queue_position: null,
      people_ahead: null,
      estimated_availability: null,
      ready_date: addDaysIso(referenceDate, 0),
      pickup_deadline: addDaysIso(referenceDate, 3),
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: null,
      expired_date: null,
      available_copies: 1,
      total_copies: readyHistoryBook.total_copies,
      location_summary: 'Central Reference Desk · Hold Locker H-11',
      instructions:
        'Visit the Central Reference Desk with your Student ID to complete checkout within the 3-day hold window.',
      can_cancel: true,
      can_collect_online: false,
    },
    {
      reservation_id: 504,
      reference_code: 'RSV-2026-0504',
      book_id: waitingPsychBook.book_id,
      slug: waitingPsychBook.slug,
      title: waitingPsychBook.title,
      author: waitingPsychBook.author,
      category: waitingPsychBook.category,
      subject: waitingPsychBook.subject,
      cover_image: waitingPsychBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -1),
      status: 'Waiting',
      queue_position: 1,
      people_ahead: 0,
      estimated_availability: null,
      ready_date: null,
      pickup_deadline: null,
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: null,
      expired_date: null,
      available_copies: waitingPsychBook.available_copies,
      total_copies: waitingPsychBook.total_copies,
      location_summary: 'Main Library · Humanities Wing, Shelf HU-09',
      instructions:
        'You are next in the reservation queue. A notification will be sent when a copy becomes available.',
      can_cancel: true,
      can_collect_online: false,
    },
    {
      reservation_id: 505,
      reference_code: 'RSV-2026-0505',
      book_id: completedAlgoBook.book_id,
      slug: completedAlgoBook.slug,
      title: completedAlgoBook.title,
      author: completedAlgoBook.author,
      category: completedAlgoBook.category,
      subject: completedAlgoBook.subject,
      cover_image: completedAlgoBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -24),
      status: 'Completed',
      queue_position: null,
      people_ahead: null,
      estimated_availability: null,
      ready_date: addDaysIso(referenceDate, -20),
      pickup_deadline: addDaysIso(referenceDate, -17),
      hold_days: 3,
      fulfilled_date: addDaysIso(referenceDate, -19),
      cancelled_date: null,
      expired_date: null,
      available_copies: completedAlgoBook.available_copies,
      total_copies: completedAlgoBook.total_copies,
      location_summary: 'Main Library · Computer Science Wing, Shelf CS-04',
      instructions: 'This reservation was fulfilled and issued to your student borrowing record.',
      can_cancel: false,
      can_collect_online: false,
    },
    {
      reservation_id: 506,
      reference_code: 'RSV-2026-0506',
      book_id: cancelledDeepBook.book_id,
      slug: cancelledDeepBook.slug,
      title: cancelledDeepBook.title,
      author: cancelledDeepBook.author,
      category: cancelledDeepBook.category,
      subject: cancelledDeepBook.subject,
      cover_image: cancelledDeepBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -31),
      status: 'Cancelled',
      queue_position: null,
      people_ahead: null,
      estimated_availability: null,
      ready_date: null,
      pickup_deadline: null,
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: addDaysIso(referenceDate, -29),
      expired_date: null,
      available_copies: cancelledDeepBook.available_copies,
      total_copies: cancelledDeepBook.total_copies,
      location_summary: 'Main Library · AI & Data Science Shelf DS-02',
      instructions: 'Reservation was cancelled before a copy became ready for pickup.',
      can_cancel: false,
      can_collect_online: false,
    },
    {
      reservation_id: 507,
      reference_code: 'RSV-2026-0507',
      book_id: expiredSecBook.book_id,
      slug: expiredSecBook.slug,
      title: expiredSecBook.title,
      author: expiredSecBook.author,
      category: expiredSecBook.category,
      subject: expiredSecBook.subject,
      cover_image: expiredSecBook.cover_image,
      reservation_date: addDaysIso(referenceDate, -42),
      status: 'Expired',
      queue_position: null,
      people_ahead: null,
      estimated_availability: null,
      ready_date: addDaysIso(referenceDate, -38),
      pickup_deadline: addDaysIso(referenceDate, -35),
      hold_days: 3,
      fulfilled_date: null,
      cancelled_date: null,
      expired_date: addDaysIso(referenceDate, -35),
      available_copies: expiredSecBook.available_copies,
      total_copies: expiredSecBook.total_copies,
      location_summary: 'Main Library · Systems & Security Shelf CS-22',
      instructions:
        'The pickup hold period ended before collection. You may reserve this book again if copies are unavailable.',
      can_cancel: false,
      can_collect_online: false,
    },
  ];

  const summary = computeReservationsSummary(items, referenceDate);
  const pagination = paginateReservations(items, 1, DEFAULT_RESERVATIONS_PAGE_LIMIT);

  return {
    is_prototype_sample: true,
    items,
    total_count: items.length,
    filtered_count: items.length,
    page: pagination.page,
    limit: pagination.limit,
    total_pages: pagination.totalPages,
    summary,
    supported_statuses: [
      'Waiting',
      'Ready for Pickup',
      'Completed',
      'Cancelled',
      'Expired',
    ],
    policy: {
      reservation_limit: 5,
      active_count: summary.active_reservations,
      pickup_hold_days: 3,
      priority_policy_label: 'First-come, first-served queue order',
      workflow_mode: 'librarian_issue',
    },
  };
}

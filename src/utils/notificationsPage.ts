import type { AppRoute } from '../data/libraryData';
import { SAMPLE_LIBRARY_CATALOG } from './bookCatalog';
import { parseRouteFromPathname } from './catalogSearch';

export type NotificationCategory =
  | 'Borrowing'
  | 'Due Date Reminders'
  | 'Overdue'
  | 'Reservations'
  | 'Recommendations'
  | 'Reviews & Feedback'
  | 'Library Announcements'
  | 'Account & Security';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'Borrowing',
  'Due Date Reminders',
  'Overdue',
  'Reservations',
  'Recommendations',
  'Reviews & Feedback',
  'Library Announcements',
  'Account & Security',
];

export type NotificationPriority = 'Normal' | 'Important' | 'Urgent';

export type NotificationFilterTab = 'all' | 'unread' | 'read' | 'important';

export type NotificationSortOption = 'newest' | 'oldest';

export type NotificationRelatedEntityType =
  | 'book'
  | 'borrowing'
  | 'reservation'
  | 'recommendation'
  | 'review'
  | 'announcement'
  | 'account'
  | null;

export interface NotificationItem {
  notification_id: number;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  is_read: boolean;
  related_entity_type: NotificationRelatedEntityType;
  related_entity_id: number | null;
  related_book_id: number | null;
  related_book_title: string | null;
  action_label: string | null;
  action_route: AppRoute | null;
  action_url: string | null;
  created_at: string;
  read_at: string | null;
  can_delete: boolean;
  is_mandatory: boolean;
  announcement_author?: string | null;
}

export type ReminderTimingOption = '2_days_before' | '1_day_before' | 'on_due_date';

export interface NotificationCategoryPreference {
  category: NotificationCategory;
  in_app_enabled: boolean;
  email_enabled: boolean;
  is_mandatory: boolean;
  mandatory_reason: string | null;
  email_supported: boolean;
}

export interface NotificationPreferencesPayload {
  categories: NotificationCategoryPreference[];
  reminder_timings: ReminderTimingOption[];
  allow_reminder_customization: boolean;
  email_delivery_configured: boolean;
  configured_loan_period_days: number | null;
}

export interface NotificationsSummaryCounts {
  total_notifications: number;
  unread: number;
  important: number;
  recent: number;
}

export interface NotificationsPayload {
  is_prototype_sample: boolean;
  items: NotificationItem[];
  total_count: number;
  filtered_count: number;
  unread_count: number;
  page: number;
  limit: number;
  total_pages: number;
  summary: NotificationsSummaryCounts;
  allow_delete: boolean;
  preferences: NotificationPreferencesPayload;
}

export interface NotificationFilterOptions {
  tab: NotificationFilterTab;
  category: NotificationCategory | '';
  search: string;
  sort: NotificationSortOption;
}

export const DEFAULT_NOTIFICATIONS_PAGE_LIMIT = 6;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const MONTH_SHORT = [
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

function formatDateOffsetIso(baseDate: Date, offsetDays: number, hour: number, minute: number): string {
  const target = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays,
    hour,
    minute,
    0,
    0
  );
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}:00`;
}

export function formatNotificationDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  const day = parsed.getDate();
  const month = MONTH_SHORT[parsed.getMonth()] ?? '';
  const year = parsed.getFullYear();
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  if (isoString.includes('T')) {
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  }
  return `${day} ${month} ${year}`;
}

export function validateSafeNotificationActionRoute(
  actionUrl: string | null | undefined,
  fallbackRoute: AppRoute | null = null
): AppRoute | null {
  if (actionUrl) {
    const trimmed = actionUrl.trim();
    // Reject protocol-relative URLs, external domains, or script schemes
    if (
      trimmed.startsWith('//') ||
      /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ||
      !trimmed.startsWith('/')
    ) {
      return fallbackRoute;
    }

    const pathnameOnly = trimmed.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
    const allowedExactOrPrefix =
      pathnameOnly === '/' ||
      pathnameOnly === '/books' ||
      pathnameOnly.startsWith('/books/') ||
      pathnameOnly === '/student-dashboard' ||
      pathnameOnly.startsWith('/student/') ||
      pathnameOnly === '/recommendations' ||
      pathnameOnly === '/contact';

    if (!allowedExactOrPrefix) {
      return fallbackRoute;
    }

    return parseRouteFromPathname(pathnameOnly);
  }
  return fallbackRoute;
}

export function computeNotificationsSummary(
  items: NotificationItem[],
  referenceDate: Date = new Date()
): NotificationsSummaryCounts {
  const refTime = referenceDate.getTime();
  let unread = 0;
  let important = 0;
  let recent = 0;

  for (const item of items) {
    if (!item.is_read) {
      unread += 1;
    }
    if (item.priority === 'Important' || item.priority === 'Urgent') {
      important += 1;
    }
    const createdMs = new Date(item.created_at).getTime();
    if (!Number.isNaN(createdMs)) {
      const ageDays = (refTime - createdMs) / MS_PER_DAY;
      if (ageDays <= 7 && ageDays >= -1) {
        recent += 1;
      }
    }
  }

  return {
    total_notifications: items.length,
    unread,
    important,
    recent,
  };
}

export function filterAndSortNotifications(
  items: NotificationItem[],
  filters: NotificationFilterOptions
): NotificationItem[] {
  const normalizedQuery = filters.search.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.tab === 'unread' && item.is_read) return false;
    if (filters.tab === 'read' && !item.is_read) return false;
    if (
      filters.tab === 'important' &&
      item.priority !== 'Important' &&
      item.priority !== 'Urgent'
    ) {
      return false;
    }

    if (filters.category && item.category !== filters.category) {
      return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.message,
      item.category,
      item.priority,
      item.related_book_title ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  return [...filtered].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    const safeA = Number.isNaN(aTime) ? 0 : aTime;
    const safeB = Number.isNaN(bTime) ? 0 : bTime;
    return filters.sort === 'oldest' ? safeA - safeB : safeB - safeA;
  });
}

export function paginateNotifications(
  items: NotificationItem[],
  page: number,
  limit: number = DEFAULT_NOTIFICATIONS_PAGE_LIMIT
): {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} {
  const safeLimit = Math.max(1, Math.floor(limit));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * safeLimit;

  return {
    items: items.slice(start, start + safeLimit),
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  };
}

export function buildNotificationsApiParams(
  filters: NotificationFilterOptions & { page: number; limit: number }
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.tab === 'unread' || filters.tab === 'read') {
    params.set('read_status', filters.tab);
  } else if (filters.tab === 'important') {
    params.set('priority_group', 'important');
  }

  if (filters.category) {
    params.set('category', filters.category);
  }

  const trimmed = filters.search.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }

  params.set('sort', filters.sort);
  params.set('page', String(Math.max(1, Math.floor(filters.page))));
  params.set('limit', String(Math.max(1, Math.floor(filters.limit))));

  return params;
}

export function updatePreferenceCategoryToggle(
  preferences: NotificationPreferencesPayload,
  category: NotificationCategory,
  channel: 'in_app_enabled' | 'email_enabled',
  nextValue: boolean
): NotificationPreferencesPayload {
  return {
    ...preferences,
    categories: preferences.categories.map((pref) => {
      if (pref.category !== category) return pref;
      if (pref.is_mandatory && channel === 'in_app_enabled' && !nextValue) {
        return pref;
      }
      if (channel === 'email_enabled' && !pref.email_supported) {
        return pref;
      }
      return {
        ...pref,
        [channel]: nextValue,
      };
    }),
  };
}

export function toggleReminderTiming(
  current: ReminderTimingOption[],
  option: ReminderTimingOption
): ReminderTimingOption[] {
  const exists = current.includes(option);
  if (exists) {
    return current.filter((item) => item !== option);
  }
  const order: ReminderTimingOption[] = ['2_days_before', '1_day_before', 'on_due_date'];
  return order.filter((item) => item === option || current.includes(item));
}

function getCatalogTitle(bookId: number, fallbackTitle: string): { id: number; title: string } {
  const found = SAMPLE_LIBRARY_CATALOG.find((book) => book.book_id === bookId);
  return found ? { id: found.book_id, title: found.title } : { id: bookId, title: fallbackTitle };
}

export function createSampleNotificationsPayload(
  referenceDate: Date = new Date()
): NotificationsPayload {
  const dueBook = getCatalogTitle(101, 'Python Programming: Foundations & Modern Practice');
  const overdueBook = getCatalogTitle(112, 'Relational Database Systems & SQL Query Optimization');
  const readyBook = getCatalogTitle(104, 'Automating with Python: Practical Lab Workflows');
  const expiringBook = getCatalogTitle(121, 'World History of Ideas & Scientific Revolutions');
  const issuedBook = getCatalogTitle(106, 'Algorithms & Data Structures: Computational Thinking');
  const reviewBook = getCatalogTitle(102, 'Python for Data Analysis & Pandas Workflows');
  const recBook = getCatalogTitle(126, 'Applied Natural Language Processing with Python');

  const items: NotificationItem[] = [
    {
      notification_id: 9101,
      title: 'Book overdue',
      message: `Your borrowed book "${overdueBook.title}" has passed its due date. Please contact the library desk or return it as soon as possible to avoid additional late holds.`,
      category: 'Overdue',
      priority: 'Urgent',
      is_read: false,
      related_entity_type: 'borrowing',
      related_entity_id: 504,
      related_book_id: overdueBook.id,
      related_book_title: overdueBook.title,
      action_label: 'View My Books',
      action_route: { name: 'student-my-books' },
      action_url: '/student/my-books',
      created_at: formatDateOffsetIso(referenceDate, 0, 9, 15),
      read_at: null,
      can_delete: false,
      is_mandatory: true,
    },
    {
      notification_id: 9102,
      title: 'Your reserved book is ready',
      message: `"${readyBook.title}" is now available for pickup at Main Library · Floor 2 Hold Shelf B-04.`,
      category: 'Reservations',
      priority: 'Important',
      is_read: false,
      related_entity_type: 'reservation',
      related_entity_id: 501,
      related_book_id: readyBook.id,
      related_book_title: readyBook.title,
      action_label: 'View Reservation',
      action_route: { name: 'student-reservations' },
      action_url: '/student/reservations',
      created_at: formatDateOffsetIso(referenceDate, 0, 8, 30),
      read_at: null,
      can_delete: false,
      is_mandatory: false,
    },
    {
      notification_id: 9103,
      title: 'Your book is due soon',
      message: `"${dueBook.title}" is due in 2 days. Please return it on time or check whether renewal is available.`,
      category: 'Due Date Reminders',
      priority: 'Important',
      is_read: false,
      related_entity_type: 'borrowing',
      related_entity_id: 501,
      related_book_id: dueBook.id,
      related_book_title: dueBook.title,
      action_label: 'View My Books',
      action_route: { name: 'student-my-books' },
      action_url: '/student/my-books',
      created_at: formatDateOffsetIso(referenceDate, -1, 16, 40),
      read_at: null,
      can_delete: false,
      is_mandatory: true,
    },
    {
      notification_id: 9104,
      title: 'Pickup deadline approaching',
      message: `Please collect your reserved copy of "${expiringBook.title}" from the Central Reference Desk before the hold window expires.`,
      category: 'Reservations',
      priority: 'Important',
      is_read: false,
      related_entity_type: 'reservation',
      related_entity_id: 503,
      related_book_id: expiringBook.id,
      related_book_title: expiringBook.title,
      action_label: 'View Reservation',
      action_route: { name: 'student-reservations' },
      action_url: '/student/reservations',
      created_at: formatDateOffsetIso(referenceDate, -1, 11, 20),
      read_at: null,
      can_delete: false,
      is_mandatory: false,
    },
    {
      notification_id: 9105,
      title: 'Library announcement: Extended Exam Week Hours',
      message:
        'Main Library Reading Halls and Circulation Desks will remain open from 07:30 to 23:00 throughout upcoming semester assessments. Overnight book drop boxes remain accessible 24/7.',
      category: 'Library Announcements',
      priority: 'Important',
      is_read: true,
      related_entity_type: 'announcement',
      related_entity_id: 34,
      related_book_id: null,
      related_book_title: null,
      action_label: 'View Announcement',
      action_route: null,
      action_url: null,
      created_at: formatDateOffsetIso(referenceDate, -2, 14, 10),
      read_at: formatDateOffsetIso(referenceDate, -2, 15, 5),
      can_delete: false,
      is_mandatory: true,
      announcement_author: 'Chief Librarian Office',
    },
    {
      notification_id: 9106,
      title: 'New books recommended for you',
      message: `We found new titles matching your Artificial Intelligence and Python coursework interests, including "${recBook.title}".`,
      category: 'Recommendations',
      priority: 'Normal',
      is_read: true,
      related_entity_type: 'recommendation',
      related_entity_id: recBook.id,
      related_book_id: recBook.id,
      related_book_title: recBook.title,
      action_label: 'View Recommendations',
      action_route: { name: 'student-recommendations' },
      action_url: '/student/recommendations',
      created_at: formatDateOffsetIso(referenceDate, -3, 10, 0),
      read_at: formatDateOffsetIso(referenceDate, -3, 12, 15),
      can_delete: true,
      is_mandatory: false,
    },
    {
      notification_id: 9107,
      title: 'Book issued successfully',
      message: `Your borrowing transaction for "${issuedBook.title}" has been completed and recorded under your active loans.`,
      category: 'Borrowing',
      priority: 'Normal',
      is_read: true,
      related_entity_type: 'borrowing',
      related_entity_id: 498,
      related_book_id: issuedBook.id,
      related_book_title: issuedBook.title,
      action_label: 'View My Books',
      action_route: { name: 'student-my-books' },
      action_url: '/student/my-books',
      created_at: formatDateOffsetIso(referenceDate, -5, 13, 45),
      read_at: formatDateOffsetIso(referenceDate, -5, 14, 0),
      can_delete: true,
      is_mandatory: false,
    },
    {
      notification_id: 9108,
      title: 'Share feedback on your returned book',
      message: `You recently returned "${reviewBook.title}". Rating completed books helps improve your personalized recommendations.`,
      category: 'Reviews & Feedback',
      priority: 'Normal',
      is_read: true,
      related_entity_type: 'review',
      related_entity_id: reviewBook.id,
      related_book_id: reviewBook.id,
      related_book_title: reviewBook.title,
      action_label: 'View Book',
      action_route: { name: 'book-detail', slug: String(reviewBook.id) },
      action_url: `/books/${reviewBook.id}`,
      created_at: formatDateOffsetIso(referenceDate, -6, 17, 10),
      read_at: formatDateOffsetIso(referenceDate, -6, 18, 0),
      can_delete: true,
      is_mandatory: false,
    },
    {
      notification_id: 9109,
      title: 'Reading preferences updated',
      message:
        'Your preferred subjects and reading interests were saved. Recommendation rankings will reflect these topics automatically.',
      category: 'Account & Security',
      priority: 'Normal',
      is_read: true,
      related_entity_type: 'account',
      related_entity_id: null,
      related_book_id: null,
      related_book_title: null,
      action_label: 'View Profile',
      action_route: { name: 'student-profile' },
      action_url: '/student/profile',
      created_at: formatDateOffsetIso(referenceDate, -10, 9, 50),
      read_at: formatDateOffsetIso(referenceDate, -10, 10, 5),
      can_delete: false,
      is_mandatory: true,
    },
  ];

  const summary = computeNotificationsSummary(items, referenceDate);
  const pagination = paginateNotifications(items, 1, DEFAULT_NOTIFICATIONS_PAGE_LIMIT);

  return {
    is_prototype_sample: true,
    items,
    total_count: items.length,
    filtered_count: items.length,
    unread_count: summary.unread,
    page: pagination.page,
    limit: pagination.limit,
    total_pages: pagination.totalPages,
    summary,
    allow_delete: false,
    preferences: {
      categories: [
        {
          category: 'Borrowing',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: false,
          mandatory_reason: null,
          email_supported: true,
        },
        {
          category: 'Due Date Reminders',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: true,
          mandatory_reason: 'Required by library lending policy to avoid overdue holds',
          email_supported: true,
        },
        {
          category: 'Overdue',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: true,
          mandatory_reason: 'Mandatory account & overdue compliance alert',
          email_supported: true,
        },
        {
          category: 'Reservations',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: false,
          mandatory_reason: null,
          email_supported: true,
        },
        {
          category: 'Recommendations',
          in_app_enabled: true,
          email_enabled: false,
          is_mandatory: false,
          mandatory_reason: null,
          email_supported: true,
        },
        {
          category: 'Reviews & Feedback',
          in_app_enabled: true,
          email_enabled: false,
          is_mandatory: false,
          mandatory_reason: null,
          email_supported: false,
        },
        {
          category: 'Library Announcements',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: true,
          mandatory_reason: 'Official library schedule and closure notices cannot be muted',
          email_supported: true,
        },
        {
          category: 'Account & Security',
          in_app_enabled: true,
          email_enabled: true,
          is_mandatory: true,
          mandatory_reason: 'Mandatory account security notices',
          email_supported: true,
        },
      ],
      reminder_timings: ['2_days_before', '1_day_before'],
      allow_reminder_customization: true,
      email_delivery_configured: false,
      configured_loan_period_days: 14,
    },
  };
}

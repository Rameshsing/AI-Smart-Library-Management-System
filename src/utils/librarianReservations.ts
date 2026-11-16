import { DEMO_BOOKS } from '../data/libraryData';
import {
  createSampleCirculationStore,
  type CirculationStudentStatus,
} from './librarianCirculation';
import {
  createSampleLibrarianDashboardBundles,
  type LibrarianReservationStatus,
} from './librarianDashboard';
import {
  createSampleInventoryStore,
  type CopyStatus,
  type InventoryPhysicalCopy,
} from './librarianInventory';

export type ManagedReservationStatus =
  | 'Waiting'
  | 'Ready for Pickup'
  | 'Completed'
  | 'Cancelled'
  | 'Expired';

export type ReservationFilterTab =
  | 'all'
  | 'active'
  | 'waiting'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type ReservationPickupFilter = 'all' | 'expiring_soon' | 'ready' | 'expired';

export interface LibrarianReservationItem {
  reservation_id: number;
  reservation_code: string;
  student_id: number;
  student_name: string;
  student_code: string;
  student_department: string;
  student_email: string;
  student_account_status: CirculationStudentStatus;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_author: string;
  book_isbn: string;
  book_cover: string;
  category: string;
  subject: string;
  branch: string;
  reservation_date: string;
  queue_position: number | null;
  queue_total: number | null;
  status: ManagedReservationStatus;
  ready_date: string | null;
  pickup_deadline: string | null;
  assigned_copy_id: number | null;
  assigned_copy_accession: string | null;
  assigned_copy_status: CopyStatus | null;
  notes: string | null;
}

export interface ReservationPolicyConfig {
  pickup_window_hours: number;
  expiring_warning_hours: number;
  supports_notifications: boolean;
  server_reference_iso: string;
}

export interface ReservationSupportedFilters {
  date_range: boolean;
  category: boolean;
  subject: boolean;
  branch: boolean;
  student_department: boolean;
  pickup_status: boolean;
}

export interface ReservationSupportedActions {
  can_mark_ready: boolean;
  can_cancel: boolean;
  can_extend_deadline: boolean;
}

export interface ReservationSummaryCounts {
  activeReservations: number;
  waiting: number;
  readyForPickup: number;
  expiringSoon: number;
  expired: number;
}

export interface ReservationFilterCriteria {
  tab: ReservationFilterTab;
  query: string;
  category: string;
  subject: string;
  branch: string;
  department: string;
  pickupStatus: ReservationPickupFilter;
  dateFrom: string;
  dateTo: string;
}

export const RESERVATION_TABS: Array<{ id: ReservationFilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'ready_for_pickup', label: 'Ready for Pickup' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'expired', label: 'Expired' },
];

export function normalizeBackendReservationStatus(
  rawStatus: LibrarianReservationStatus | ManagedReservationStatus | string
): ManagedReservationStatus {
  const s = rawStatus.trim().toLowerCase();
  if (s === 'waiting') return 'Waiting';
  if (s === 'ready for pickup' || s === 'expiring soon') return 'Ready for Pickup';
  if (s === 'completed' || s === 'fulfilled') return 'Completed';
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'expired') return 'Expired';
  return 'Waiting';
}

export function isReservationExpiringSoon(
  item: Pick<LibrarianReservationItem, 'status' | 'pickup_deadline'>,
  policy: Pick<ReservationPolicyConfig, 'expiring_warning_hours'>,
  referenceDate: Date
): boolean {
  if (item.status !== 'Ready for Pickup' || !item.pickup_deadline) {
    return false;
  }
  const deadline = new Date(item.pickup_deadline);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }
  const diffMs = deadline.getTime() - referenceDate.getTime();
  const warningWindowMs = Math.max(1, policy.expiring_warning_hours) * 3_600_000;
  return diffMs > 0 && diffMs <= warningWindowMs;
}

export function isReservationPickupLapsed(
  item: Pick<LibrarianReservationItem, 'status' | 'pickup_deadline'>,
  referenceDate: Date
): boolean {
  if (item.status === 'Expired') return true;
  if (item.status !== 'Ready for Pickup' || !item.pickup_deadline) {
    return false;
  }
  const deadline = new Date(item.pickup_deadline);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }
  return deadline.getTime() <= referenceDate.getTime();
}

export function formatPickupDeadlineStatus(
  pickupDeadlineIso: string | null,
  policy: Pick<ReservationPolicyConfig, 'pickup_window_hours' | 'expiring_warning_hours'>,
  referenceDate: Date
): {
  label: string;
  isExpiringSoon: boolean;
  isPastDeadline: boolean;
} {
  if (!pickupDeadlineIso) {
    return {
      label: '—',
      isExpiringSoon: false,
      isPastDeadline: false,
    };
  }
  const deadline = new Date(pickupDeadlineIso);
  if (Number.isNaN(deadline.getTime())) {
    return {
      label: pickupDeadlineIso,
      isExpiringSoon: false,
      isPastDeadline: false,
    };
  }

  const diffMs = deadline.getTime() - referenceDate.getTime();
  if (diffMs <= 0) {
    return {
      label: 'Pickup deadline passed',
      isExpiringSoon: false,
      isPastDeadline: true,
    };
  }

  const diffHours = Math.ceil(diffMs / 3_600_000);
  const expiring = diffMs <= Math.max(1, policy.expiring_warning_hours) * 3_600_000;

  if (diffHours < 24) {
    return {
      label: `Expires in ${diffHours} hour${diffHours === 1 ? '' : 's'}`,
      isExpiringSoon: expiring,
      isPastDeadline: false,
    };
  }

  const diffDays = Math.ceil(diffHours / 24);
  return {
    label: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
    isExpiringSoon: expiring,
    isPastDeadline: false,
  };
}

export function computePeopleAhead(queuePosition: number | null): number | null {
  if (typeof queuePosition !== 'number' || !Number.isFinite(queuePosition) || queuePosition < 1) {
    return null;
  }
  return Math.max(0, Math.floor(queuePosition) - 1);
}

export function formatQueuePositionLabel(
  queuePosition: number | null,
  queueTotal: number | null
): {
  primary: string;
  aheadText: string | null;
} {
  if (typeof queuePosition !== 'number' || queuePosition < 1) {
    return { primary: '—', aheadText: null };
  }
  const primary =
    typeof queueTotal === 'number' && queueTotal >= queuePosition
      ? `Position ${queuePosition} of ${queueTotal}`
      : `Position #${queuePosition}`;
  const ahead = computePeopleAhead(queuePosition);
  const aheadText =
    ahead === null
      ? null
      : ahead === 0
        ? 'Next in queue'
        : `${ahead} student${ahead === 1 ? '' : 's'} ahead`;
  return { primary, aheadText };
}

export function computeReservationSummary(
  items: LibrarianReservationItem[],
  policy: Pick<ReservationPolicyConfig, 'expiring_warning_hours'>,
  referenceDate: Date
): ReservationSummaryCounts {
  let waiting = 0;
  let readyForPickup = 0;
  let expiringSoon = 0;
  let expired = 0;

  for (const item of items) {
    if (item.status === 'Waiting') {
      waiting += 1;
    } else if (item.status === 'Ready for Pickup') {
      readyForPickup += 1;
      if (isReservationExpiringSoon(item, policy, referenceDate)) {
        expiringSoon += 1;
      }
    } else if (item.status === 'Expired') {
      expired += 1;
    }
  }

  return {
    activeReservations: waiting + readyForPickup,
    waiting,
    readyForPickup,
    expiringSoon,
    expired,
  };
}

export function canMarkReservationReady(
  reservation: Pick<
    LibrarianReservationItem,
    'book_id' | 'status' | 'student_account_status' | 'queue_position'
  >,
  copies: InventoryPhysicalCopy[]
): {
  allowed: boolean;
  availableCopies: InventoryPhysicalCopy[];
  reason?: string;
} {
  if (reservation.status !== 'Waiting') {
    return {
      allowed: false,
      availableCopies: [],
      reason: `Only Waiting reservations can be marked Ready for Pickup (current status: ${reservation.status}).`,
    };
  }

  if (reservation.student_account_status !== 'Active') {
    return {
      allowed: false,
      availableCopies: [],
      reason: `Student account is currently ${reservation.student_account_status}. Resolve account restriction before assigning a pickup copy.`,
    };
  }

  const availableCopies = copies.filter(
    (c) => c.book_id === reservation.book_id && c.status === 'Available'
  );

  if (availableCopies.length === 0) {
    return {
      allowed: false,
      availableCopies: [],
      reason: 'No available physical copy is currently on shelf to fulfill this reservation.',
    };
  }

  if (typeof reservation.queue_position === 'number' && reservation.queue_position > 1) {
    return {
      allowed: false,
      availableCopies,
      reason: `Queue order must be respected: student is at Position #${reservation.queue_position}. Process Position #1 first.`,
    };
  }

  return { allowed: true, availableCopies };
}

export function filterAndPaginateReservations(
  items: LibrarianReservationItem[],
  filters: ReservationFilterCriteria,
  policy: Pick<ReservationPolicyConfig, 'expiring_warning_hours'>,
  referenceDate: Date,
  page: number,
  pageSize: number
): {
  items: LibrarianReservationItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const cleanQuery = filters.query.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (filters.tab === 'active') {
      if (item.status !== 'Waiting' && item.status !== 'Ready for Pickup') return false;
    } else if (filters.tab === 'waiting' && item.status !== 'Waiting') {
      return false;
    } else if (filters.tab === 'ready_for_pickup' && item.status !== 'Ready for Pickup') {
      return false;
    } else if (filters.tab === 'completed' && item.status !== 'Completed') {
      return false;
    } else if (filters.tab === 'cancelled' && item.status !== 'Cancelled') {
      return false;
    } else if (filters.tab === 'expired' && item.status !== 'Expired') {
      return false;
    }

    if (cleanQuery) {
      const haystack = [
        item.student_name,
        item.student_code,
        item.book_title,
        item.book_author,
        item.book_isbn,
        item.reservation_code,
        String(item.reservation_id),
        item.assigned_copy_accession ?? '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(cleanQuery)) return false;
    }

    if (filters.category !== 'All' && item.category !== filters.category) return false;
    if (filters.subject !== 'All' && item.subject !== filters.subject) return false;
    if (filters.branch !== 'All' && item.branch !== filters.branch) return false;
    if (filters.department !== 'All' && item.student_department !== filters.department) {
      return false;
    }

    if (filters.pickupStatus === 'expiring_soon') {
      if (!isReservationExpiringSoon(item, policy, referenceDate)) return false;
    } else if (filters.pickupStatus === 'ready') {
      if (item.status !== 'Ready for Pickup') return false;
    } else if (filters.pickupStatus === 'expired') {
      if (item.status !== 'Expired') return false;
    }

    if (filters.dateFrom && item.reservation_date.slice(0, 10) < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && item.reservation_date.slice(0, 10) > filters.dateTo) {
      return false;
    }

    return true;
  });

  const safeSize = Math.max(1, pageSize);
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * safeSize;

  return {
    items: filtered.slice(startIndex, startIndex + safeSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function buildReservationsApiQueryParams(
  filters: ReservationFilterCriteria,
  page: number,
  limit: number
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, page)));
  params.set('limit', String(Math.max(1, limit)));
  if (filters.tab !== 'all') params.set('status_tab', filters.tab);
  if (filters.query.trim()) params.set('q', filters.query.trim());
  if (filters.category !== 'All') params.set('category', filters.category);
  if (filters.subject !== 'All') params.set('subject', filters.subject);
  if (filters.branch !== 'All') params.set('branch', filters.branch);
  if (filters.department !== 'All') params.set('department', filters.department);
  if (filters.pickupStatus !== 'all') params.set('pickup_status', filters.pickupStatus);
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  return params;
}

export function mapReservationApiError(status: number, serverMessage?: string): string {
  const clean = serverMessage?.trim();
  if (status === 401) return clean || 'Staff authentication required. Please sign in again.';
  if (status === 403) {
    return clean || 'Your librarian role is not authorized to perform this reservation action.';
  }
  if (status === 404) return clean || 'Reservation record not found or already archived.';
  if (status === 409) {
    return (
      clean ||
      'Reservation state or copy availability changed concurrently. Refresh and inspect the updated queue.'
    );
  }
  if (status >= 500) {
    return clean || 'Unable to reach reservation service right now. Please try again.';
  }
  return clean || `Reservation request failed (HTTP ${status}).`;
}

function addHoursIso(baseDate: Date, offsetHours: number): string {
  return new Date(baseDate.getTime() + offsetHours * 3_600_000).toISOString();
}

function addDaysIsoDate(baseDate: Date, offsetDays: number): string {
  const d = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetDays
  );
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function createSampleReservationsStore(referenceDate: Date = new Date()): {
  policy: ReservationPolicyConfig;
  supportedFilters: ReservationSupportedFilters;
  supportedActions: ReservationSupportedActions;
  items: LibrarianReservationItem[];
  copies: InventoryPhysicalCopy[];
} {
  const inventoryStore = createSampleInventoryStore();
  const circulationStore = createSampleCirculationStore(referenceDate);
  const dashboardBundles = createSampleLibrarianDashboardBundles(referenceDate);

  const findBook = (bookId: number) =>
    inventoryStore.books.find((b) => b.book_id === bookId) ?? inventoryStore.books[0];

  const book3ReservedCopy =
    circulationStore.copies.find((c) => c.book_id === 3 && c.status === 'Reserved') ?? null;
  const book5ReservedCopy =
    circulationStore.copies.find((c) => c.book_id === 5 && c.status === 'Reserved') ?? null;

  const items: LibrarianReservationItem[] = [
    {
      reservation_id: 6201,
      reservation_code: 'RES-2026-6201',
      student_id: 1127,
      student_name: 'Neha Deshmukh',
      student_code: 'STU-2026-127',
      student_department: 'Cognitive & Behavioural Sciences',
      student_email: 'neha.deshmukh@university.edu',
      student_account_status: 'Active',
      book_id: 5,
      book_slug: DEMO_BOOKS[4].slug,
      book_title: findBook(5).title,
      book_author: findBook(5).authors,
      book_isbn: findBook(5).isbn,
      book_cover: findBook(5).cover_image,
      category: findBook(5).category,
      subject: findBook(5).subject,
      branch: findBook(5).branch,
      reservation_date: addDaysIsoDate(referenceDate, -3),
      queue_position: null,
      queue_total: 2,
      status: 'Ready for Pickup',
      ready_date: addHoursIso(referenceDate, -38),
      pickup_deadline: addHoursIso(referenceDate, 10),
      assigned_copy_id: book5ReservedCopy?.copy_id ?? 116,
      assigned_copy_accession: book5ReservedCopy?.accession_number ?? 'LIB-2026-0016',
      assigned_copy_status: book5ReservedCopy?.status ?? 'Reserved',
      notes: 'Held on Hold Shelf B-02; approaches 48-hour pickup cutoff.',
    },
    {
      reservation_id: 6202,
      reservation_code: 'RES-2026-6202',
      student_id: 1063,
      student_name: 'Arjun Menon',
      student_code: 'STU-2026-063',
      student_department: 'Data Science',
      student_email: 'arjun.menon@university.edu',
      student_account_status: 'Active',
      book_id: 3,
      book_slug: DEMO_BOOKS[2].slug,
      book_title: findBook(3).title,
      book_author: findBook(3).authors,
      book_isbn: findBook(3).isbn,
      book_cover: findBook(3).cover_image,
      category: findBook(3).category,
      subject: findBook(3).subject,
      branch: findBook(3).branch,
      reservation_date: addDaysIsoDate(referenceDate, -2),
      queue_position: null,
      queue_total: 1,
      status: 'Ready for Pickup',
      ready_date: addHoursIso(referenceDate, -8),
      pickup_deadline: addHoursIso(referenceDate, 40),
      assigned_copy_id: book3ReservedCopy?.copy_id ?? 109,
      assigned_copy_accession: book3ReservedCopy?.accession_number ?? 'LIB-2026-0009',
      assigned_copy_status: book3ReservedCopy?.status ?? 'Reserved',
      notes: 'Copy assigned on Main Circulation Hold Shelf A-04.',
    },
    {
      reservation_id: 6203,
      reservation_code: 'RES-2026-6203',
      student_id: 1198,
      student_name: 'Siddharth Rao',
      student_code: 'STU-2026-198',
      student_department: 'Cognitive & Behavioural Sciences',
      student_email: 'siddharth.rao@university.edu',
      student_account_status: 'Blocked',
      book_id: 5,
      book_slug: DEMO_BOOKS[4].slug,
      book_title: findBook(5).title,
      book_author: findBook(5).authors,
      book_isbn: findBook(5).isbn,
      book_cover: findBook(5).cover_image,
      category: findBook(5).category,
      subject: findBook(5).subject,
      branch: findBook(5).branch,
      reservation_date: dashboardBundles.reservations.items[2]?.reservation_date ?? addDaysIsoDate(referenceDate, -1),
      queue_position: 1,
      queue_total: 2,
      status: 'Waiting',
      ready_date: null,
      pickup_deadline: null,
      assigned_copy_id: null,
      assigned_copy_accession: null,
      assigned_copy_status: null,
      notes: 'Waiting for next returned copy of Understanding Mind.',
    },
    {
      reservation_id: 6205,
      reservation_code: 'RES-2026-6205',
      student_id: 1150,
      student_name: 'Kabir Sharma',
      student_code: 'STU-2026-150',
      student_department: 'Software Engineering',
      student_email: 'kabir.sharma@university.edu',
      student_account_status: 'Active',
      book_id: 4,
      book_slug: DEMO_BOOKS[3].slug,
      book_title: findBook(4).title,
      book_author: findBook(4).authors,
      book_isbn: findBook(4).isbn,
      book_cover: findBook(4).cover_image,
      category: findBook(4).category,
      subject: findBook(4).subject,
      branch: findBook(4).branch,
      reservation_date: addDaysIsoDate(referenceDate, -1),
      queue_position: 1,
      queue_total: 1,
      status: 'Waiting',
      ready_date: null,
      pickup_deadline: null,
      assigned_copy_id: null,
      assigned_copy_accession: null,
      assigned_copy_status: null,
      notes: 'Newly returned copy eligible on Engineering Annex shelf.',
    },
    {
      reservation_id: 6204,
      reservation_code: 'RES-2026-6204',
      student_id: 1031,
      student_name: 'Tanya Bose',
      student_code: 'STU-2026-031',
      student_department: 'Computer Science & Engineering',
      student_email: 'tanya.bose@university.edu',
      student_account_status: 'Active',
      book_id: 2,
      book_slug: DEMO_BOOKS[1].slug,
      book_title: findBook(2).title,
      book_author: findBook(2).authors,
      book_isbn: findBook(2).isbn,
      book_cover: findBook(2).cover_image,
      category: findBook(2).category,
      subject: findBook(2).subject,
      branch: findBook(2).branch,
      reservation_date: addDaysIsoDate(referenceDate, -5),
      queue_position: null,
      queue_total: null,
      status: 'Completed',
      ready_date: addHoursIso(referenceDate, -96),
      pickup_deadline: addHoursIso(referenceDate, -48),
      assigned_copy_id: 106,
      assigned_copy_accession: 'LIB-2026-0006',
      assigned_copy_status: 'Issued',
      notes: 'Issued at Circulation Desk via borrowing workflow.',
    },
    {
      reservation_id: 6206,
      reservation_code: 'RES-2026-6206',
      student_id: 1114,
      student_name: 'Meera Iyer',
      student_code: 'STU-2026-114',
      student_department: 'Computer Science & Engineering',
      student_email: 'meera.iyer@university.edu',
      student_account_status: 'Active',
      book_id: 1,
      book_slug: DEMO_BOOKS[0].slug,
      book_title: findBook(1).title,
      book_author: findBook(1).authors,
      book_isbn: findBook(1).isbn,
      book_cover: findBook(1).cover_image,
      category: findBook(1).category,
      subject: findBook(1).subject,
      branch: findBook(1).branch,
      reservation_date: addDaysIsoDate(referenceDate, -7),
      queue_position: null,
      queue_total: null,
      status: 'Expired',
      ready_date: addHoursIso(referenceDate, -72),
      pickup_deadline: addHoursIso(referenceDate, -24),
      assigned_copy_id: null,
      assigned_copy_accession: null,
      assigned_copy_status: null,
      notes: '48-hour pickup window lapsed; held copy released back to shelf.',
    },
    {
      reservation_id: 6207,
      reservation_code: 'RES-2026-6207',
      student_id: 1089,
      student_name: 'Rohan Kulkarni',
      student_code: 'STU-2026-089',
      student_department: 'Artificial Intelligence & Data Science',
      student_email: 'rohan.kulkarni@university.edu',
      student_account_status: 'Active',
      book_id: 6,
      book_slug: DEMO_BOOKS[5].slug,
      book_title: findBook(6).title,
      book_author: findBook(6).authors,
      book_isbn: findBook(6).isbn,
      book_cover: findBook(6).cover_image,
      category: findBook(6).category,
      subject: findBook(6).subject,
      branch: findBook(6).branch,
      reservation_date: addDaysIsoDate(referenceDate, -6),
      queue_position: null,
      queue_total: null,
      status: 'Cancelled',
      ready_date: null,
      pickup_deadline: null,
      assigned_copy_id: null,
      assigned_copy_accession: null,
      assigned_copy_status: null,
      notes: 'Cancelled prior to copy allocation.',
    },
  ];

  return {
    policy: {
      pickup_window_hours: 48,
      expiring_warning_hours: 24,
      supports_notifications: true,
      server_reference_iso: referenceDate.toISOString(),
    },
    supportedFilters: {
      date_range: true,
      category: true,
      subject: true,
      branch: true,
      student_department: true,
      pickup_status: true,
    },
    supportedActions: {
      can_mark_ready: true,
      can_cancel: true,
      can_extend_deadline: true,
    },
    items,
    copies: circulationStore.copies,
  };
}

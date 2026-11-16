import { DEMO_BOOKS } from '../data/libraryData';
import {
  computeBorrowingLoanMetrics,
  createSampleCirculationStore,
  type CirculationPolicy,
  type CirculationStudentStatus,
} from './librarianCirculation';
import type { CopyCondition } from './librarianInventory';
import { createSampleStudentRecordsStore } from './librarianStudents';

export type OverdueDurationBucketKey = '1_7' | '8_30' | '31_plus';

export interface OverdueDurationBucketDefinition {
  key: OverdueDurationBucketKey;
  label: string;
  shortLabel: string;
  minDays: number;
  maxDays: number | null;
}

export const DEFAULT_OVERDUE_BUCKETS: OverdueDurationBucketDefinition[] = [
  {
    key: '1_7',
    label: '1–7 Days Overdue',
    shortLabel: '1–7 Days',
    minDays: 1,
    maxDays: 7,
  },
  {
    key: '8_30',
    label: '8–30 Days Overdue',
    shortLabel: '8–30 Days',
    minDays: 8,
    maxDays: 30,
  },
  {
    key: '31_plus',
    label: 'More Than 30 Days Overdue',
    shortLabel: '30+ Days',
    minDays: 31,
    maxDays: null,
  },
];

export type OverdueFinePaymentStatus = 'Unpaid' | 'Partially Paid' | 'Waived' | 'Paid';

export interface OverdueReminderLogItem {
  reminder_id: string;
  sent_at: string;
  channel: 'In-App' | 'In-App + Email';
  sent_by: string;
  status: 'Delivered' | 'Queued' | 'Failed';
}

export interface OverdueRecordItem {
  borrowing_id: number;
  transaction_code: string;
  student_id: number;
  student_name: string;
  student_code: string;
  student_email: string;
  student_department: string;
  student_account_status: CirculationStudentStatus;
  student_restriction_note: string | null;
  book_id: number;
  book_slug: string;
  book_title: string;
  book_author: string;
  book_isbn: string;
  book_cover: string;
  book_category: string;
  branch: string;
  copy_id: number;
  accession_number: string;
  shelf_location: string;
  copy_condition: CopyCondition;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  borrowing_status: 'Issued' | 'Overdue' | 'Renewal Pending' | 'Returned';
  days_overdue: number;
  fine_amount: number | null;
  fine_currency_symbol: string;
  fine_calculation_basis: string | null;
  fine_payment_status: OverdueFinePaymentStatus | null;
  fine_outstanding_balance: number | null;
  last_reminder_at: string | null;
  reminder_history: OverdueReminderLogItem[];
}

export interface OverduePolicyCapabilities {
  fine_policy_enabled: boolean;
  fine_per_day_amount: number | null;
  fine_currency_symbol: string;
  supports_email_notifications: boolean;
  supports_bulk_reminders: boolean;
  reminder_cooldown_hours: number;
  library_contact_info: string | null;
  overdue_restriction_policy_note: string | null;
  authoritative_date_iso: string;
  authoritative_timezone: string;
  duration_buckets: OverdueDurationBucketDefinition[];
}

export interface OverdueSummaryCounts {
  totalOverdueLoans: number;
  studentsWithOverdueBooks: number;
  overdue1To7Days: number;
  overdue8To30Days: number;
  overdueMoreThan30Days: number;
}

export type OverdueSortOption =
  | 'most_overdue'
  | 'least_overdue'
  | 'due_date'
  | 'student_name'
  | 'book_title';

export interface OverdueFilterCriteria {
  query: string;
  durationBucket: 'All' | OverdueDurationBucketKey;
  department: string;
  category: string;
  branch: string;
  fineStatus: 'All' | OverdueFinePaymentStatus;
  dateFrom: string;
  dateTo: string;
  sortBy: OverdueSortOption;
}

export function classifyOverdueDurationBucket(
  daysOverdue: number,
  buckets: OverdueDurationBucketDefinition[] = DEFAULT_OVERDUE_BUCKETS
): OverdueDurationBucketDefinition | null {
  if (!Number.isFinite(daysOverdue) || daysOverdue <= 0) return null;
  for (const bucket of buckets) {
    const aboveMin = daysOverdue >= bucket.minDays;
    const belowMax = bucket.maxDays === null || daysOverdue <= bucket.maxDays;
    if (aboveMin && belowMax) {
      return bucket;
    }
  }
  return buckets[buckets.length - 1] ?? null;
}

/**
 * Guarantees returned books or loans still on or before due date never appear as overdue.
 */
export function filterValidOverdueRecords(records: OverdueRecordItem[]): OverdueRecordItem[] {
  return records.filter(
    (record) =>
      record.return_date === null &&
      record.borrowing_status !== 'Returned' &&
      Number.isFinite(record.days_overdue) &&
      record.days_overdue > 0
  );
}

export function computeOverdueSummary(
  records: OverdueRecordItem[],
  buckets: OverdueDurationBucketDefinition[] = DEFAULT_OVERDUE_BUCKETS
): OverdueSummaryCounts {
  const valid = filterValidOverdueRecords(records);
  const studentIds = new Set<number>();
  let overdue1To7Days = 0;
  let overdue8To30Days = 0;
  let overdueMoreThan30Days = 0;

  for (const item of valid) {
    studentIds.add(item.student_id);
    const bucket = classifyOverdueDurationBucket(item.days_overdue, buckets);
    if (bucket?.key === '1_7') overdue1To7Days += 1;
    else if (bucket?.key === '8_30') overdue8To30Days += 1;
    else if (bucket?.key === '31_plus') overdueMoreThan30Days += 1;
  }

  return {
    totalOverdueLoans: valid.length,
    studentsWithOverdueBooks: studentIds.size,
    overdue1To7Days,
    overdue8To30Days,
    overdueMoreThan30Days,
  };
}

export function filterAndSortOverdueRecords(
  records: OverdueRecordItem[],
  criteria: OverdueFilterCriteria,
  policy: Pick<OverduePolicyCapabilities, 'fine_policy_enabled' | 'duration_buckets'>,
  page: number,
  pageSize: number
): {
  items: OverdueRecordItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const valid = filterValidOverdueRecords(records);
  const lower = criteria.query.trim().toLowerCase();

  const filtered = valid.filter((item) => {
    if (criteria.durationBucket !== 'All') {
      const bucket = classifyOverdueDurationBucket(item.days_overdue, policy.duration_buckets);
      if (bucket?.key !== criteria.durationBucket) return false;
    }
    if (criteria.department !== 'All' && item.student_department !== criteria.department) {
      return false;
    }
    if (criteria.category !== 'All' && item.book_category !== criteria.category) {
      return false;
    }
    if (criteria.branch !== 'All' && item.branch !== criteria.branch) {
      return false;
    }
    if (
      policy.fine_policy_enabled &&
      criteria.fineStatus !== 'All' &&
      item.fine_payment_status !== criteria.fineStatus
    ) {
      return false;
    }
    if (criteria.dateFrom && item.due_date.slice(0, 10) < criteria.dateFrom) {
      return false;
    }
    if (criteria.dateTo && item.due_date.slice(0, 10) > criteria.dateTo) {
      return false;
    }
    if (!lower) return true;

    return (
      item.student_name.toLowerCase().includes(lower) ||
      item.student_code.toLowerCase().includes(lower) ||
      item.book_title.toLowerCase().includes(lower) ||
      item.book_author.toLowerCase().includes(lower) ||
      item.book_isbn.toLowerCase().includes(lower) ||
      item.accession_number.toLowerCase().includes(lower) ||
      item.transaction_code.toLowerCase().includes(lower) ||
      String(item.copy_id) === lower ||
      String(item.borrowing_id) === lower
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (criteria.sortBy) {
      case 'most_overdue':
        return b.days_overdue - a.days_overdue || a.due_date.localeCompare(b.due_date);
      case 'least_overdue':
        return a.days_overdue - b.days_overdue || a.due_date.localeCompare(b.due_date);
      case 'due_date':
        return a.due_date.localeCompare(b.due_date);
      case 'student_name':
        return a.student_name.localeCompare(b.student_name);
      case 'book_title':
        return a.book_title.localeCompare(b.book_title);
    }
  });

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    items: sorted.slice(startIndex, startIndex + pageSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function buildOverdueApiQueryParams(
  criteria: OverdueFilterCriteria,
  policy: Pick<OverduePolicyCapabilities, 'fine_policy_enabled'>,
  page: number,
  pageSize: number
): URLSearchParams {
  const params = new URLSearchParams();
  if (criteria.query.trim()) params.set('q', criteria.query.trim());
  if (criteria.durationBucket !== 'All') params.set('duration_bucket', criteria.durationBucket);
  if (criteria.department !== 'All') params.set('department', criteria.department);
  if (criteria.category !== 'All') params.set('category', criteria.category);
  if (criteria.branch !== 'All') params.set('branch', criteria.branch);
  if (policy.fine_policy_enabled && criteria.fineStatus !== 'All') {
    params.set('fine_status', criteria.fineStatus);
  }
  if (criteria.dateFrom) params.set('date_from', criteria.dateFrom);
  if (criteria.dateTo) params.set('date_to', criteria.dateTo);
  params.set('sort', criteria.sortBy);
  params.set('page', String(page));
  params.set('limit', String(pageSize));
  return params;
}

export function wasReminderSentRecently(
  record: Pick<OverdueRecordItem, 'last_reminder_at'>,
  cooldownHours: number,
  referenceDate: Date
): boolean {
  if (!record.last_reminder_at || cooldownHours <= 0) return false;
  const sentTime = new Date(record.last_reminder_at).getTime();
  if (Number.isNaN(sentTime)) return false;
  const diffHours = (referenceDate.getTime() - sentTime) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours < cooldownHours;
}

export function prepareBulkOverdueSelection(
  selectedBorrowingIds: number[],
  records: OverdueRecordItem[],
  cooldownHours: number,
  referenceDate: Date
): {
  eligibleRecords: OverdueRecordItem[];
  skippedCooldownRecords: OverdueRecordItem[];
  dedupedBorrowingIds: number[];
} {
  const valid = filterValidOverdueRecords(records);
  const byBorrowingId = new Map<number, OverdueRecordItem>();
  for (const item of valid) {
    byBorrowingId.set(item.borrowing_id, item);
  }

  const seenStudentBorrowing = new Set<string>();
  const eligibleRecords: OverdueRecordItem[] = [];
  const skippedCooldownRecords: OverdueRecordItem[] = [];

  for (const id of selectedBorrowingIds) {
    const record = byBorrowingId.get(id);
    if (!record) continue;
    const dedupeKey = `${record.student_id}:${record.borrowing_id}`;
    if (seenStudentBorrowing.has(dedupeKey)) continue;
    seenStudentBorrowing.add(dedupeKey);

    if (wasReminderSentRecently(record, cooldownHours, referenceDate)) {
      skippedCooldownRecords.push(record);
    } else {
      eligibleRecords.push(record);
    }
  }

  return {
    eligibleRecords,
    skippedCooldownRecords,
    dedupedBorrowingIds: eligibleRecords.map((r) => r.borrowing_id),
  };
}

export function buildOverdueReminderPreview(
  record: OverdueRecordItem,
  contactInfo: string | null,
  formattedDueDate: string
): {
  subject: string;
  bodyLines: string[];
} {
  const lines = [
    `Dear ${record.student_name} (${record.student_code}),`,
    `Your library copy of "${record.book_title}" (${record.accession_number}) was due on ${formattedDueDate} and is currently ${record.days_overdue} day${record.days_overdue === 1 ? '' : 's'} overdue.`,
    'Please return this book to the Main Circulation Desk as soon as possible so other students can access it and your borrowing privileges remain in good standing.',
  ];
  if (contactInfo) {
    lines.push(`Library Desk Contact: ${contactInfo}`);
  }
  return {
    subject: `Overdue Book Reminder: ${record.book_title}`,
    bodyLines: lines,
  };
}

export function deriveOverdueStudentPolicyWarning(
  record: Pick<
    OverdueRecordItem,
    'student_account_status' | 'student_restriction_note' | 'days_overdue'
  >,
  policyNote: string | null
): { severity: 'blocked' | 'restricted' | 'warning'; title: string; detail: string } {
  if (record.student_account_status === 'Blocked' || record.student_account_status === 'Suspended') {
    return {
      severity: 'blocked',
      title: `Account ${record.student_account_status} by library policy`,
      detail:
        record.student_restriction_note ||
        'Borrowing is suspended until overdue items are returned and reviewed by staff.',
    };
  }
  if (record.student_restriction_note) {
    return {
      severity: 'restricted',
      title: 'Borrowing temporarily restricted',
      detail: record.student_restriction_note,
    };
  }
  return {
    severity: 'warning',
    title: 'Outstanding overdue loan',
    detail:
      policyNote ||
      'Student account remains active while overdue return follow-up is in progress.',
  };
}

export function mapOverdueApiError(status: number, rawMessage?: string | null): string {
  const msg = rawMessage?.trim();
  if (status === 401) {
    return 'Your librarian session expired. Sign in again to manage overdue records.';
  }
  if (status === 403) {
    return msg || 'Your staff account does not have permission to view or remind overdue loans.';
  }
  if (status === 404) {
    return msg || 'Borrowing record was not found or has already been returned.';
  }
  if (status === 429 || status === 409) {
    return (
      msg ||
      'A reminder was already sent recently for this borrowing within the duplicate-prevention cooldown window.'
    );
  }
  if (status >= 500) {
    return msg || 'Unable to load overdue records right now. Please try again.';
  }
  return msg || `Overdue request failed (${status}).`;
}

function addDaysIsoDate(baseDate: Date, offsetDays: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addHoursIso(baseDate: Date, offsetHours: number): string {
  return new Date(baseDate.getTime() + offsetHours * 3600 * 1000).toISOString();
}

export interface SampleOverdueStore {
  policy: OverduePolicyCapabilities;
  circulationPolicy: CirculationPolicy;
  records: OverdueRecordItem[];
}

export function createSampleOverdueStore(
  referenceDate: Date = new Date()
): SampleOverdueStore {
  const circulation = createSampleCirculationStore(referenceDate);
  const studentStore = createSampleStudentRecordsStore(referenceDate);

  const policy: OverduePolicyCapabilities = {
    fine_policy_enabled: circulation.policy.fine_policy_enabled,
    fine_per_day_amount: circulation.policy.fine_per_day_amount,
    fine_currency_symbol: circulation.policy.fine_currency_symbol,
    supports_email_notifications: circulation.policy.supports_email_notifications,
    supports_bulk_reminders: true,
    reminder_cooldown_hours: 24,
    library_contact_info: 'circulation@library.university.edu · Main Desk Ext. 204',
    overdue_restriction_policy_note:
      'Accounts are not automatically blocked on day 1; staff follow up with reminders and apply holds per library policy.',
    authoritative_date_iso: referenceDate.toISOString(),
    authoritative_timezone: 'Asia/Kolkata (IST)',
    duration_buckets: DEFAULT_OVERDUE_BUCKETS,
  };

  // Start from overdue items aligned across Librarian Dashboard, Circulation, and Student Records
  const records: OverdueRecordItem[] = [];

  for (const borrowing of circulation.borrowings) {
    if (borrowing.status === 'Returned' || borrowing.return_date !== null) continue;
    const metrics = computeBorrowingLoanMetrics(
      borrowing,
      policy.authoritative_date_iso,
      circulation.policy
    );
    if (metrics.daysOverdue <= 0) continue;

    const bookMeta =
      circulation.books.find((b) => b.book_id === borrowing.book_id) ?? circulation.books[0];

    records.push({
      borrowing_id: borrowing.borrowing_id,
      transaction_code: borrowing.transaction_code,
      student_id: borrowing.student_id,
      student_name: borrowing.student_name,
      student_code: borrowing.student_code,
      student_email: borrowing.student_email,
      student_department: borrowing.student_department,
      student_account_status: borrowing.student_account_status,
      student_restriction_note: null,
      book_id: borrowing.book_id,
      book_slug: bookMeta.slug,
      book_title: borrowing.book_title,
      book_author: borrowing.book_author,
      book_isbn: borrowing.book_isbn,
      book_cover: borrowing.book_cover,
      book_category: bookMeta.category,
      branch: bookMeta.branch,
      copy_id: borrowing.copy_id,
      accession_number: borrowing.accession_number,
      shelf_location: borrowing.shelf_location,
      copy_condition: borrowing.copy_condition,
      issue_date: borrowing.issue_date,
      due_date: borrowing.due_date,
      return_date: null,
      borrowing_status: 'Overdue',
      days_overdue: metrics.daysOverdue,
      fine_amount: null,
      fine_currency_symbol: policy.fine_currency_symbol,
      fine_calculation_basis: null,
      fine_payment_status: null,
      fine_outstanding_balance: null,
      last_reminder_at: addHoursIso(referenceDate, -36),
      reminder_history: [
        {
          reminder_id: `REM-${borrowing.borrowing_id}-1`,
          sent_at: addHoursIso(referenceDate, -36),
          channel: 'In-App',
          sent_by: 'Automated Overdue Scheduler',
          status: 'Delivered',
        },
      ],
    });
  }

  // Siddharth Rao (STU-2026-198, Blocked, 8 days overdue) aligned with Student Records
  const siddharth = studentStore.students.find((s) => s.student_id === 1198);
  const siddharthProfile = studentStore.profilesById[1198];
  const siddharthOverdue = siddharthProfile?.current_borrowings[0];
  if (siddharth && siddharthOverdue) {
    const book6 = circulation.books.find((b) => b.book_id === 6) ?? circulation.books[0];
    records.push({
      borrowing_id: siddharthOverdue.borrowing_id,
      transaction_code: siddharthOverdue.transaction_code,
      student_id: siddharth.student_id,
      student_name: siddharth.full_name,
      student_code: siddharth.student_code,
      student_email: siddharth.email,
      student_department: siddharth.department,
      student_account_status: siddharth.account_status,
      student_restriction_note: siddharth.restriction_reason,
      book_id: book6.book_id,
      book_slug: book6.slug,
      book_title: book6.title,
      book_author: book6.authors,
      book_isbn: book6.isbn,
      book_cover: book6.cover_image,
      book_category: book6.category,
      branch: book6.branch,
      copy_id: siddharthOverdue.copy_id,
      accession_number: siddharthOverdue.accession_number,
      shelf_location: `${book6.branch} · ${book6.floor} · ${book6.shelf}`,
      copy_condition: 'Good',
      issue_date: siddharthOverdue.issue_date,
      due_date: siddharthOverdue.due_date,
      return_date: null,
      borrowing_status: 'Overdue',
      days_overdue: Math.max(8, siddharthOverdue.days_overdue),
      fine_amount: null,
      fine_currency_symbol: policy.fine_currency_symbol,
      fine_calculation_basis: null,
      fine_payment_status: null,
      fine_outstanding_balance: null,
      last_reminder_at: addHoursIso(referenceDate, -8),
      reminder_history: [
        {
          reminder_id: `REM-${siddharthOverdue.borrowing_id}-1`,
          sent_at: addHoursIso(referenceDate, -96),
          channel: 'In-App',
          sent_by: 'Automated Overdue Scheduler',
          status: 'Delivered',
        },
        {
          reminder_id: `REM-${siddharthOverdue.borrowing_id}-2`,
          sent_at: addHoursIso(referenceDate, -8),
          channel: 'In-App',
          sent_by: 'Dr. Priya Nair',
          status: 'Delivered',
        },
      ],
    });
  }

  // Neha Deshmukh (14 days overdue -> 8-30 bucket)
  const neha = studentStore.students.find((s) => s.student_id === 1127);
  const book2 = circulation.books.find((b) => b.book_id === 2) ?? circulation.books[0];
  if (neha) {
    records.push({
      borrowing_id: 8375,
      transaction_code: 'TXN-2026-8375',
      student_id: neha.student_id,
      student_name: neha.full_name,
      student_code: neha.student_code,
      student_email: neha.email,
      student_department: neha.department,
      student_account_status: neha.account_status,
      student_restriction_note: 'Borrowing temporarily restricted pending overdue return.',
      book_id: book2.book_id,
      book_slug: book2.slug,
      book_title: book2.title,
      book_author: book2.authors,
      book_isbn: book2.isbn,
      book_cover: book2.cover_image,
      book_category: book2.category,
      branch: book2.branch,
      copy_id: 202,
      accession_number: 'LIB-2026-0006',
      shelf_location: `${book2.branch} · ${book2.floor} · ${book2.shelf}`,
      copy_condition: 'Fair',
      issue_date: addDaysIsoDate(referenceDate, -28),
      due_date: addDaysIsoDate(referenceDate, -14),
      return_date: null,
      borrowing_status: 'Overdue',
      days_overdue: 14,
      fine_amount: null,
      fine_currency_symbol: policy.fine_currency_symbol,
      fine_calculation_basis: null,
      fine_payment_status: null,
      fine_outstanding_balance: null,
      last_reminder_at: addHoursIso(referenceDate, -52),
      reminder_history: [
        {
          reminder_id: 'REM-8375-1',
          sent_at: addHoursIso(referenceDate, -52),
          channel: 'In-App',
          sent_by: 'Automated Overdue Scheduler',
          status: 'Delivered',
        },
      ],
    });
  }

  // Tanya Bose (34 days overdue -> 31+ Days bucket)
  const tanya = studentStore.students.find((s) => s.student_id === 1031);
  const book1 = circulation.books.find((b) => b.book_id === 1) ?? circulation.books[0];
  if (tanya) {
    records.push({
      borrowing_id: 8312,
      transaction_code: 'TXN-2026-8312',
      student_id: tanya.student_id,
      student_name: tanya.full_name,
      student_code: tanya.student_code,
      student_email: tanya.email,
      student_department: tanya.department,
      student_account_status: tanya.account_status,
      student_restriction_note:
        'Borrowing temporarily restricted — overdue more than 30 days.',
      book_id: book1.book_id,
      book_slug: book1.slug,
      book_title: book1.title,
      book_author: book1.authors,
      book_isbn: book1.isbn,
      book_cover: book1.cover_image,
      book_category: book1.category,
      branch: book1.branch,
      copy_id: 104,
      accession_number: 'LIB-2026-0004',
      shelf_location: `${book1.branch} · ${book1.floor} · ${book1.shelf}`,
      copy_condition: 'Good',
      issue_date: addDaysIsoDate(referenceDate, -48),
      due_date: addDaysIsoDate(referenceDate, -34),
      return_date: null,
      borrowing_status: 'Overdue',
      days_overdue: 34,
      fine_amount: null,
      fine_currency_symbol: policy.fine_currency_symbol,
      fine_calculation_basis: null,
      fine_payment_status: null,
      fine_outstanding_balance: null,
      last_reminder_at: addHoursIso(referenceDate, -72),
      reminder_history: [
        {
          reminder_id: 'REM-8312-1',
          sent_at: addHoursIso(referenceDate, -240),
          channel: 'In-App',
          sent_by: 'Automated Overdue Scheduler',
          status: 'Delivered',
        },
        {
          reminder_id: 'REM-8312-2',
          sent_at: addHoursIso(referenceDate, -72),
          channel: 'In-App',
          sent_by: 'Dr. Priya Nair',
          status: 'Delivered',
        },
      ],
    });
  }

  void DEMO_BOOKS;

  return {
    policy,
    circulationPolicy: circulation.policy,
    records,
  };
}

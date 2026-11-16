import { DEMO_BOOKS } from '../data/libraryData';
import {
  createSampleLibrarianDashboardBundles,
  getDaysRemaining,
} from './librarianDashboard';
import {
  createSampleInventoryStore,
  type CopyCondition,
  type CopyStatus,
  type InventoryBookItem,
  type InventoryPhysicalCopy,
} from './librarianInventory';

export type CirculationStudentStatus = 'Active' | 'Blocked' | 'Suspended';

export interface CirculationStudentRecord {
  student_id: number;
  student_code: string;
  roll_number: string;
  full_name: string;
  email: string;
  department: string;
  program: string;
  account_status: CirculationStudentStatus;
  active_loans_count: number;
  due_soon_count: number;
  overdue_count: number;
  max_borrowing_limit: number;
  remaining_capacity: number;
  active_book_ids: number[];
  restriction_reason: string | null;
}

export interface CirculationPolicy {
  default_loan_duration_days: number;
  reservation_pickup_window_hours: number;
  fine_policy_enabled: boolean;
  fine_per_day_amount: number | null;
  fine_currency_symbol: string;
  supports_email_notifications: boolean;
  supports_barcodes: boolean;
  server_reference_iso: string;
}

export interface CirculationReservationRecord {
  reservation_id: number;
  book_id: number;
  book_title: string;
  student_id: number;
  student_name: string;
  student_code: string;
  queue_position: number | null;
  status: 'Waiting' | 'Ready for Pickup' | 'Expiring Soon' | 'Fulfilled';
  created_at: string;
  expires_at: string | null;
}

export type EligibilityReasonCode =
  | 'ELIGIBLE'
  | 'ACCOUNT_BLOCKED'
  | 'LIMIT_REACHED'
  | 'ALREADY_BORROWED'
  | 'RESERVATION_CONFLICT'
  | 'RESTRICTED';

export interface StudentEligibilityResult {
  eligible: boolean;
  reasonCode: EligibilityReasonCode;
  message: string;
}

export interface ReservationQueueCheckResult {
  allowed: boolean;
  status: 'clear' | 'entitled_hold' | 'blocked_by_queue';
  queueCount: number;
  entitledReservation: CirculationReservationRecord | null;
  blockingStudentSummary: string | null;
  message: string;
}

export type ReturnCopyCondition = 'Good' | 'Fair' | 'Damaged' | 'Lost';

export type ActiveBorrowingDisplayStatus = 'Active' | 'Due Today' | 'Overdue';

export interface ActiveBorrowingDetail {
  borrowing_id: number;
  transaction_code: string;
  student_id: number;
  student_name: string;
  student_code: string;
  student_email: string;
  student_department: string;
  student_account_status: CirculationStudentStatus;
  book_id: number;
  book_title: string;
  book_author: string;
  book_isbn: string;
  book_cover: string;
  copy_id: number;
  accession_number: string;
  barcode: string | null;
  shelf_location: string;
  copy_condition: CopyCondition;
  copy_status: CopyStatus;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: 'Issued' | 'Overdue' | 'Renewal Pending' | 'Returned';
}

export interface IssueTransactionConfirmation {
  transaction_id: string | null;
  borrowing_id: number;
  student_id: number;
  student_name: string;
  student_code: string;
  book_id: number;
  book_title: string;
  copy_id: number;
  accession_number: string;
  issue_date: string;
  due_date: string;
  loan_duration_days: number;
  librarian_name: string;
  in_app_notification_created: boolean;
  email_notification_sent: boolean;
}

export interface ReturnTransactionConfirmation {
  borrowing_id: number;
  transaction_code: string;
  student_id: number;
  student_name: string;
  student_code: string;
  book_id: number;
  book_title: string;
  copy_id: number;
  accession_number: string;
  return_date: string;
  returned_condition: ReturnCopyCondition;
  resulting_copy_status: CopyStatus;
  days_overdue: number;
  fine_applied: boolean;
  fine_amount: number | null;
  fine_currency_symbol: string;
  fine_status_label: string;
  reservation_status_note: string | null;
  held_for_student_name: string | null;
  reading_history_updated: boolean;
  in_app_notification_created: boolean;
  email_notification_sent: boolean;
}

export const RETURN_CONDITION_OPTIONS: Array<{
  value: ReturnCopyCondition;
  label: string;
  helper: string;
}> = [
  {
    value: 'Good',
    label: 'Good',
    helper: 'Clean cover and intact pages; ready for shelf or reservation hold.',
  },
  {
    value: 'Fair',
    label: 'Fair',
    helper: 'Normal minor wear; suitable for continued student circulation.',
  },
  {
    value: 'Damaged',
    label: 'Damaged',
    helper: 'Physical wear, torn binding, or water damage requiring repair review.',
  },
  {
    value: 'Lost',
    label: 'Lost',
    helper: 'Student reported copy lost; removes copy from shelf circulation.',
  },
];

export function derivePhysicalCopyAvailabilitySummary(
  copies: InventoryPhysicalCopy[],
  bookId: number
): {
  totalCopies: number;
  availableCopies: number;
  reservedCopies: number;
  issuedCopies: number;
  unavailableCopies: number;
  label: string;
} {
  const bookCopies = copies.filter((c) => c.book_id === bookId);
  const availableCopies = bookCopies.filter((c) => c.status === 'Available').length;
  const reservedCopies = bookCopies.filter((c) => c.status === 'Reserved').length;
  const issuedCopies = bookCopies.filter((c) => c.status === 'Issued').length;
  const unavailableCopies =
    bookCopies.length - availableCopies - reservedCopies - issuedCopies;

  return {
    totalCopies: bookCopies.length,
    availableCopies,
    reservedCopies,
    issuedCopies,
    unavailableCopies,
    label:
      availableCopies === 0
        ? 'No copies available'
        : availableCopies === 1
          ? '1 copy available'
          : `${availableCopies} copies available`,
  };
}

export function checkBookReservationConflict(params: {
  studentId: number;
  bookId: number;
  copies: InventoryPhysicalCopy[];
  reservations: CirculationReservationRecord[];
}): ReservationQueueCheckResult {
  const activeBookReservations = params.reservations
    .filter((r) => r.book_id === params.bookId && r.status !== 'Fulfilled')
    .sort((a, b) => {
      const rank = (s: CirculationReservationRecord['status']) =>
        s === 'Ready for Pickup' || s === 'Expiring Soon' ? 0 : 1;
      const rankDiff = rank(a.status) - rank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return (a.queue_position ?? 999) - (b.queue_position ?? 999);
    });

  const bookCopies = params.copies.filter((c) => c.book_id === params.bookId);
  const availableShelfCopies = bookCopies.filter((c) => c.status === 'Available').length;
  const heldReservedCopies = bookCopies.filter((c) => c.status === 'Reserved').length;
  const studentOwnReservation =
    activeBookReservations.find((r) => r.student_id === params.studentId) ?? null;

  if (activeBookReservations.length === 0) {
    return {
      allowed: true,
      status: 'clear',
      queueCount: 0,
      entitledReservation: null,
      blockingStudentSummary: null,
      message: 'No active reservation queue restricts issuing this title.',
    };
  }

  // If the selected student holds a Ready/Expiring reservation or is #1 in queue:
  const firstInQueue = activeBookReservations[0];
  if (
    studentOwnReservation &&
    (studentOwnReservation.status === 'Ready for Pickup' ||
      studentOwnReservation.status === 'Expiring Soon' ||
      firstInQueue.student_id === params.studentId)
  ) {
    return {
      allowed: true,
      status: 'entitled_hold',
      queueCount: activeBookReservations.length,
      entitledReservation: studentOwnReservation,
      blockingStudentSummary: null,
      message: `Eligible to fulfill ${studentOwnReservation.student_name}'s active reservation (${studentOwnReservation.status}).`,
    };
  }

  // How many priority reservations ahead of the selected student exist?
  const higherPriorityCount = activeBookReservations.filter((r) => {
    if (r.student_id === params.studentId) return false;
    return true;
  }).length;

  // Total assignable copies (available on shelf + reserved holds) vs higher-priority holds:
  const totalPotentiallyAssignable = availableShelfCopies + heldReservedCopies;

  // Block unauthorized issue if shelf copies alone cannot cover priority reservations ahead
  if (
    firstInQueue.student_id !== params.studentId &&
    availableShelfCopies <= higherPriorityCount &&
    totalPotentiallyAssignable > 0
  ) {
    return {
      allowed: false,
      status: 'blocked_by_queue',
      queueCount: activeBookReservations.length,
      entitledReservation: null,
      blockingStudentSummary: `${firstInQueue.student_name} (${firstInQueue.student_code}) — ${firstInQueue.status}`,
      message: `Another student is ahead in the reservation queue (${firstInQueue.student_name}, ${firstInQueue.student_code}). Unauthorized bypass is blocked.`,
    };
  }

  if (availableShelfCopies === 0 && heldReservedCopies > 0) {
    return {
      allowed: false,
      status: 'blocked_by_queue',
      queueCount: activeBookReservations.length,
      entitledReservation: null,
      blockingStudentSummary: `${firstInQueue.student_name} (${firstInQueue.student_code}) — ${firstInQueue.status}`,
      message: `All remaining copies of this title are held for ${firstInQueue.student_name} (${firstInQueue.student_code}).`,
    };
  }

  return {
    allowed: true,
    status: 'clear',
    queueCount: activeBookReservations.length,
    entitledReservation: studentOwnReservation,
    blockingStudentSummary: null,
    message: `${availableShelfCopies} unreserved shelf copies remain available after active holds.`,
  };
}

export function evaluateStudentEligibility(params: {
  student: CirculationStudentRecord;
  selectedBookId?: number | null;
  copies?: InventoryPhysicalCopy[];
  reservations?: CirculationReservationRecord[];
}): StudentEligibilityResult {
  const { student, selectedBookId, copies = [], reservations = [] } = params;

  if (student.account_status !== 'Active') {
    return {
      eligible: false,
      reasonCode: 'ACCOUNT_BLOCKED',
      message:
        student.restriction_reason?.trim() ||
        `Account currently ${student.account_status.toLowerCase()}. Clear restriction before issuing books.`,
    };
  }

  if (student.restriction_reason && student.restriction_reason.trim().length > 0) {
    return {
      eligible: false,
      reasonCode: 'RESTRICTED',
      message: student.restriction_reason.trim(),
    };
  }

  if (
    student.active_loans_count >= student.max_borrowing_limit ||
    student.remaining_capacity <= 0
  ) {
    return {
      eligible: false,
      reasonCode: 'LIMIT_REACHED',
      message: `Borrowing limit reached (${student.active_loans_count} / ${student.max_borrowing_limit}). Return an active book before issuing another.`,
    };
  }

  if (selectedBookId && student.active_book_ids.includes(selectedBookId)) {
    return {
      eligible: false,
      reasonCode: 'ALREADY_BORROWED',
      message: 'Student already has this book currently borrowed on an active loan.',
    };
  }

  if (selectedBookId) {
    const queueCheck = checkBookReservationConflict({
      studentId: student.student_id,
      bookId: selectedBookId,
      copies,
      reservations,
    });
    if (!queueCheck.allowed) {
      return {
        eligible: false,
        reasonCode: 'RESERVATION_CONFLICT',
        message: queueCheck.message,
      };
    }
  }

  return {
    eligible: true,
    reasonCode: 'ELIGIBLE',
    message: 'Eligible for borrowing',
  };
}

export function getEligibleCopiesForIssue(params: {
  bookId: number;
  studentId: number;
  copies: InventoryPhysicalCopy[];
  reservations: CirculationReservationRecord[];
}): InventoryPhysicalCopy[] {
  const bookCopies = params.copies.filter((c) => c.book_id === params.bookId);
  const queueCheck = checkBookReservationConflict({
    studentId: params.studentId,
    bookId: params.bookId,
    copies: params.copies,
    reservations: params.reservations,
  });

  if (!queueCheck.allowed) {
    return [];
  }

  return bookCopies.filter((copy) => {
    if (copy.status === 'Available') return true;
    if (copy.status === 'Reserved' && queueCheck.status === 'entitled_hold') return true;
    return false;
  });
}

export function findCopyByScanIdentifier(
  scanCode: string,
  copies: InventoryPhysicalCopy[],
  books: InventoryBookItem[]
): { copy: InventoryPhysicalCopy; book: InventoryBookItem } | null {
  const clean = scanCode.trim().toUpperCase();
  if (!clean) return null;

  const matchedCopy = copies.find(
    (c) =>
      c.accession_number.trim().toUpperCase() === clean ||
      (c.barcode ? c.barcode.trim().toUpperCase() === clean : false) ||
      String(c.copy_id) === clean
  );
  if (!matchedCopy) return null;

  const matchedBook = books.find((b) => b.book_id === matchedCopy.book_id);
  if (!matchedBook) return null;

  return { copy: matchedCopy, book: matchedBook };
}

export function calculatePolicyDueDatePreview(
  serverReferenceIso: string,
  durationDays: number
): string {
  const base = new Date(serverReferenceIso);
  if (Number.isNaN(base.getTime())) {
    return '';
  }
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + durationDays);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function computeBorrowingLoanMetrics(
  borrowing: Pick<ActiveBorrowingDetail, 'issue_date' | 'due_date' | 'status'>,
  serverReferenceIso: string,
  policy: Pick<
    CirculationPolicy,
    'fine_policy_enabled' | 'fine_per_day_amount' | 'fine_currency_symbol'
  >
): {
  daysBorrowed: number;
  daysOverdue: number;
  displayStatus: ActiveBorrowingDisplayStatus;
  fineApplicable: boolean;
  fineAmount: number | null;
  fineSummaryLabel: string;
} {
  const refDate = new Date(serverReferenceIso);
  const issueParsed = new Date(borrowing.issue_date);
  const daysBorrowed =
    Number.isNaN(issueParsed.getTime()) || Number.isNaN(refDate.getTime())
      ? 0
      : Math.max(
          0,
          Math.floor(
            (Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()) -
              Date.UTC(
                issueParsed.getFullYear(),
                issueParsed.getMonth(),
                issueParsed.getDate()
              )) /
              86_400_000
          )
        );

  const daysRemaining = getDaysRemaining(borrowing.due_date, refDate);
  const daysOverdue = daysRemaining < 0 ? Math.abs(daysRemaining) : 0;

  let displayStatus: ActiveBorrowingDisplayStatus = 'Active';
  if (daysOverdue > 0 || borrowing.status === 'Overdue') {
    displayStatus = 'Overdue';
  } else if (daysRemaining === 0) {
    displayStatus = 'Due Today';
  }

  if (daysOverdue === 0) {
    return {
      daysBorrowed,
      daysOverdue: 0,
      displayStatus,
      fineApplicable: false,
      fineAmount: null,
      fineSummaryLabel: 'No overdue penalty',
    };
  }

  if (policy.fine_policy_enabled && typeof policy.fine_per_day_amount === 'number') {
    const computedFine = Number((daysOverdue * policy.fine_per_day_amount).toFixed(2));
    return {
      daysBorrowed,
      daysOverdue,
      displayStatus: 'Overdue',
      fineApplicable: computedFine > 0,
      fineAmount: computedFine,
      fineSummaryLabel: `${policy.fine_currency_symbol}${computedFine}`,
    };
  }

  return {
    daysBorrowed,
    daysOverdue,
    displayStatus: 'Overdue',
    fineApplicable: false,
    fineAmount: null,
    fineSummaryLabel: 'Overdue — follow library policy',
  };
}

export function deriveCopyStatusAfterReturn(params: {
  condition: ReturnCopyCondition;
  sendDamagedToRepair?: boolean;
  bookId: number;
  activeReservations: CirculationReservationRecord[];
}): {
  nextCopyStatus: CopyStatus;
  matchedWaitingReservation: CirculationReservationRecord | null;
  statusExplanation: string;
} {
  if (params.condition === 'Lost') {
    return {
      nextCopyStatus: 'Lost',
      matchedWaitingReservation: null,
      statusExplanation: 'Copy marked Lost and removed from active shelf circulation.',
    };
  }

  if (params.condition === 'Damaged') {
    const nextCopyStatus: CopyStatus = params.sendDamagedToRepair ? 'Under Repair' : 'Damaged';
    return {
      nextCopyStatus,
      matchedWaitingReservation: null,
      statusExplanation:
        nextCopyStatus === 'Under Repair'
          ? 'Copy routed to Under Repair pending restoration before holding reservations.'
          : 'Copy marked Damaged and held from circulation pending inspection.',
    };
  }

  const waiting = params.activeReservations
    .filter((r) => r.book_id === params.bookId && r.status === 'Waiting')
    .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999));

  if (waiting.length > 0) {
    const nextHolder = waiting[0];
    return {
      nextCopyStatus: 'Reserved',
      matchedWaitingReservation: nextHolder,
      statusExplanation: `Active reservation queue detected: copy will be held (Reserved) for ${nextHolder.student_name} (${nextHolder.student_code}).`,
    };
  }

  return {
    nextCopyStatus: 'Available',
    matchedWaitingReservation: null,
    statusExplanation: 'No waiting reservations: copy transitions from Issued to Available.',
  };
}

export function validateIssueSubmissionReadiness(params: {
  student: CirculationStudentRecord | null;
  book: InventoryBookItem | null;
  copy: InventoryPhysicalCopy | null;
  copies: InventoryPhysicalCopy[];
  reservations: CirculationReservationRecord[];
}): { valid: boolean; error?: string } {
  if (!params.student) {
    return { valid: false, error: 'Select an eligible student before confirming issue.' };
  }
  if (!params.book) {
    return { valid: false, error: 'Select a library book before confirming issue.' };
  }
  if (!params.copy) {
    return { valid: false, error: 'Select one eligible physical book copy.' };
  }
  if (params.copy.book_id !== params.book.book_id) {
    return { valid: false, error: 'Selected physical copy does not belong to the chosen book.' };
  }

  const eligibility = evaluateStudentEligibility({
    student: params.student,
    selectedBookId: params.book.book_id,
    copies: params.copies,
    reservations: params.reservations,
  });

  if (!eligibility.eligible) {
    return { valid: false, error: eligibility.message };
  }

  const queueCheck = checkBookReservationConflict({
    studentId: params.student.student_id,
    bookId: params.book.book_id,
    copies: params.copies,
    reservations: params.reservations,
  });

  if (!queueCheck.allowed) {
    return { valid: false, error: queueCheck.message };
  }

  const copyIsAssignable =
    params.copy.status === 'Available' ||
    (params.copy.status === 'Reserved' && queueCheck.status === 'entitled_hold');

  if (!copyIsAssignable) {
    return {
      valid: false,
      error: 'This copy is no longer available. Please select another copy.',
    };
  }

  return { valid: true };
}

export function validateReturnSubmissionReadiness(params: {
  borrowing: ActiveBorrowingDetail | null;
  condition: ReturnCopyCondition;
  conditionNotes: string;
}): { valid: boolean; error?: string } {
  if (!params.borrowing) {
    return { valid: false, error: 'Select an active borrowing record to process return.' };
  }
  if (params.borrowing.status === 'Returned') {
    return { valid: false, error: 'This borrowing transaction has already been returned.' };
  }
  if (params.condition === 'Damaged' && params.conditionNotes.trim().length < 4) {
    return {
      valid: false,
      error: 'Enter brief Condition Notes describing the damage (e.g. "Cover damaged").',
    };
  }
  return { valid: true };
}

export function mapCirculationApiError(status: number, rawMessage?: string | null): string {
  const msg = rawMessage?.trim();
  if (status === 401) {
    return 'Your librarian session expired. Sign in again to process circulation transactions.';
  }
  if (status === 403) {
    return msg || 'Your staff role is not authorized to perform this circulation action.';
  }
  if (status === 404) {
    return msg || 'Requested student, book, physical copy, or borrowing record was not found.';
  }
  if (status === 409) {
    return msg || 'This copy is no longer available. Please select another copy.';
  }
  if (status === 422 || status === 400) {
    return msg || 'Backend circulation validation blocked this transaction.';
  }
  if (status >= 500) {
    return (
      msg ||
      'A server error interrupted the circulation transaction. The database rolled back without partial changes.'
    );
  }
  return msg || `Circulation request failed (${status}).`;
}

export interface SampleCirculationStore {
  policy: CirculationPolicy;
  students: CirculationStudentRecord[];
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  reservations: CirculationReservationRecord[];
  borrowings: ActiveBorrowingDetail[];
}

export function createSampleCirculationStore(
  referenceDate: Date = new Date()
): SampleCirculationStore {
  const inventoryStore = createSampleInventoryStore();
  const dashboardBundles = createSampleLibrarianDashboardBundles(referenceDate);
  const allCopies = Object.values(inventoryStore.copiesByBookId).flat();

  // Align active copy accession/status links with sample borrowings clearly
  const students: CirculationStudentRecord[] = [
    {
      student_id: 1042,
      student_code: 'STU-2026-042',
      roll_number: 'CS26-042',
      full_name: 'Ananya Verma',
      email: 'ananya.verma@university.edu',
      department: 'Computer Science & Engineering',
      program: 'B.Tech CSE · Semester 6',
      account_status: 'Active',
      active_loans_count: 1,
      due_soon_count: 0,
      overdue_count: 1,
      max_borrowing_limit: 5,
      remaining_capacity: 4,
      active_book_ids: [3],
      restriction_reason: null,
    },
    {
      student_id: 1089,
      student_code: 'STU-2026-089',
      roll_number: 'AI26-089',
      full_name: 'Rohan Kulkarni',
      email: 'rohan.kulkarni@university.edu',
      department: 'Artificial Intelligence & Data Science',
      program: 'B.Tech AI · Semester 4',
      account_status: 'Active',
      active_loans_count: 1,
      due_soon_count: 1,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 4,
      active_book_ids: [5],
      restriction_reason: null,
    },
    {
      student_id: 1114,
      student_code: 'STU-2026-114',
      roll_number: 'CS26-114',
      full_name: 'Meera Iyer',
      email: 'meera.iyer@university.edu',
      department: 'Computer Science & Engineering',
      program: 'M.Tech AI · Semester 2',
      account_status: 'Active',
      active_loans_count: 5,
      due_soon_count: 1,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 0,
      active_book_ids: [1],
      restriction_reason: null,
    },
    {
      student_id: 1150,
      student_code: 'STU-2026-150',
      roll_number: 'SE26-150',
      full_name: 'Kabir Sharma',
      email: 'kabir.sharma@university.edu',
      department: 'Software Engineering',
      program: 'B.Tech SE · Semester 5',
      account_status: 'Active',
      active_loans_count: 1,
      due_soon_count: 0,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 4,
      active_book_ids: [2],
      restriction_reason: null,
    },
    {
      student_id: 1063,
      student_code: 'STU-2026-063',
      roll_number: 'DS26-063',
      full_name: 'Arjun Menon',
      email: 'arjun.menon@university.edu',
      department: 'Data Science',
      program: 'B.Sc Data Science · Semester 4',
      account_status: 'Active',
      active_loans_count: 0,
      due_soon_count: 0,
      overdue_count: 0,
      max_borrowing_limit: 5,
      remaining_capacity: 5,
      active_book_ids: [],
      restriction_reason: null,
    },
    {
      student_id: 1198,
      student_code: 'STU-2026-198',
      roll_number: 'PSY26-198',
      full_name: 'Siddharth Rao',
      email: 'siddharth.rao@university.edu',
      department: 'Cognitive & Behavioural Sciences',
      program: 'B.A. Psychology · Semester 4',
      account_status: 'Blocked',
      active_loans_count: 2,
      due_soon_count: 0,
      overdue_count: 2,
      max_borrowing_limit: 5,
      remaining_capacity: 3,
      active_book_ids: [],
      restriction_reason: 'Account currently blocked pending resolution of long-overdue items.',
    },
  ];

  const reservations: CirculationReservationRecord[] = [
    {
      reservation_id: 6201,
      book_id: 5,
      book_title: DEMO_BOOKS[4].title,
      student_id: 1127,
      student_name: 'Neha Deshmukh',
      student_code: 'STU-2026-127',
      queue_position: 1,
      status: 'Expiring Soon',
      created_at: dashboardBundles.reservations.items[0]?.reservation_date ?? '2026-11-11',
      expires_at: null,
    },
    {
      reservation_id: 6202,
      book_id: 3,
      book_title: DEMO_BOOKS[2].title,
      student_id: 1063,
      student_name: 'Arjun Menon',
      student_code: 'STU-2026-063',
      queue_position: 1,
      status: 'Ready for Pickup',
      created_at: dashboardBundles.reservations.items[1]?.reservation_date ?? '2026-11-12',
      expires_at: null,
    },
    {
      reservation_id: 6203,
      book_id: 5,
      book_title: DEMO_BOOKS[4].title,
      student_id: 1198,
      student_name: 'Siddharth Rao',
      student_code: 'STU-2026-198',
      queue_position: 2,
      status: 'Waiting',
      created_at: dashboardBundles.reservations.items[2]?.reservation_date ?? '2026-11-13',
      expires_at: null,
    },
  ];

  const borrowings: ActiveBorrowingDetail[] = dashboardBundles.recentBorrowings.items.map(
    (b) => {
      const book =
        inventoryStore.books.find((item) => item.book_id === b.book_id) ??
        inventoryStore.books[0];
      const student = students.find((s) => s.student_id === b.student_id);
      const matchedCopy =
        allCopies.find(
          (c) =>
            c.book_id === b.book_id &&
            (c.current_borrower_code === b.student_code || c.status === 'Issued')
        ) ??
        allCopies.find((c) => c.book_id === b.book_id) ??
        allCopies[0];

      return {
        borrowing_id: b.borrowing_id,
        transaction_code: b.transaction_code,
        student_id: b.student_id,
        student_name: b.student_name,
        student_code: b.student_code,
        student_email: student?.email ?? `${b.student_code.toLowerCase()}@university.edu`,
        student_department: student?.department ?? 'Academic Department',
        student_account_status: student?.account_status ?? 'Active',
        book_id: b.book_id,
        book_title: book.title,
        book_author: book.authors,
        book_isbn: book.isbn,
        book_cover: book.cover_image,
        copy_id: matchedCopy.copy_id,
        accession_number: matchedCopy.accession_number,
        barcode: matchedCopy.barcode,
        shelf_location: `${book.branch} · ${book.floor} · ${book.shelf}`,
        copy_condition: matchedCopy.condition,
        copy_status: b.status === 'Returned' ? 'Available' : 'Issued',
        issue_date: b.issue_date,
        due_date: b.due_date,
        return_date: b.return_date,
        status: b.status,
      };
    }
  );

  return {
    policy: {
      default_loan_duration_days: 7,
      reservation_pickup_window_hours: 48,
      fine_policy_enabled: false,
      fine_per_day_amount: null,
      fine_currency_symbol: '₹',
      supports_email_notifications: false,
      supports_barcodes: true,
      server_reference_iso: referenceDate.toISOString(),
    },
    students,
    books: inventoryStore.books,
    copies: allCopies,
    reservations,
    borrowings,
  };
}

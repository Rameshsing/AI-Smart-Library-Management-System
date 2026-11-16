import { createSampleAnnouncementsStore, type LibraryAnnouncementItem } from './librarianAnnouncements';
import {
  createSampleCirculationStore,
  type ActiveBorrowingDetail,
  type CirculationPolicy,
} from './librarianCirculation';
import {
  createSampleInventoryStore,
  type InventoryBookItem,
  type InventoryPhysicalCopy,
} from './librarianInventory';
import {
  createSampleOverdueStore,
  type OverdueRecordItem,
} from './librarianOverdue';
import {
  createSampleReportsSourceDataset,
  type ReportsSourceDataset,
} from './librarianReports';
import {
  createSampleReservationsStore,
  type LibrarianReservationItem,
} from './librarianReservations';
import {
  createSampleStudentRecordsStore,
  type LibrarianStudentDirectoryItem,
} from './librarianStudents';
import type { AdminPermissions, AdminProfile } from './adminDashboard';

export type StaffRole = 'admin' | 'librarian';
export type StaffAccountStatus = 'Active' | 'Inactive' | 'Suspended';
export type StaffSortKey = 'name_asc' | 'name_desc' | 'created_desc' | 'role_asc';

export interface StaffAccountRecord {
  staff_id: number;
  staff_code: string;
  full_name: string;
  email: string;
  mobile_number: string;
  designation: string;
  branch: string;
  role: StaffRole;
  status: StaffAccountStatus;
  joining_date: string;
  created_at: string;
  invitation_pending: boolean;
  invitation_sent_at: string | null;
  must_change_password: boolean;
}

export interface CreateStaffInput {
  full_name: string;
  staff_code: string;
  email: string;
  mobile_number: string;
  designation: string;
  branch: string;
  role: StaffRole;
  onboarding_mode: 'invitation' | 'temporary_password';
  temporary_password?: string;
}

export interface CreateStaffValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CreateStaffInput | 'general', string>>;
}

export interface EditStaffInput {
  full_name: string;
  email: string;
  mobile_number: string;
  designation: string;
  branch: string;
  role: StaffRole;
}

export interface CatalogCategoryRecord {
  category_id: number;
  name: string;
  description: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface CatalogSubjectRecord {
  subject_id: number;
  name: string;
  code: string;
  description: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface LibraryBranchRecord {
  branch_id: number;
  name: string;
  code: string;
  address: string;
  contact_info: string;
  status: 'Active' | 'Inactive';
  created_at: string;
  updated_at: string;
}

export interface LibraryPolicySettings {
  loan_policy: {
    default_loan_duration_days: number;
    max_active_loans_per_student: number;
    allow_renewal: boolean;
    max_renewals_per_loan: number;
    renewal_extension_days: number;
  };
  reminder_policy: {
    days_before_due_reminder: number;
    send_due_date_reminder: boolean;
    overdue_reminder_frequency_days: number;
    in_app_notifications_enabled: boolean;
    email_notifications_enabled: boolean;
  };
  reservation_policy: {
    reservations_enabled: boolean;
    max_active_reservations_per_student: number;
    pickup_window_hours: number;
    expiry_behavior: 'auto_expire_and_advance_queue' | 'auto_expire_and_release_copy';
  };
  fine_policy: {
    fine_policy_enabled: boolean;
    fine_per_day_amount: number | null;
    grace_period_days: number;
    fine_currency_symbol: string;
  };
  general_settings: {
    library_name: string;
    contact_email: string;
    contact_phone: string;
    opening_hours: string;
    address: string;
  };
  updated_at: string;
  updated_by: string;
}

export type PermissionKey =
  | 'view_catalog'
  | 'borrow_reserve'
  | 'manage_own_profile'
  | 'manage_inventory'
  | 'issue_return_books'
  | 'manage_reservations'
  | 'view_student_records'
  | 'manage_announcements'
  | 'view_reports'
  | 'manage_users'
  | 'manage_staff'
  | 'manage_taxonomy'
  | 'manage_branches'
  | 'configure_settings'
  | 'manage_roles'
  | 'view_audit_logs';

export interface RolePermissionItem {
  key: PermissionKey;
  label: string;
  category: 'Student' | 'Circulation & Inventory' | 'Administration';
  description: string;
}

export interface RolePermissionDefinition {
  role_key: 'admin' | 'librarian' | 'student';
  display_name: string;
  description: string;
  permissions: Record<PermissionKey, boolean>;
  updated_at: string;
}

export interface AdminAuditLogEntry {
  log_id: string;
  actor_id: number;
  actor_name: string;
  actor_role: 'admin' | 'librarian';
  action: string;
  entity_type:
    | 'staff'
    | 'student'
    | 'category'
    | 'subject'
    | 'branch'
    | 'settings'
    | 'role'
    | 'profile';
  entity_id: string;
  entity_label: string;
  timestamp: string;
  details: string;
  result: 'Success' | 'Blocked' | 'Failed';
}

export interface AdminWorkspaceStore {
  adminProfile: AdminProfile;
  staff: StaffAccountRecord[];
  students: LibrarianStudentDirectoryItem[];
  books: InventoryBookItem[];
  copies: InventoryPhysicalCopy[];
  categories: CatalogCategoryRecord[];
  subjects: CatalogSubjectRecord[];
  branches: LibraryBranchRecord[];
  activeBorrowings: ActiveBorrowingDetail[];
  returnedHistoryCount: number;
  overdueRecords: OverdueRecordItem[];
  reservations: LibrarianReservationItem[];
  announcements: LibraryAnnouncementItem[];
  reportsDataset: ReportsSourceDataset;
  circulationPolicy: CirculationPolicy;
  librarySettings: LibraryPolicySettings;
  roles: RolePermissionDefinition[];
  auditLogs: AdminAuditLogEntry[];
}

export const PERMISSION_CATALOG: RolePermissionItem[] = [
  {
    key: 'view_catalog',
    label: 'Browse & Search Catalog',
    category: 'Student',
    description: 'Search titles, inspect availability, and view book detail pages.',
  },
  {
    key: 'borrow_reserve',
    label: 'Reservations & Recommendations',
    category: 'Student',
    description: 'Reserve unavailable books and receive personalized AI recommendations.',
  },
  {
    key: 'manage_own_profile',
    label: 'Manage Own Profile',
    category: 'Student',
    description: 'Update personal academic preferences, reading interests, and password.',
  },
  {
    key: 'manage_inventory',
    label: 'Manage Inventory & Copies',
    category: 'Circulation & Inventory',
    description: 'Add, edit, archive titles and manage physical copy records.',
  },
  {
    key: 'issue_return_books',
    label: 'Issue & Return Books',
    category: 'Circulation & Inventory',
    description: 'Process student checkouts, returns, and copy condition updates.',
  },
  {
    key: 'manage_reservations',
    label: 'Manage Reservation Queue',
    category: 'Circulation & Inventory',
    description: 'Mark holds ready for pickup, fulfill holds, or expire unclaimed queues.',
  },
  {
    key: 'view_student_records',
    label: 'View Student Circulation Records',
    category: 'Circulation & Inventory',
    description: 'Inspect student borrowing eligibility, overdue history, and holds.',
  },
  {
    key: 'manage_announcements',
    label: 'Publish Library Announcements',
    category: 'Circulation & Inventory',
    description: 'Create, schedule, and publish student notices.',
  },
  {
    key: 'view_reports',
    label: 'View Reports & Analytics',
    category: 'Circulation & Inventory',
    description: 'Access operational analytics and export library CSV/print reports.',
  },
  {
    key: 'manage_users',
    label: 'Manage Student Accounts',
    category: 'Administration',
    description: 'Edit student records, activate/deactivate accounts, and review eligibility.',
  },
  {
    key: 'manage_staff',
    label: 'Manage Librarian & Staff Accounts',
    category: 'Administration',
    description: 'Provision librarian accounts, update roles, and revoke/reset staff access.',
  },
  {
    key: 'manage_taxonomy',
    label: 'Manage Categories & Subjects',
    category: 'Administration',
    description: 'Create, update, and activate/deactivate catalog classifications.',
  },
  {
    key: 'manage_branches',
    label: 'Manage Library Branches',
    category: 'Administration',
    description: 'Configure library campus branches, codes, addresses, and contact info.',
  },
  {
    key: 'configure_settings',
    label: 'Configure Library Policies',
    category: 'Administration',
    description: 'Set loan duration, max active loans, reminder cadence, and reservation rules.',
  },
  {
    key: 'manage_roles',
    label: 'Manage Roles & Permissions',
    category: 'Administration',
    description: 'Review and govern role permission scopes safely.',
  },
  {
    key: 'view_audit_logs',
    label: 'View Audit Trail',
    category: 'Administration',
    description: 'Inspect administrative and security activity logs.',
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+\d][\d\s()-]{6,20}$/;

const SENSITIVE_LOG_KEY_PATTERN =
  /\b(password|password_hash|token|secret|auth_token|session_secret)\s*[:=]\s*[^\s,;]+/gi;

export function sanitizeAuditDetails(raw: string): string {
  return raw
    .replace(SENSITIVE_LOG_KEY_PATTERN, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .trim();
}

export function createAuditLogEntry(
  actor: { id: number; name: string; role: 'admin' | 'librarian' },
  input: Omit<AdminAuditLogEntry, 'log_id' | 'actor_id' | 'actor_name' | 'actor_role' | 'timestamp'> & {
    timestamp?: string;
  }
): AdminAuditLogEntry {
  const ts = input.timestamp ?? new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return {
    log_id: `AUD-${Date.now().toString(36).toUpperCase()}-${suffix}`,
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    entity_label: input.entity_label,
    timestamp: ts,
    details: sanitizeAuditDetails(input.details),
    result: input.result,
  };
}

export function createDefaultAdminProfile(): AdminProfile {
  const permissions: AdminPermissions = {
    can_manage_users: true,
    can_manage_staff: true,
    can_manage_roles: true,
    can_manage_catalog_taxonomy: true,
    can_manage_branches: true,
    can_configure_settings: true,
    can_view_audit_logs: true,
    can_manage_inventory: true,
    can_view_reports: true,
  };

  return {
    admin_id: 901,
    user_id: 9001,
    staff_code: 'ADM-001',
    full_name: 'Dr. Arvind Mehta',
    email: 'arvind.mehta@smartlibrary.edu',
    mobile_number: '+1 (555) 204-8810',
    designation: 'Chief Library Systems Administrator',
    branch: 'Main Central Library',
    joining_date: '2021-08-15',
    role: 'admin',
    account_status: 'Active',
    avatar_url: null,
    permissions,
  };
}

export function createInitialAdminWorkspaceStore(
  referenceDate: Date = new Date()
): AdminWorkspaceStore {
  const adminProfile = createDefaultAdminProfile();
  const inventoryStore = createSampleInventoryStore();
  const allCopies: InventoryPhysicalCopy[] = Object.values(
    inventoryStore.copiesByBookId
  ).flat();
  const circulationStore = createSampleCirculationStore(referenceDate);
  const reservationsStore = createSampleReservationsStore(referenceDate);
  const overdueStore = createSampleOverdueStore(referenceDate);
  const studentRecordsStore = createSampleStudentRecordsStore(referenceDate);
  const announcementsStore = createSampleAnnouncementsStore(referenceDate);
  const reportsDataset = createSampleReportsSourceDataset(referenceDate);

  const uniqueCategories = Array.from(
    new Set(inventoryStore.books.map((b) => b.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const categories: CatalogCategoryRecord[] = uniqueCategories.map((name, idx) => ({
    category_id: idx + 1,
    name,
    description: `${name} collection titles and academic reference materials.`,
    status: 'Active',
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  }));

  const uniqueSubjects = Array.from(
    new Set(inventoryStore.books.map((b) => b.subject).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const subjects: CatalogSubjectRecord[] = uniqueSubjects.map((name, idx) => {
    const letters = name
      .replace(/[^A-Za-z\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 4);
    const code = `${letters || 'SUBJ'}-${String(101 + idx)}`;
    return {
      subject_id: idx + 1,
      name,
      code,
      description: `Subject taxonomy covering ${name} coursework and research texts.`,
      status: 'Active',
      created_at: '2024-01-15T09:00:00Z',
      updated_at: '2025-01-10T09:00:00Z',
    };
  });

  const branchAddressMap: Record<string, { code: string; address: string; contact: string }> = {
    'Central Library': {
      code: 'CL-01',
      address: 'Academic Quadrangle North, Building A, University Campus',
      contact: 'central-desk@smartlibrary.edu · +1 (555) 204-8800',
    },
    'Main Central Library': {
      code: 'MCL-01',
      address: 'Academic Quadrangle North, Building A, University Campus',
      contact: 'central-desk@smartlibrary.edu · +1 (555) 204-8800',
    },
    'Engineering Library': {
      code: 'ENG-02',
      address: 'Innovation & Engineering Complex, Level 2, East Wing',
      contact: 'eng-library@smartlibrary.edu · +1 (555) 204-8822',
    },
    'Science & Research Wing': {
      code: 'SCI-03',
      address: 'Sciences Tower, Mezzanine & Floor 1, South Campus',
      contact: 'science-library@smartlibrary.edu · +1 (555) 204-8844',
    },
  };

  const uniqueBranches = Array.from(
    new Set([
      ...inventoryStore.books.map((b) => b.branch).filter(Boolean),
      'Main Central Library',
      'Engineering Library',
    ])
  ).sort((a, b) => a.localeCompare(b));

  const branches: LibraryBranchRecord[] = uniqueBranches.map((name, idx) => {
    const known = branchAddressMap[name];
    return {
      branch_id: idx + 1,
      name,
      code:
        known?.code ??
        `${name
          .replace(/[^A-Za-z]/g, '')
          .slice(0, 3)
          .toUpperCase()}-${String(idx + 1).padStart(2, '0')}`,
      address: known?.address ?? `${name} Campus Reading Hall`,
      contact_info: known?.contact ?? 'library-desk@smartlibrary.edu',
      status: 'Active',
      created_at: '2024-01-10T08:30:00Z',
      updated_at: '2025-01-05T10:00:00Z',
    };
  });

  const staff: StaffAccountRecord[] = [
    {
      staff_id: 901,
      staff_code: adminProfile.staff_code,
      full_name: adminProfile.full_name,
      email: adminProfile.email,
      mobile_number: adminProfile.mobile_number,
      designation: adminProfile.designation,
      branch: adminProfile.branch,
      role: 'admin',
      status: 'Active',
      joining_date: adminProfile.joining_date,
      created_at: '2021-08-15T09:00:00Z',
      invitation_pending: false,
      invitation_sent_at: null,
      must_change_password: false,
    },
    {
      staff_id: 201,
      staff_code: 'LIB-104',
      full_name: 'Dr. Priya Nair',
      email: 'priya.nair@smartlibrary.edu',
      mobile_number: '+1 (555) 204-8814',
      designation: 'Senior Head Librarian',
      branch: 'Main Central Library',
      role: 'librarian',
      status: 'Active',
      joining_date: '2022-03-10',
      created_at: '2022-03-10T09:00:00Z',
      invitation_pending: false,
      invitation_sent_at: null,
      must_change_password: false,
    },
    {
      staff_id: 202,
      staff_code: 'LIB-108',
      full_name: 'Rohan Kulkarni',
      email: 'rohan.kulkarni@smartlibrary.edu',
      mobile_number: '+1 (555) 204-8829',
      designation: 'Circulation & Acquisitions Librarian',
      branch: 'Engineering Library',
      role: 'librarian',
      status: 'Active',
      joining_date: '2023-07-01',
      created_at: '2023-07-01T09:00:00Z',
      invitation_pending: false,
      invitation_sent_at: null,
      must_change_password: false,
    },
    {
      staff_id: 203,
      staff_code: 'LIB-112',
      full_name: 'Meera Iyer',
      email: 'meera.iyer@smartlibrary.edu',
      mobile_number: '+1 (555) 204-8851',
      designation: 'Cataloging Assistant Librarian',
      branch: 'Main Central Library',
      role: 'librarian',
      status: 'Inactive',
      joining_date: '2023-01-12',
      created_at: '2023-01-12T09:00:00Z',
      invitation_pending: false,
      invitation_sent_at: null,
      must_change_password: false,
    },
  ];

  const circulationPolicy = circulationStore.policy;
  const librarySettings: LibraryPolicySettings = {
    loan_policy: {
      default_loan_duration_days: circulationPolicy.default_loan_duration_days,
      max_active_loans_per_student: 5,
      allow_renewal: true,
      max_renewals_per_loan: 2,
      renewal_extension_days: 7,
    },
    reminder_policy: {
      days_before_due_reminder: 2,
      send_due_date_reminder: true,
      overdue_reminder_frequency_days: 2,
      in_app_notifications_enabled: true,
      email_notifications_enabled: circulationPolicy.supports_email_notifications,
    },
    reservation_policy: {
      reservations_enabled: true,
      max_active_reservations_per_student: 3,
      pickup_window_hours: circulationPolicy.reservation_pickup_window_hours,
      expiry_behavior: 'auto_expire_and_advance_queue',
    },
    fine_policy: {
      fine_policy_enabled: circulationPolicy.fine_policy_enabled,
      fine_per_day_amount: circulationPolicy.fine_per_day_amount,
      grace_period_days: 1,
      fine_currency_symbol: circulationPolicy.fine_currency_symbol || '$',
    },
    general_settings: {
      library_name: 'University AI Smart Central Library',
      contact_email: 'library-admin@smartlibrary.edu',
      contact_phone: '+1 (555) 204-8800',
      opening_hours: 'Mon–Sat 08:00 AM – 09:00 PM · Sun 10:00 AM – 05:00 PM',
      address: 'Academic Quadrangle North, Building A, University Campus',
    },
    updated_at: referenceDate.toISOString(),
    updated_by: adminProfile.full_name,
  };

  const roles: RolePermissionDefinition[] = [
    {
      role_key: 'admin',
      display_name: 'Administrator',
      description:
        'Full governance over system users, staff provisioning, catalog taxonomy, branches, policies, and audit trails.',
      updated_at: '2025-01-10T09:00:00Z',
      permissions: {
        view_catalog: true,
        borrow_reserve: false,
        manage_own_profile: true,
        manage_inventory: true,
        issue_return_books: true,
        manage_reservations: true,
        view_student_records: true,
        manage_announcements: true,
        view_reports: true,
        manage_users: true,
        manage_staff: true,
        manage_taxonomy: true,
        manage_branches: true,
        configure_settings: true,
        manage_roles: true,
        view_audit_logs: true,
      },
    },
    {
      role_key: 'librarian',
      display_name: 'Librarian',
      description:
        'Daily operational access to book inventory, issue/return circulation, reservation queues, overdue tracking, and announcements.',
      updated_at: '2025-01-10T09:00:00Z',
      permissions: {
        view_catalog: true,
        borrow_reserve: false,
        manage_own_profile: true,
        manage_inventory: true,
        issue_return_books: true,
        manage_reservations: true,
        view_student_records: true,
        manage_announcements: true,
        view_reports: true,
        manage_users: false,
        manage_staff: false,
        manage_taxonomy: false,
        manage_branches: false,
        configure_settings: false,
        manage_roles: false,
        view_audit_logs: false,
      },
    },
    {
      role_key: 'student',
      display_name: 'Student',
      description:
        'Reader access to catalog search, personalized recommendations, borrowing history, reservation requests, and personal preferences.',
      updated_at: '2025-01-10T09:00:00Z',
      permissions: {
        view_catalog: true,
        borrow_reserve: true,
        manage_own_profile: true,
        manage_inventory: false,
        issue_return_books: false,
        manage_reservations: false,
        view_student_records: false,
        manage_announcements: false,
        view_reports: false,
        manage_users: false,
        manage_staff: false,
        manage_taxonomy: false,
        manage_branches: false,
        configure_settings: false,
        manage_roles: false,
        view_audit_logs: false,
      },
    },
  ];

  const auditLogs: AdminAuditLogEntry[] = [];

  return {
    adminProfile,
    staff,
    students: studentRecordsStore.students,
    books: inventoryStore.books,
    copies: allCopies,
    categories,
    subjects,
    branches,
    activeBorrowings: circulationStore.borrowings,
    returnedHistoryCount: reportsDataset.borrowings.filter((b) => b.status === 'Returned').length,
    overdueRecords: overdueStore.records,
    reservations: reservationsStore.items,
    announcements: announcementsStore.items,
    reportsDataset,
    circulationPolicy,
    librarySettings,
    roles,
    auditLogs,
  };
}

export function validateCreateStaffInput(
  input: CreateStaffInput,
  existingStaff: StaffAccountRecord[]
): CreateStaffValidationResult {
  const errors: CreateStaffValidationResult['errors'] = {};
  const cleanName = input.full_name.trim();
  const cleanCode = input.staff_code.trim().toUpperCase();
  const cleanEmail = input.email.trim().toLowerCase();
  const cleanDesignation = input.designation.trim();
  const cleanBranch = input.branch.trim();
  const cleanMobile = input.mobile_number.trim();

  if (cleanName.length < 3) {
    errors.full_name = 'Enter the staff member full name (at least 3 characters).';
  }
  if (!/^[A-Z]{2,6}-\d{2,6}$/.test(cleanCode)) {
    errors.staff_code = 'Enter a valid Staff ID format such as LIB-120 or ADM-002.';
  } else if (existingStaff.some((s) => s.staff_code.toUpperCase() === cleanCode)) {
    errors.staff_code = `Staff ID ${cleanCode} is already assigned.`;
  }

  if (!EMAIL_PATTERN.test(cleanEmail)) {
    errors.email = 'Enter a valid official email address.';
  } else if (existingStaff.some((s) => s.email.toLowerCase() === cleanEmail)) {
    errors.email = 'An account with this email address already exists.';
  }

  if (cleanMobile && !PHONE_PATTERN.test(cleanMobile)) {
    errors.mobile_number = 'Enter a valid contact phone number.';
  }
  if (cleanDesignation.length < 2) {
    errors.designation = 'Enter a staff designation or title.';
  }
  if (!cleanBranch) {
    errors.branch = 'Select a library branch assignment.';
  }

  if (input.onboarding_mode === 'temporary_password') {
    const pwd = input.temporary_password ?? '';
    const hasLength = pwd.length >= 10;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    if (!hasLength || !hasUpper || !hasLower || !hasNumber) {
      errors.temporary_password =
        'Temporary password must be at least 10 characters and include uppercase, lowercase, and numeric characters.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canDeactivateOrDemoteStaffMember(input: {
  targetStaff: StaffAccountRecord;
  currentAdminStaffId: number;
  allStaff: StaffAccountRecord[];
  nextStatus?: StaffAccountStatus;
  nextRole?: StaffRole;
}): { allowed: boolean; reason: string | null } {
  const { targetStaff, currentAdminStaffId, allStaff, nextStatus, nextRole } = input;
  const activeAdmins = allStaff.filter(
    (s) => s.role === 'admin' && s.status === 'Active'
  );

  const isTargetActiveAdmin =
    targetStaff.role === 'admin' && targetStaff.status === 'Active';

  if (targetStaff.staff_id === currentAdminStaffId) {
    if (nextStatus && nextStatus !== 'Active') {
      return {
        allowed: false,
        reason: 'You cannot deactivate or suspend your own active Administrator account.',
      };
    }
    if (nextRole && nextRole !== 'admin') {
      return {
        allowed: false,
        reason: 'Self-demotion is disabled to prevent losing administrative access.',
      };
    }
  }

  if (isTargetActiveAdmin && activeAdmins.length <= 1) {
    if ((nextStatus && nextStatus !== 'Active') || (nextRole && nextRole !== 'admin')) {
      return {
        allowed: false,
        reason:
          'At least one active Administrator must remain in the system. Assign another active Administrator first.',
      };
    }
  }

  return { allowed: true, reason: null };
}

export function filterAndPaginateStaff(
  staff: StaffAccountRecord[],
  criteria: {
    query: string;
    role: 'All' | StaffRole;
    branch: string;
    status: 'All' | StaffAccountStatus;
    sort: StaffSortKey;
  },
  page: number,
  pageSize: number
): {
  items: StaffAccountRecord[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const q = criteria.query.trim().toLowerCase();

  const filtered = staff
    .filter((member) => {
      if (criteria.role !== 'All' && member.role !== criteria.role) return false;
      if (criteria.branch !== 'All' && member.branch !== criteria.branch) return false;
      if (criteria.status !== 'All' && member.status !== criteria.status) return false;
      if (!q) return true;
      return (
        member.full_name.toLowerCase().includes(q) ||
        member.staff_code.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        member.designation.toLowerCase().includes(q) ||
        member.branch.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      switch (criteria.sort) {
        case 'name_asc':
          return a.full_name.localeCompare(b.full_name);
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name);
        case 'role_asc':
          return a.role.localeCompare(b.role) || a.full_name.localeCompare(b.full_name);
        case 'created_desc':
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function canDeleteStudentAccount(student: LibrarianStudentDirectoryItem): {
  allowed: boolean;
  reason: string | null;
} {
  if (
    student.active_loans_count > 0 ||
    student.active_reservations_count > 0 ||
    student.total_books_borrowed > 0
  ) {
    return {
      allowed: false,
      reason:
        'Students with active loans, reservations, or historical borrowings cannot be permanently deleted. Deactivate or suspend the account instead to preserve library audit integrity.',
    };
  }
  return { allowed: true, reason: null };
}

export function filterAndPaginateAdminStudents(
  students: LibrarianStudentDirectoryItem[],
  criteria: {
    query: string;
    department: string;
    course: string;
    academicYear: string;
    status: 'All' | 'Active' | 'Blocked' | 'Suspended';
  },
  page: number,
  pageSize: number
): {
  items: LibrarianStudentDirectoryItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const q = criteria.query.trim().toLowerCase();
  const filtered = students
    .filter((s) => {
      if (criteria.status !== 'All' && s.account_status !== criteria.status) return false;
      if (criteria.department !== 'All' && s.department !== criteria.department) return false;
      if (criteria.course !== 'All' && s.program !== criteria.course) return false;
      if (criteria.academicYear !== 'All' && s.academic_year !== criteria.academicYear) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.student_code.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.program.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

export function computeCategoryBookCounts(
  categories: CatalogCategoryRecord[],
  books: InventoryBookItem[]
): Array<CatalogCategoryRecord & { book_count: number }> {
  return categories.map((cat) => ({
    ...cat,
    book_count: books.filter(
      (b) => b.category.toLowerCase() === cat.name.toLowerCase()
    ).length,
  }));
}

export function computeSubjectBookCounts(
  subjects: CatalogSubjectRecord[],
  books: InventoryBookItem[]
): Array<CatalogSubjectRecord & { book_count: number }> {
  return subjects.map((subj) => ({
    ...subj,
    book_count: books.filter(
      (b) => b.subject.toLowerCase() === subj.name.toLowerCase()
    ).length,
  }));
}

export function computeBranchInventoryCounts(
  branches: LibraryBranchRecord[],
  books: InventoryBookItem[],
  copies: InventoryPhysicalCopy[]
): Array<LibraryBranchRecord & { book_count: number; copy_count: number }> {
  return branches.map((branch) => ({
    ...branch,
    book_count: books.filter(
      (b) => b.branch.toLowerCase() === branch.name.toLowerCase()
    ).length,
    copy_count: copies.filter(
      (c) => c.branch.toLowerCase() === branch.name.toLowerCase()
    ).length,
  }));
}

export function canDeleteTaxonomyRecord(input: {
  entityLabel: 'category' | 'subject' | 'branch';
  name: string;
  bookCount: number;
  copyCount?: number;
}): { allowed: boolean; reason: string | null } {
  if (input.bookCount > 0 || (input.copyCount ?? 0) > 0) {
    return {
      allowed: false,
      reason: `Cannot delete ${input.entityLabel} "${input.name}" because it is referenced by ${input.bookCount} catalog title${input.bookCount === 1 ? '' : 's'}. Deactivate it instead.`,
    };
  }
  return { allowed: true, reason: null };
}

export function validateLibrarySettings(
  settings: LibraryPolicySettings
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const { loan_policy, reminder_policy, reservation_policy, fine_policy, general_settings } =
    settings;

  if (
    !Number.isInteger(loan_policy.default_loan_duration_days) ||
    loan_policy.default_loan_duration_days < 1 ||
    loan_policy.default_loan_duration_days > 90
  ) {
    errors.default_loan_duration_days = 'Default loan duration must be between 1 and 90 days.';
  }

  if (
    !Number.isInteger(loan_policy.max_active_loans_per_student) ||
    loan_policy.max_active_loans_per_student < 1 ||
    loan_policy.max_active_loans_per_student > 20
  ) {
    errors.max_active_loans_per_student = 'Maximum active loans must be between 1 and 20 books.';
  }

  if (
    loan_policy.allow_renewal &&
    (!Number.isInteger(loan_policy.max_renewals_per_loan) ||
      loan_policy.max_renewals_per_loan < 1 ||
      loan_policy.max_renewals_per_loan > 5)
  ) {
    errors.max_renewals_per_loan = 'Maximum renewals must be between 1 and 5.';
  }

  if (
    !Number.isInteger(reminder_policy.days_before_due_reminder) ||
    reminder_policy.days_before_due_reminder < 0 ||
    reminder_policy.days_before_due_reminder > 14
  ) {
    errors.days_before_due_reminder = 'Days before due reminder must be between 0 and 14.';
  }

  if (
    !Number.isInteger(reminder_policy.overdue_reminder_frequency_days) ||
    reminder_policy.overdue_reminder_frequency_days < 1 ||
    reminder_policy.overdue_reminder_frequency_days > 30
  ) {
    errors.overdue_reminder_frequency_days =
      'Overdue reminder frequency must be between 1 and 30 days.';
  }

  if (
    !Number.isInteger(reservation_policy.max_active_reservations_per_student) ||
    reservation_policy.max_active_reservations_per_student < 1 ||
    reservation_policy.max_active_reservations_per_student > 10
  ) {
    errors.max_active_reservations_per_student =
      'Maximum active holds must be between 1 and 10.';
  }

  if (
    !Number.isInteger(reservation_policy.pickup_window_hours) ||
    reservation_policy.pickup_window_hours < 6 ||
    reservation_policy.pickup_window_hours > 168
  ) {
    errors.pickup_window_hours = 'Pickup window must be between 6 and 168 hours.';
  }

  if (fine_policy.fine_policy_enabled) {
    if (
      fine_policy.fine_per_day_amount === null ||
      Number.isNaN(fine_policy.fine_per_day_amount) ||
      fine_policy.fine_per_day_amount <= 0
    ) {
      errors.fine_per_day_amount =
        'Enter a positive daily overdue rate when the fine policy is enabled.';
    }
    if (
      !Number.isInteger(fine_policy.grace_period_days) ||
      fine_policy.grace_period_days < 0 ||
      fine_policy.grace_period_days > 14
    ) {
      errors.grace_period_days = 'Grace period must be between 0 and 14 days.';
    }
  }

  if (general_settings.library_name.trim().length < 3) {
    errors.library_name = 'Enter the library name.';
  }
  if (!EMAIL_PATTERN.test(general_settings.contact_email.trim())) {
    errors.contact_email = 'Enter a valid library contact email address.';
  }
  if (!general_settings.opening_hours.trim()) {
    errors.opening_hours = 'Enter standard library operating hours.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canUpdateRolePermission(input: {
  roleKey: 'admin' | 'librarian' | 'student';
  permissionKey: PermissionKey;
  nextValue: boolean;
}): { allowed: boolean; reason: string | null } {
  if (
    input.roleKey === 'admin' &&
    !input.nextValue &&
    (input.permissionKey === 'manage_staff' ||
      input.permissionKey === 'manage_roles' ||
      input.permissionKey === 'view_audit_logs' ||
      input.permissionKey === 'configure_settings')
  ) {
    return {
      allowed: false,
      reason:
        'Core Administrator governance permissions cannot be removed from the Administrator role to prevent system lockout.',
    };
  }

  if (
    input.roleKey === 'student' &&
    input.nextValue &&
    (input.permissionKey === 'manage_staff' ||
      input.permissionKey === 'manage_users' ||
      input.permissionKey === 'configure_settings' ||
      input.permissionKey === 'manage_roles' ||
      input.permissionKey === 'manage_inventory' ||
      input.permissionKey === 'issue_return_books' ||
      input.permissionKey === 'view_audit_logs')
  ) {
    return {
      allowed: false,
      reason:
        'Staff and administrative privileges cannot be granted to the Student role.',
    };
  }

  return { allowed: true, reason: null };
}

export function filterAndPaginateAuditLogs(
  logs: AdminAuditLogEntry[],
  criteria: {
    query: string;
    entityType: 'All' | AdminAuditLogEntry['entity_type'];
    result: 'All' | AdminAuditLogEntry['result'];
  },
  page: number,
  pageSize: number
): {
  items: AdminAuditLogEntry[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
} {
  const q = criteria.query.trim().toLowerCase();
  const filtered = logs
    .filter((entry) => {
      if (criteria.entityType !== 'All' && entry.entity_type !== criteria.entityType) {
        return false;
      }
      if (criteria.result !== 'All' && entry.result !== criteria.result) {
        return false;
      }
      if (!q) return true;
      return (
        entry.actor_name.toLowerCase().includes(q) ||
        entry.action.toLowerCase().includes(q) ||
        entry.entity_label.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    totalCount,
    totalPages,
    currentPage,
  };
}

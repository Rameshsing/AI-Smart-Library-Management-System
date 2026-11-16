import type { LibrarianPermissions, LibrarianProfile } from './librarianDashboard';
import {
  getStudentInitials,
  isSafeAvatarUrl,
  validateChangePassword,
  type ChangePasswordDraft,
  type ChangePasswordFieldErrors,
} from './studentProfilePage';
import type { PasswordStrengthResult } from './studentRegistration';

export type LibrarianProfileSectionTab = 'profile' | 'settings' | 'password';

export type LibrarianNotificationCategory =
  | 'overdue_alerts'
  | 'reservation_alerts'
  | 'issue_notifications'
  | 'return_notifications'
  | 'library_announcements'
  | 'account_security_alerts';

export interface LibrarianNotificationPreferenceItem {
  category: LibrarianNotificationCategory;
  label: string;
  description: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  is_mandatory: boolean;
  mandatory_reason: string | null;
  email_supported: boolean;
}

export interface LibrarianAuditActivityItem {
  activity_id: string;
  action: string;
  target_summary: string;
  timestamp: string;
  status: 'Completed' | 'Verified';
}

export interface LibrarianSessionRecord {
  session_id: string;
  device_label: string;
  browser: string;
  location_summary: string;
  last_active_at: string;
  is_current: boolean;
  can_revoke: boolean;
}

export interface LibrarianExtendedProfile extends LibrarianProfile {
  mobile_number: string;
  designation: string;
  branch: string;
  joining_date: string;
}

export interface LibrarianProfileCapabilities {
  allow_photo_upload: boolean;
  supports_email_notifications: boolean;
  supports_session_management: boolean;
  supports_audit_logs: boolean;
  supports_2fa: false;
}

export interface LibrarianFullProfilePayload {
  is_prototype_sample: boolean;
  librarian: LibrarianExtendedProfile;
  capabilities: LibrarianProfileCapabilities;
  notification_preferences: LibrarianNotificationPreferenceItem[];
  recent_activity: LibrarianAuditActivityItem[];
  active_sessions: LibrarianSessionRecord[];
}

export interface LibrarianPersonalDraft {
  full_name: string;
  email: string;
  mobile_number: string;
  avatar_url: string | null;
}

export type LibrarianPersonalFieldErrors = Partial<Record<keyof LibrarianPersonalDraft, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[+\d][\d\s()-]{6,18}$/;

export const ALLOWED_LIBRARIAN_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_LIBRARIAN_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB

export function getLibrarianInitials(fullName: string | null | undefined): string {
  if (!fullName) return 'LB';
  const stripped = fullName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').trim();
  return getStudentInitials(stripped || fullName);
}

export function validateLibrarianPhotoFile(file: {
  name: string;
  type: string;
  size: number;
}): { isValid: boolean; error: string | null } {
  const normalizedType = file.type.trim().toLowerCase();
  if (
    !ALLOWED_LIBRARIAN_PHOTO_TYPES.includes(
      normalizedType as (typeof ALLOWED_LIBRARIAN_PHOTO_TYPES)[number]
    )
  ) {
    return {
      isValid: false,
      error: 'Unsupported image format. Upload a JPG, PNG, or WebP image file.',
    };
  }
  if (file.size <= 0) {
    return {
      isValid: false,
      error: 'Selected image file is empty.',
    };
  }
  if (file.size > MAX_LIBRARIAN_PHOTO_BYTES) {
    return {
      isValid: false,
      error: 'Profile photo must be 2 MB or smaller.',
    };
  }
  return { isValid: true, error: null };
}

export function isSafeLibrarianAvatarValue(rawUrl: string | null | undefined): boolean {
  if (!rawUrl || !rawUrl.trim()) return true;
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('blob:')) return true;
  return isSafeAvatarUrl(trimmed);
}

export function validateLibrarianPersonalDraft(
  draft: LibrarianPersonalDraft,
  originalEmail?: string
): {
  isValid: boolean;
  errors: LibrarianPersonalFieldErrors;
  emailChanged: boolean;
} {
  const errors: LibrarianPersonalFieldErrors = {};

  const trimmedName = draft.full_name.trim();
  if (!trimmedName) {
    errors.full_name = 'Full name is required.';
  } else if (trimmedName.length < 2) {
    errors.full_name = 'Full name must be at least 2 characters.';
  } else if (trimmedName.length > 120) {
    errors.full_name = 'Full name must be 120 characters or fewer.';
  }

  const trimmedEmail = draft.email.trim().toLowerCase();
  if (!trimmedEmail) {
    errors.email = 'Institutional email address is required.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  const trimmedMobile = draft.mobile_number.trim();
  if (trimmedMobile && !MOBILE_PATTERN.test(trimmedMobile)) {
    errors.mobile_number = 'Enter a valid phone number (7–18 digits) or leave blank.';
  }

  if (draft.avatar_url && !isSafeLibrarianAvatarValue(draft.avatar_url)) {
    errors.avatar_url = 'Profile photo reference is invalid.';
  }

  const normalizedOriginal = (originalEmail ?? '').trim().toLowerCase();
  const emailChanged = Boolean(normalizedOriginal) && trimmedEmail !== normalizedOriginal;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    emailChanged,
  };
}

/**
 * Strictly includes only editable librarian personal fields.
 * Never transmits staff_code, role, account_status, designation, branch, joining_date, or permissions.
 */
export function buildLibrarianProfileUpdatePayload(draft: LibrarianPersonalDraft): {
  full_name: string;
  email: string;
  mobile_number: string | null;
  avatar_url: string | null;
} {
  return {
    full_name: draft.full_name.trim(),
    email: draft.email.trim().toLowerCase(),
    mobile_number: draft.mobile_number.trim() || null,
    avatar_url: draft.avatar_url && draft.avatar_url.trim() ? draft.avatar_url.trim() : null,
  };
}

export function validateLibrarianPasswordChange(draft: ChangePasswordDraft): {
  isValid: boolean;
  errors: ChangePasswordFieldErrors;
  strength: PasswordStrengthResult;
} {
  return validateChangePassword(draft);
}

export function sanitizeLibrarianNotificationPreferences(
  items: LibrarianNotificationPreferenceItem[]
): LibrarianNotificationPreferenceItem[] {
  return items.map((item) => {
    const isSecurityMandatory =
      item.category === 'account_security_alerts' || item.is_mandatory;
    return {
      ...item,
      is_mandatory: isSecurityMandatory,
      in_app_enabled: isSecurityMandatory ? true : item.in_app_enabled,
      email_enabled: item.email_supported ? item.email_enabled : false,
    };
  });
}

export function buildLibrarianNotificationPrefsPayload(
  items: LibrarianNotificationPreferenceItem[]
): {
  preferences: Array<{
    category: LibrarianNotificationCategory;
    in_app_enabled: boolean;
    email_enabled: boolean;
  }>;
} {
  const sanitized = sanitizeLibrarianNotificationPreferences(items);
  return {
    preferences: sanitized.map((item) => ({
      category: item.category,
      in_app_enabled: item.in_app_enabled,
      email_enabled: item.email_enabled,
    })),
  };
}

export function isLibrarianPersonalDraftDirty(
  draft: LibrarianPersonalDraft,
  saved: LibrarianPersonalDraft
): boolean {
  return (
    draft.full_name.trim() !== saved.full_name.trim() ||
    draft.email.trim().toLowerCase() !== saved.email.trim().toLowerCase() ||
    draft.mobile_number.trim() !== saved.mobile_number.trim() ||
    (draft.avatar_url ?? '').trim() !== (saved.avatar_url ?? '').trim()
  );
}

export function isLibrarianNotificationsDirty(
  draft: LibrarianNotificationPreferenceItem[],
  saved: LibrarianNotificationPreferenceItem[]
): boolean {
  if (draft.length !== saved.length) return true;
  return draft.some((item, idx) => {
    const other = saved[idx];
    if (!other || other.category !== item.category) return true;
    return (
      item.in_app_enabled !== other.in_app_enabled ||
      item.email_enabled !== other.email_enabled
    );
  });
}

export function getStaffRolePermissionEntries(
  permissions: LibrarianPermissions
): Array<{ key: keyof LibrarianPermissions; label: string; granted: boolean }> {
  return [
    { key: 'can_manage_inventory', label: 'Manage Book Inventory & Copies', granted: permissions.can_manage_inventory },
    { key: 'can_issue_books', label: 'Issue Books to Students', granted: permissions.can_issue_books },
    { key: 'can_return_books', label: 'Process Book Returns & Condition Checks', granted: permissions.can_return_books },
    { key: 'can_manage_reservations', label: 'Manage Reservation Queues & Hold Shelf', granted: permissions.can_manage_reservations },
    { key: 'can_view_student_records', label: 'View Student Circulation Records', granted: permissions.can_view_student_records },
    { key: 'can_view_new_registrations', label: 'View New Student Registrations', granted: permissions.can_view_new_registrations },
    { key: 'can_manage_announcements', label: 'Publish & Manage Library Announcements', granted: permissions.can_manage_announcements },
    { key: 'can_view_reports', label: 'View Reports & Circulation Analytics', granted: permissions.can_view_reports },
  ];
}

export function mapLibrarianProfileApiError(status: number, serverMessage?: string): string {
  const clean = serverMessage?.trim();
  if (status === 400 || status === 422) {
    return clean || 'Please check your input fields and fix highlighted errors.';
  }
  if (status === 401) {
    return 'Your librarian session expired. Please sign in again.';
  }
  if (status === 403) {
    return clean || 'Only Library Administrators can modify staff roles, status, or permissions.';
  }
  if (status === 409) {
    return clean || 'This email address is already linked to another staff account.';
  }
  return clean || 'Unable to save staff account changes right now. Please try again.';
}

export function createSampleLibrarianFullProfilePayload(
  baseLibrarian?: LibrarianProfile,
  referenceDate: Date = new Date()
): LibrarianFullProfilePayload {
  const fallback: LibrarianProfile = baseLibrarian ?? {
    librarian_id: 204,
    user_id: 88,
    staff_code: 'LIB-2026-008',
    full_name: 'Dr. Priya Nair',
    email: 'priya.nair@library.university.edu',
    department_title: 'Head of Circulation & Academic Reserves',
    role: 'librarian',
    account_status: 'Active',
    avatar_url: null,
    permissions: {
      can_manage_inventory: true,
      can_issue_books: true,
      can_return_books: true,
      can_manage_reservations: true,
      can_view_student_records: true,
      can_view_new_registrations: true,
      can_manage_announcements: true,
      can_view_reports: true,
    },
  };

  const yyyy = referenceDate.getFullYear();
  const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const dd = String(referenceDate.getDate()).padStart(2, '0');

  return {
    is_prototype_sample: true,
    librarian: {
      ...fallback,
      mobile_number: '+91 98204 51120',
      designation: fallback.department_title,
      branch: 'Main Central Library',
      joining_date: '2021-07-12',
    },
    capabilities: {
      allow_photo_upload: true,
      supports_email_notifications: false,
      supports_session_management: true,
      supports_audit_logs: false,
      supports_2fa: false,
    },
    notification_preferences: [
      {
        category: 'overdue_alerts',
        label: 'Overdue Alerts',
        description: 'Daily summary and escalation notices for overdue student loans.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: false,
      },
      {
        category: 'reservation_alerts',
        label: 'Reservation Alerts',
        description: 'New queue holds, returned copies matching reservations, and expiring pickups.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: false,
      },
      {
        category: 'issue_notifications',
        label: 'Issue Notifications',
        description: 'Desk circulation receipts and limit override confirmations.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: false,
      },
      {
        category: 'return_notifications',
        label: 'Return Notifications',
        description: 'Damaged/lost copy return flags and stock replenishment notices.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: false,
      },
      {
        category: 'library_announcements',
        label: 'Library Announcements',
        description: 'Administrative broadcasts, scheduled audits, and holiday desk hours.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: false,
      },
      {
        category: 'account_security_alerts',
        label: 'Account Security Alerts',
        description: 'Password updates, session revocations, and staff sign-in verification.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: true,
        mandatory_reason: 'Mandatory for staff account protection and cannot be turned off.',
        email_supported: false,
      },
    ],
    recent_activity: [],
    active_sessions: [
      {
        session_id: 'staff_sess_current',
        device_label: 'Circulation Desk Workstation (Current Session)',
        browser: 'Chrome 131',
        location_summary: 'Main Central Library LAN',
        last_active_at: `${yyyy}-${mm}-${dd}T09:15:00`,
        is_current: true,
        can_revoke: false,
      },
    ],
  };
}

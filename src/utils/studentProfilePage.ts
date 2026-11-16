import {
  ACADEMIC_YEARS,
  COURSE_DEPARTMENTS,
  evaluatePasswordStrength,
  type PasswordStrengthResult,
} from './studentRegistration';
import {
  createSampleNotificationsPayload,
  type NotificationPreferencesPayload,
} from './notificationsPage';
import { STUDENT_AVATAR_IMAGE, type StudentProfile } from './studentDashboard';

export type ProfileSectionId =
  | 'personal'
  | 'academic'
  | 'interests'
  | 'subjects'
  | 'recommendations'
  | 'notifications'
  | 'security';

export interface ProfileSectionMeta {
  id: ProfileSectionId;
  label: string;
  description: string;
}

export const PROFILE_SECTIONS: ProfileSectionMeta[] = [
  {
    id: 'personal',
    label: 'Personal Information',
    description: 'Name, email, mobile number, and profile photo',
  },
  {
    id: 'academic',
    label: 'Academic Information',
    description: 'Student ID, institution, department, year, and semester',
  },
  {
    id: 'interests',
    label: 'Reading Interests',
    description: 'Topics you enjoy for personalized book discovery',
  },
  {
    id: 'subjects',
    label: 'Preferred Subjects',
    description: 'Academic and syllabus subjects prioritized in your library feed',
  },
  {
    id: 'recommendations',
    label: 'Recommendation Preferences',
    description: 'Discovery balance, reading level, formats, and availability rules',
  },
  {
    id: 'notifications',
    label: 'Notification Preferences',
    description: 'Due reminders, reservation alerts, and announcement channels',
  },
  {
    id: 'security',
    label: 'Account & Security',
    description: 'Password update, active sessions, and account status',
  },
];

export const PROFILE_READING_INTERESTS = [
  'Artificial Intelligence',
  'Machine Learning',
  'Data Science',
  'Programming',
  'Computer Science',
  'Mathematics',
  'Physics',
  'Business',
  'Finance',
  'Psychology',
  'Literature',
  'History',
  'Science Fiction',
  'Self Development',
  'Cybersecurity',
  'Web Development',
  'Cloud Computing',
  'Electronics',
  'Robotics',
  'Research',
] as const;

export const INSTITUTIONAL_SUBJECTS = [
  'Database Management Systems',
  'Operating Systems',
  'Computer Networks',
  'Software Engineering',
  'Artificial Intelligence',
  'Data Structures & Algorithms',
  'Python Programming',
  'Mathematics',
  'Statistics',
  'Electronics',
  'Physics',
  'Management',
] as const;

export const PROFILE_COURSE_DEPARTMENTS = COURSE_DEPARTMENTS;
export const PROFILE_ACADEMIC_YEARS = ACADEMIC_YEARS;

export const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
  'Postgraduate Sem 1–4',
  'Research Term',
] as const;

export const SUPPORTED_CONTENT_FORMATS = [
  'Print Books',
  'eBooks',
  'Digital Reference PDFs',
] as const;

export const SUPPORTED_CONTENT_LANGUAGES = [
  'English',
  'Hindi',
  'Spanish',
  'French',
] as const;

export type AccountStatus = 'Active' | 'Pending' | 'Suspended';

export type DiscoveryPreference = 'mostly_familiar' | 'balanced' | 'explore_new';

export type ReadingLevelPreference =
  | 'Beginner'
  | 'Intermediate'
  | 'Advanced'
  | 'No preference';

export type AvailabilityPreference = 'available_first' | 'include_unavailable';

export interface PersonalInfoDraft {
  full_name: string;
  email: string;
  mobile_number: string;
  avatar_url: string;
}

export interface AcademicInfoRecord {
  student_code: string;
  institution_name: string;
  course_department: string;
  academic_year: string;
  semester: string;
}

export interface RecommendationPreferences {
  preferred_topics: string[];
  discovery_preference: DiscoveryPreference;
  reading_level: ReadingLevelPreference;
  content_formats: string[];
  content_languages: string[];
  avoid_previously_read: boolean;
  availability_preference: AvailabilityPreference;
}

export interface ActiveSessionRecord {
  session_id: string;
  device_label: string;
  browser: string;
  location_summary: string;
  last_active_at: string;
  is_current: boolean;
  can_revoke: boolean;
}

export interface ChangePasswordDraft {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}

export interface ProfilePolicyFlags {
  allow_profile_photo_edit: boolean;
  allow_student_code_edit: boolean;
  allow_academic_edit: boolean;
  allow_session_revoke: boolean;
  allow_account_deletion: boolean;
}

export interface StudentProfileFullPayload {
  is_prototype_sample: boolean;
  account_status: AccountStatus;
  email_verified: boolean;
  email_verification_pending: string | null;
  policy: ProfilePolicyFlags;
  personal: PersonalInfoDraft;
  academic: AcademicInfoRecord;
  reading_interests: string[];
  available_reading_interests: string[];
  preferred_subjects: string[];
  available_subjects: string[];
  recommendation_preferences: RecommendationPreferences;
  notification_preferences: NotificationPreferencesPayload;
  active_sessions: ActiveSessionRecord[];
}

export type PersonalInfoFieldErrors = Partial<Record<keyof PersonalInfoDraft, string>>;
export type AcademicInfoFieldErrors = Partial<
  Record<'course_department' | 'academic_year' | 'semester', string>
>;
export type ChangePasswordFieldErrors = Partial<Record<keyof ChangePasswordDraft, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[+\d][\d\s()-]{6,18}$/;

export function getStudentInitials(fullName: string | null | undefined): string {
  if (!fullName) return 'ST';
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function isSafeAvatarUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validatePersonalInfo(
  draft: PersonalInfoDraft,
  originalEmail?: string
): {
  isValid: boolean;
  errors: PersonalInfoFieldErrors;
  emailChanged: boolean;
} {
  const errors: PersonalInfoFieldErrors = {};

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
    errors.email = 'Email address is required.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid academic or personal email address.';
  }

  const trimmedMobile = draft.mobile_number.trim();
  if (trimmedMobile && !MOBILE_PATTERN.test(trimmedMobile)) {
    errors.mobile_number = 'Enter a valid mobile number (7–18 digits) or leave blank.';
  }

  const trimmedAvatar = draft.avatar_url.trim();
  if (trimmedAvatar && !isSafeAvatarUrl(trimmedAvatar)) {
    errors.avatar_url = 'Profile photo URL must start with https://, http://, or /.';
  }

  const normalizedOriginal = (originalEmail ?? '').trim().toLowerCase();
  const emailChanged = Boolean(normalizedOriginal) && trimmedEmail !== normalizedOriginal;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    emailChanged,
  };
}

export function buildPersonalInfoUpdatePayload(draft: PersonalInfoDraft): {
  full_name: string;
  email: string;
  mobile_number: string | null;
  avatar_url: string | null;
} {
  return {
    full_name: draft.full_name.trim(),
    email: draft.email.trim().toLowerCase(),
    mobile_number: draft.mobile_number.trim() || null,
    avatar_url: draft.avatar_url.trim() || null,
  };
}

export function validateAcademicInfo(draft: AcademicInfoRecord): {
  isValid: boolean;
  errors: AcademicInfoFieldErrors;
} {
  const errors: AcademicInfoFieldErrors = {};
  if (!draft.course_department.trim()) {
    errors.course_department = 'Please select your course or department.';
  }
  if (!draft.academic_year.trim()) {
    errors.academic_year = 'Please select your academic year.';
  }
  if (!draft.semester.trim()) {
    errors.semester = 'Please select your current semester.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildAcademicUpdatePayload(draft: AcademicInfoRecord): {
  course_department: string;
  academic_year: string;
  semester: string;
} {
  return {
    course_department: draft.course_department.trim(),
    academic_year: draft.academic_year.trim(),
    semester: draft.semester.trim(),
  };
}

export function filterTopicOptions(availableTopics: string[], searchQuery: string): string[] {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) return availableTopics;
  return availableTopics.filter((topic) => topic.toLowerCase().includes(normalized));
}

export function validateChangePassword(draft: ChangePasswordDraft): {
  isValid: boolean;
  errors: ChangePasswordFieldErrors;
  strength: PasswordStrengthResult;
} {
  const errors: ChangePasswordFieldErrors = {};
  const strength = evaluatePasswordStrength(draft.new_password);

  if (!draft.current_password) {
    errors.current_password = 'Enter your current password to verify your identity.';
  }

  if (!draft.new_password) {
    errors.new_password = 'Enter a new password.';
  } else if (draft.new_password.length < 8) {
    errors.new_password = 'New password must be at least 8 characters long.';
  } else if (draft.current_password && draft.new_password === draft.current_password) {
    errors.new_password = 'New password must be different from your current password.';
  }

  if (!draft.confirm_new_password) {
    errors.confirm_new_password = 'Confirm your new password.';
  } else if (draft.new_password !== draft.confirm_new_password) {
    errors.confirm_new_password = 'New password and confirmation do not match.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    strength,
  };
}

export function isPersonalInfoDirty(
  draft: PersonalInfoDraft,
  saved: PersonalInfoDraft
): boolean {
  return (
    draft.full_name.trim() !== saved.full_name.trim() ||
    draft.email.trim().toLowerCase() !== saved.email.trim().toLowerCase() ||
    draft.mobile_number.trim() !== saved.mobile_number.trim() ||
    draft.avatar_url.trim() !== saved.avatar_url.trim()
  );
}

export function isAcademicInfoDirty(
  draft: AcademicInfoRecord,
  saved: AcademicInfoRecord
): boolean {
  return (
    draft.course_department.trim() !== saved.course_department.trim() ||
    draft.academic_year.trim() !== saved.academic_year.trim() ||
    draft.semester.trim() !== saved.semester.trim()
  );
}

export function isStringListDirty(draft: string[], saved: string[]): boolean {
  const normDraft = [...new Set(draft.map((item) => item.trim().toLowerCase()))].sort();
  const normSaved = [...new Set(saved.map((item) => item.trim().toLowerCase()))].sort();
  if (normDraft.length !== normSaved.length) return true;
  return normDraft.some((val, idx) => val !== normSaved[idx]);
}

export function isRecommendationPreferencesDirty(
  draft: RecommendationPreferences,
  saved: RecommendationPreferences
): boolean {
  return (
    draft.discovery_preference !== saved.discovery_preference ||
    draft.reading_level !== saved.reading_level ||
    draft.avoid_previously_read !== saved.avoid_previously_read ||
    draft.availability_preference !== saved.availability_preference ||
    isStringListDirty(draft.preferred_topics, saved.preferred_topics) ||
    isStringListDirty(draft.content_formats, saved.content_formats) ||
    isStringListDirty(draft.content_languages, saved.content_languages)
  );
}

export function isNotificationPreferencesDirty(
  draft: NotificationPreferencesPayload,
  saved: NotificationPreferencesPayload
): boolean {
  if (isStringListDirty(draft.reminder_timings, saved.reminder_timings)) {
    return true;
  }
  if (draft.categories.length !== saved.categories.length) return true;
  return draft.categories.some((cat, idx) => {
    const other = saved.categories[idx];
    if (!other || other.category !== cat.category) return true;
    return (
      cat.in_app_enabled !== other.in_app_enabled ||
      cat.email_enabled !== other.email_enabled
    );
  });
}

export function isPasswordDraftDirty(draft: ChangePasswordDraft): boolean {
  return Boolean(
    draft.current_password || draft.new_password || draft.confirm_new_password
  );
}

export function createEmptyPasswordDraft(): ChangePasswordDraft {
  return {
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  };
}

function mergeUniqueStrings(...groups: ReadonlyArray<ReadonlyArray<string>>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const cleaned = raw.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(cleaned);
    }
  }
  return merged;
}

export function createSampleStudentProfilePayload(
  student?: StudentProfile,
  referenceDate: Date = new Date()
): StudentProfileFullPayload {
  const sampleNotifs = createSampleNotificationsPayload(referenceDate);
  const fullName = student?.name ?? 'Ananya Verma';
  const email = student?.email ?? 'ananya.verma@university.edu';
  const studentCode = student?.student_code ?? 'STU-2026-042';
  const courseDept = student?.course_department ?? 'Computer Science & Engineering';
  const academicYear = student?.academic_year ?? '3rd Year / Semester 5–6';
  const avatarUrl = student?.avatar_url ?? STUDENT_AVATAR_IMAGE;

  const initialInterests =
    student?.interests && student.interests.length > 0
      ? student.interests
      : ['Artificial Intelligence', 'Data Science', 'Programming', 'Machine Learning'];

  const initialSubjects =
    student?.preferred_subjects && student.preferred_subjects.length > 0
      ? student.preferred_subjects
      : ['Artificial Intelligence', 'Database Management Systems', 'Python Programming'];

  const yyyy = referenceDate.getFullYear();
  const mm = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const dd = String(referenceDate.getDate()).padStart(2, '0');
  const prevDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - 2
  );
  const pYyyy = prevDay.getFullYear();
  const pMm = String(prevDay.getMonth() + 1).padStart(2, '0');
  const pDd = String(prevDay.getDate()).padStart(2, '0');

  return {
    is_prototype_sample: true,
    account_status: 'Active',
    email_verified: true,
    email_verification_pending: null,
    policy: {
      allow_profile_photo_edit: true,
      allow_student_code_edit: false,
      allow_academic_edit: true,
      allow_session_revoke: true,
      allow_account_deletion: false,
    },
    personal: {
      full_name: fullName,
      email,
      mobile_number: '+91 98765 43210',
      avatar_url: avatarUrl,
    },
    academic: {
      student_code: studentCode,
      institution_name: 'National Institute of Technology & Sciences',
      course_department: courseDept,
      academic_year: academicYear,
      semester: 'Semester 5',
    },
    reading_interests: initialInterests,
    available_reading_interests: mergeUniqueStrings(
      PROFILE_READING_INTERESTS,
      initialInterests
    ),
    preferred_subjects: initialSubjects,
    available_subjects: mergeUniqueStrings(INSTITUTIONAL_SUBJECTS, initialSubjects),
    recommendation_preferences: {
      preferred_topics: ['Artificial Intelligence', 'Data Science', 'Python Programming'],
      discovery_preference: 'balanced',
      reading_level: 'Intermediate',
      content_formats: ['Print Books', 'eBooks'],
      content_languages: ['English'],
      avoid_previously_read: true,
      availability_preference: 'available_first',
    },
    notification_preferences: sampleNotifs.preferences,
    active_sessions: [
      {
        session_id: 'sess_current_desktop',
        device_label: 'Linux Workstation (Current Session)',
        browser: 'Chrome 131',
        location_summary: 'University Campus Network',
        last_active_at: `${yyyy}-${mm}-${dd}T09:42:00`,
        is_current: true,
        can_revoke: false,
      },
      {
        session_id: 'sess_mobile_browser',
        device_label: 'Android Mobile Device',
        browser: 'Chrome Mobile',
        location_summary: 'Student Hostel Wi-Fi',
        last_active_at: `${pYyyy}-${pMm}-${pDd}T20:15:00`,
        is_current: false,
        can_revoke: true,
      },
    ],
  };
}

export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_DEPARTMENT_LENGTH = 100;
export const MAX_ACADEMIC_YEAR_LENGTH = 40;
export const MAX_EMAIL_LENGTH = 160;
export const MAX_STUDENT_CODE_LENGTH = 40;
export const MAX_LIST_ITEMS = 15;
export const MAX_LIST_ITEM_LENGTH = 80;

export function isValidFirestoreId(id: string): boolean {
  return id.length >= 1 && id.length <= MAX_ID_LENGTH && VALID_ID_REGEX.test(id);
}

export function sanitizeBoundedString(value: string | undefined | null, maxLength: number): string {
  return (value ?? '').trim().slice(0, maxLength);
}

export function sanitizeBoundedStringList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of values) {
    const trimmed = String(item ?? '').trim().slice(0, MAX_LIST_ITEM_LENGTH);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
    if (unique.length >= MAX_LIST_ITEMS) break;
  }
  return unique;
}

export function buildValidatedUserProfilePayload(input: {
  uid: string;
  displayName: string;
  department?: string;
  academicYear?: string;
  interests?: string[];
  preferredSubjects?: string[];
}) {
  if (!isValidFirestoreId(input.uid)) {
    throw new Error('Invalid Firebase UID for Firestore user profile.');
  }
  const displayName =
    sanitizeBoundedString(input.displayName, MAX_DISPLAY_NAME_LENGTH) || 'Library Member';
  return {
    uid: input.uid,
    displayName,
    department: sanitizeBoundedString(input.department || 'General Studies', MAX_DEPARTMENT_LENGTH),
    academicYear: sanitizeBoundedString(
      input.academicYear || 'Active Member',
      MAX_ACADEMIC_YEAR_LENGTH
    ),
    interests: sanitizeBoundedStringList(input.interests),
    preferredSubjects: sanitizeBoundedStringList(input.preferredSubjects),
  };
}

export function buildValidatedUserPrivatePayload(input: {
  uid: string;
  email: string;
  studentCode?: string;
}) {
  if (!isValidFirestoreId(input.uid)) {
    throw new Error('Invalid Firebase UID for private contact record.');
  }
  const email = sanitizeBoundedString(input.email, MAX_EMAIL_LENGTH);
  if (email.length < 3 || !email.includes('@')) {
    throw new Error('Valid email is required for Firestore private contact record.');
  }
  return {
    uid: input.uid,
    email,
    studentCode: sanitizeBoundedString(input.studentCode, MAX_STUDENT_CODE_LENGTH),
  };
}

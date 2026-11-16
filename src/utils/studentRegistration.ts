export const REGISTRATION_ILLUSTRATION_IMAGE =
  '/src/assets/images/registration_student_reading_1794582534823.jpg';

export const COURSE_DEPARTMENTS = [
  'Computer Science & Engineering',
  'Information Technology',
  'Data Science & Artificial Intelligence',
  'Electronics & Communication Engineering',
  'Mechanical & Civil Engineering',
  'Business Administration & Management',
  'Mathematics & Physical Sciences',
  'Humanities & Social Sciences',
  'Other',
] as const;

export const ACADEMIC_YEARS = [
  '1st Year / Semester 1–2',
  '2nd Year / Semester 3–4',
  '3rd Year / Semester 5–6',
  '4th Year / Semester 7–8',
  'Postgraduate / Semester 1–4',
  'Research / PhD',
] as const;

export const INITIAL_READING_INTERESTS = [
  'Programming',
  'Artificial Intelligence',
  'Machine Learning',
  'Data Science',
  'Web Development',
  'Database Management',
  'Computer Networks',
  'Cybersecurity',
  'Mathematics',
  'Science',
  'Business',
  'Personal Development',
  'Literature',
  'History',
  'General Knowledge',
] as const;

export const PREFERRED_SUBJECT_OPTIONS = [
  'Computer Science',
  'Python Programming',
  'Java Programming',
  'Web Technologies',
  'Database Management Systems',
  'Networking',
  'Artificial Intelligence',
  'Mathematics',
  'Other',
] as const;

export interface StudentRegistrationFormData {
  fullName: string;
  studentId: string;
  email: string;
  mobileNumber: string;
  institutionName: string;
  courseDepartment: string;
  academicYear: string;
  password: string;
  confirmPassword: string;
  interests: string[];
  preferredSubjects: string[];
  acceptedTerms: boolean;
}

export type RegistrationFieldErrors = Partial<
  Record<keyof StudentRegistrationFormData, string>
>;

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too Short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  meetsMinLength: boolean;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
}

export interface FlaskRegistrationPayload {
  user: {
    email: string;
    role: 'student';
    password_hash_required: true;
  };
  student: {
    full_name: string;
    student_code: string;
    mobile_number: string | null;
    institution_name: string;
    course_department: string;
    academic_year: string;
  };
  student_interests: string[];
  student_subjects: string[];
}

export function createInitialRegistrationForm(): StudentRegistrationFormData {
  return {
    fullName: '',
    studentId: '',
    email: '',
    mobileNumber: '',
    institutionName: '',
    courseDepartment: '',
    academicYear: '',
    password: '',
    confirmPassword: '',
    interests: [],
    preferredSubjects: [],
    acceptedTerms: false,
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
  };

  if (password.length === 0) {
    return {
      score: 0,
      label: 'Too Short',
      meetsMinLength: false,
      checks,
    };
  }

  if (!checks.minLength) {
    return {
      score: 1,
      label: 'Too Short',
      meetsMinLength: false,
      checks,
    };
  }

  const varietyCount = [
    checks.hasUpper,
    checks.hasLower,
    checks.hasNumber,
    checks.hasSymbol,
  ].filter(Boolean).length;

  if (varietyCount <= 1) {
    return { score: 1, label: 'Weak', meetsMinLength: true, checks };
  }
  if (varietyCount === 2) {
    return { score: 2, label: 'Fair', meetsMinLength: true, checks };
  }
  if (varietyCount === 3) {
    return { score: 3, label: 'Good', meetsMinLength: true, checks };
  }
  return { score: 4, label: 'Strong', meetsMinLength: true, checks };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[+\d][\d\s-]{6,18}$/;

export function validateStudentRegistration(
  form: StudentRegistrationFormData
): { isValid: boolean; errors: RegistrationFieldErrors } {
  const errors: RegistrationFieldErrors = {};

  if (!form.fullName.trim()) {
    errors.fullName = 'Please enter your full name.';
  } else if (form.fullName.trim().length < 2) {
    errors.fullName = 'Full name must be at least 2 characters.';
  }

  if (!form.studentId.trim()) {
    errors.studentId = 'Please enter your student ID or roll number.';
  }

  const trimmedEmail = form.email.trim();
  if (!trimmedEmail) {
    errors.email = 'Please enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address (e.g. student@university.edu).';
  }

  const trimmedMobile = form.mobileNumber.trim();
  if (trimmedMobile && !MOBILE_PATTERN.test(trimmedMobile)) {
    errors.mobileNumber = 'Please enter a valid mobile number or leave this field blank.';
  }

  if (!form.institutionName.trim()) {
    errors.institutionName = 'Please enter your institution name.';
  }

  if (!form.courseDepartment.trim()) {
    errors.courseDepartment = 'Please select your course or department.';
  }

  if (!form.academicYear.trim()) {
    errors.academicYear = 'Please select your academic year or semester.';
  }

  if (!form.password) {
    errors.password = 'Please create a password.';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters long.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (form.interests.length === 0) {
    errors.interests = 'Select at least one reading interest for AI recommendations.';
  }

  if (form.preferredSubjects.length === 0) {
    errors.preferredSubjects = 'Select at least one preferred subject.';
  }

  if (!form.acceptedTerms) {
    errors.acceptedTerms = 'You must agree to the Terms and Conditions and Privacy Policy.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function toggleSelectionItem(list: string[], item: string): string[] {
  const exists = list.some((entry) => entry.toLowerCase() === item.toLowerCase());
  if (exists) {
    return list.filter((entry) => entry.toLowerCase() !== item.toLowerCase());
  }
  return [...list, item];
}

export function addCustomInterestItem(
  selectedInterests: string[],
  availableInterests: string[],
  rawCustomInterest: string
): {
  nextSelected: string[];
  nextAvailable: string[];
  error?: string;
} {
  const cleaned = rawCustomInterest.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return {
      nextSelected: selectedInterests,
      nextAvailable: availableInterests,
      error: 'Enter an interest name before adding.',
    };
  }
  if (cleaned.length < 2 || cleaned.length > 40) {
    return {
      nextSelected: selectedInterests,
      nextAvailable: availableInterests,
      error: 'Custom interest must be between 2 and 40 characters.',
    };
  }

  const existingOption = availableInterests.find(
    (item) => item.toLowerCase() === cleaned.toLowerCase()
  );
  const canonicalName = existingOption ?? cleaned;

  const alreadySelected = selectedInterests.some(
    (item) => item.toLowerCase() === canonicalName.toLowerCase()
  );

  return {
    nextAvailable: existingOption ? availableInterests : [...availableInterests, canonicalName],
    nextSelected: alreadySelected ? selectedInterests : [...selectedInterests, canonicalName],
  };
}

export function buildFlaskRegistrationPayload(
  form: StudentRegistrationFormData
): FlaskRegistrationPayload {
  return {
    user: {
      email: form.email.trim().toLowerCase(),
      role: 'student',
      password_hash_required: true,
    },
    student: {
      full_name: form.fullName.trim(),
      student_code: form.studentId.trim(),
      mobile_number: form.mobileNumber.trim() || null,
      institution_name: form.institutionName.trim(),
      course_department: form.courseDepartment.trim(),
      academic_year: form.academicYear.trim(),
    },
    student_interests: [...form.interests],
    student_subjects: [...form.preferredSubjects],
  };
}

import type { AppRoute } from '../data/libraryData';

export type LoginRole = 'student' | 'librarian' | 'admin';

export const LOGIN_ILLUSTRATION_IMAGE =
  '/src/assets/images/login_library_welcome_1794583845660.jpg';

export interface LoginFormData {
  role: LoginRole;
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginValidationErrors {
  identifier?: string;
  password?: string;
}

export interface LoginRoleConfig {
  role: LoginRole;
  tabLabel: string;
  identifierLabel: string;
  identifierPlaceholder: string;
  identifierAutoComplete: string;
  showRememberMe: boolean;
  showStudentSignupLink: boolean;
  securityNote: string;
}

export const LOGIN_ROLE_CONFIGS: Record<LoginRole, LoginRoleConfig> = {
  student: {
    role: 'student',
    tabLabel: 'Student',
    identifierLabel: 'Student Email or Student ID',
    identifierPlaceholder: 'Enter your student email or student ID',
    identifierAutoComplete: 'username',
    showRememberMe: true,
    showStudentSignupLink: true,
    securityNote:
      'Student accounts are verified against the server role before opening the Student Dashboard.',
  },
  librarian: {
    role: 'librarian',
    tabLabel: 'Librarian',
    identifierLabel: 'Registered Staff Email or Username',
    identifierPlaceholder: 'Enter your staff email or username',
    identifierAutoComplete: 'username',
    showRememberMe: true,
    showStudentSignupLink: false,
    securityNote:
      'Librarian accounts are provisioned exclusively by an authorized administrator—public registration is disabled.',
  },
  admin: {
    role: 'admin',
    tabLabel: 'Admin',
    identifierLabel: 'Administrator Email or Username',
    identifierPlaceholder: 'Enter your administrator email or username',
    identifierAutoComplete: 'username',
    showRememberMe: false,
    showStudentSignupLink: false,
    securityNote:
      'Administrator sessions require server-side credential verification and strict role authorization.',
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLoginCredentials(
  form: Pick<LoginFormData, 'role' | 'identifier' | 'password'>
): { isValid: boolean; errors: LoginValidationErrors } {
  const errors: LoginValidationErrors = {};
  const trimmedIdentifier = form.identifier.trim();

  if (!trimmedIdentifier) {
    errors.identifier =
      form.role === 'student'
        ? 'Please enter your student email or student ID.'
        : form.role === 'librarian'
          ? 'Please enter your registered staff email or username.'
          : 'Please enter your administrator email or username.';
  } else if (trimmedIdentifier.includes('@')) {
    if (!EMAIL_PATTERN.test(trimmedIdentifier)) {
      errors.identifier = 'Please enter a valid email address (e.g. name@institution.edu).';
    }
  } else if (trimmedIdentifier.length < 3 || /\s/.test(trimmedIdentifier)) {
    errors.identifier =
      form.role === 'student'
        ? 'Student ID must be at least 3 characters with no spaces.'
        : 'Username must be at least 3 characters with no spaces.';
  }

  if (!form.password) {
    errors.password = 'Please enter your password.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateForgotPasswordEmail(email: string): {
  isValid: boolean;
  error?: string;
} {
  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter your registered email address.' };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g. name@institution.edu).',
    };
  }
  return { isValid: true };
}

export interface ServerAuthResponse {
  authenticated: boolean;
  verified_role?: LoginRole;
  message?: string;
}

export function resolveVerifiedDashboardRoute(
  requestedRole: LoginRole,
  serverResponse: ServerAuthResponse
): {
  allowed: boolean;
  targetRoute?: AppRoute;
  error?: string;
} {
  if (!serverResponse.authenticated || !serverResponse.verified_role) {
    return {
      allowed: false,
      error: serverResponse.message || 'Invalid credentials. Please verify your details and try again.',
    };
  }

  if (serverResponse.verified_role !== requestedRole) {
    return {
      allowed: false,
      error:
        'Your account role does not match the selected login portal. Please switch to the appropriate role tab.',
    };
  }

  switch (serverResponse.verified_role) {
    case 'student':
      return { allowed: true, targetRoute: { name: 'student-dashboard' } };
    case 'librarian':
      return { allowed: true, targetRoute: { name: 'librarian-dashboard' } };
    case 'admin':
      return { allowed: true, targetRoute: { name: 'admin-dashboard' } };
  }
}

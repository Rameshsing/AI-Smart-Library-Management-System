import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Info,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import type { AppRoute } from '../data/libraryData';
import { googleSignIn, signInFirebaseEmailAccount } from '../lib/firebase';
import {
  fetchUserProfileFromFirestore,
  syncUserProfileToFirestore,
} from '../lib/firestoreLibrary';
import { getApiBaseUrl, isBackendConnected } from '../utils/apiConfig';
import { apiFetch, clearClientSessionToken, saveClientSessionToken  } from '../utils/clientSession';
import { BrandLogo } from './BrandLogo';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  LOGIN_ILLUSTRATION_IMAGE,
  LOGIN_ROLE_CONFIGS,
  resolveVerifiedDashboardRoute,
  validateForgotPasswordEmail,
  validateLoginCredentials,
  type LoginRole,
  type LoginValidationErrors,
  type ServerAuthResponse,
} from '../utils/authLogin';

interface LoginPageProps {
  initialRole?: LoginRole;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

const BENEFITS = [
  {
    id: 'discover',
    icon: <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Discover books tailored to your interests.',
  },
  {
    id: 'track',
    icon: <History className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Track your borrowed books and reading history.',
  },
  {
    id: 'ai',
    icon: <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Get intelligent recommendations powered by AI.',
  },
];

const ROLE_ORDER: LoginRole[] = ['student', 'librarian', 'admin'];

export function LoginPage({ initialRole = 'student', onNavigate }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<LoginRole>(initialRole);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<LoginValidationErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [illustrationError, setIllustrationError] = useState(false);

  // Forgot password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState<string | null>(null);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [resetSubmitted, setResetSubmitted] = useState(false);

  useEffect(() => {
    setSelectedRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    if (!forgotModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setForgotModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [forgotModalOpen]);

  const roleConfig = LOGIN_ROLE_CONFIGS[selectedRole];

  const handleRoleChange = (nextRole: LoginRole) => {
    if (nextRole === selectedRole) return;
    setSelectedRole(nextRole);
    setFieldErrors({});
    setAuthError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateLoginCredentials({
      role: selectedRole,
      identifier,
      password,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setAuthError('Please check the highlighted credentials and try again.');
      return;
    }

    setFieldErrors({});
    setAuthError(null);
    setIsSubmitting(true);

    const configuredApiBase = getApiBaseUrl();

    try {
      if (!isBackendConnected()) {
        setAuthError('Authentication server is unavailable.');
        setIsSubmitting(false);
        return;
      }

      clearClientSessionToken();

      let response = await apiFetch(`${configuredApiBase}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          requested_role: selectedRole,
          remember_me: roleConfig.showRememberMe ? rememberMe : false,
        }),
      });

      let payload: ServerAuthResponse = { authenticated: false };
      try {
        payload = (await response.json()) as ServerAuthResponse;
      } catch {
        // Leave default unauthenticated payload
      }

      if (
        !response.ok &&
        response.status === 401 &&
        selectedRole === 'student' &&
        identifier.includes('@')
      ) {
        const fbSignIn = await signInFirebaseEmailAccount(identifier.trim(), password);
        if (fbSignIn.signedIn) {
          const restoredProfile = await fetchUserProfileFromFirestore(fbSignIn.user.uid).catch(
            () => null
          );
          const restoreResponse = await apiFetch(`${configuredApiBase}/api/auth/firebase-restore`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_token: fbSignIn.idToken,
              password,
              requested_role: selectedRole,
              remember_me: roleConfig.showRememberMe ? rememberMe : false,
              profile_hint: restoredProfile ?? undefined,
            }),
          });
          response = restoreResponse;
          try {
            payload = (await restoreResponse.json()) as ServerAuthResponse;
          } catch {
            payload = { authenticated: false };
          }
        }
      }

      if (!response.ok) {
        setAuthError(
          payload.message || 'Invalid credentials. Please verify your email/ID and password.'
        );
        setIsSubmitting(false);
        return;
      }

      const resolution = resolveVerifiedDashboardRoute(selectedRole, payload);
      if (!resolution.allowed || !resolution.targetRoute) {
        setAuthError(
          resolution.error || 'Account verification failed. Please check your credentials.'
        );
        setIsSubmitting(false);
        return;
      }

      if (payload.session_token) {
        saveClientSessionToken(
          payload.session_token,
          roleConfig.showRememberMe ? rememberMe : false
        );
      }

      setIsSubmitting(false);
      onNavigate(resolution.targetRoute);
    } catch {
      setAuthError(
        'Unable to reach the authentication server. Your entered details have been preserved.'
      );
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isSubmitting) return;
    setFieldErrors({});
    setAuthError(null);
    setIsSubmitting(true);

    const configuredApiBase = getApiBaseUrl();
    try {
      if (!isBackendConnected()) {
        setAuthError('Authentication server is unavailable.');
        setIsSubmitting(false);
        return;
      }

      clearClientSessionToken();
      const googleResult = await googleSignIn();
      const savedFirestoreProfile = await fetchUserProfileFromFirestore(
        googleResult.user.uid
      ).catch(() => null);

      const response = await apiFetch(`${configuredApiBase}/api/auth/firebase-google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_token: googleResult.idToken,
          requested_role: selectedRole,
          remember_me: roleConfig.showRememberMe ? rememberMe : false,
          profile_hint: savedFirestoreProfile ?? undefined,
        }),
      });

      type GoogleLoginPayload = ServerAuthResponse & {
        user?: { email?: string; code?: string };
        student?: {
          name?: string;
          student_code?: string;
          course_department?: string;
          academic_year?: string;
          interests?: string[];
          preferred_subjects?: string[];
        };
        librarian?: { full_name?: string; department_title?: string };
        admin?: { full_name?: string; designation?: string };
      };

      let payload: GoogleLoginPayload = { authenticated: false };
      try {
        payload = (await response.json()) as GoogleLoginPayload;
      } catch {
        // Leave default unauthenticated payload
      }

      if (!response.ok) {
        setAuthError(
          payload.message || 'Google sign-in could not be verified for this account role.'
        );
        setIsSubmitting(false);
        return;
      }

      const resolution = resolveVerifiedDashboardRoute(selectedRole, payload);
      if (!resolution.allowed || !resolution.targetRoute) {
        setAuthError(
          resolution.error || 'Account verification failed for the selected role.'
        );
        setIsSubmitting(false);
        return;
      }

      if (payload.session_token) {
        saveClientSessionToken(
          payload.session_token,
          roleConfig.showRememberMe ? rememberMe : false
        );
      }

      void syncUserProfileToFirestore({
        uid: googleResult.user.uid,
        displayName:
          savedFirestoreProfile?.displayName ||
          payload.student?.name ||
          payload.librarian?.full_name ||
          payload.admin?.full_name ||
          googleResult.user.displayName ||
          'Library Member',
        email: googleResult.user.email || payload.user?.email || '',
        department:
          savedFirestoreProfile?.department ||
          payload.student?.course_department ||
          payload.librarian?.department_title ||
          'Library Member',
        academicYear:
          savedFirestoreProfile?.academicYear ||
          payload.student?.academic_year ||
          payload.admin?.designation ||
          'Active',
        interests:
          savedFirestoreProfile?.interests?.length
            ? savedFirestoreProfile.interests
            : payload.student?.interests,
        preferredSubjects:
          savedFirestoreProfile?.preferredSubjects?.length
            ? savedFirestoreProfile.preferredSubjects
            : payload.student?.preferred_subjects,
        studentCode:
          savedFirestoreProfile?.studentCode ||
          payload.student?.student_code ||
          payload.user?.code,
      }).catch(() => {
        // Firestore sync errors should not block library session login
      });

      setIsSubmitting(false);
      onNavigate(resolution.targetRoute);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or failed. Please try again.'
      );
      setIsSubmitting(false);
    }
  };

  const openForgotModal = () => {
    if (identifier.includes('@') && !resetEmail) {
      setResetEmail(identifier.trim());
    }
    setResetEmailError(null);
    setResetSubmitted(false);
    setForgotModalOpen(true);
  };

  const handleForgotSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isResetSubmitting) return;

    const validation = validateForgotPasswordEmail(resetEmail);
    if (!validation.isValid) {
      setResetEmailError(validation.error ?? 'Please enter a valid email address.');
      return;
    }

    setResetEmailError(null);
    setIsResetSubmitting(true);

    const configuredApiBase = getApiBaseUrl();
    try {
      if (isBackendConnected()) {
        await apiFetch(`${configuredApiBase}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: resetEmail.trim().toLowerCase(),
            requested_role: selectedRole,
          }),
        });
      }
      setResetSubmitted(true);
    } catch {
      // Neutral confirmation message avoids account enumeration even on transient issues
      setResetSubmitted(true);
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `min-h-[44px] w-full rounded-lg border bg-white py-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-300 focus:border-[#2563EB] focus:ring-[#DBEAFE]'
    }`;

  return (
    <section
      aria-labelledby="login-card-heading"
      className="bg-[#F5F8FC] py-8 sm:py-12 lg:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Utility Navigation */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: 'home' });
            }}
            className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#142B4A] transition-colors hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-md"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </a>

          <span className="font-mono-tabular text-xs font-medium text-slate-500">
            Account Portal · /{selectedRole === 'student' ? 'login' : 'admin-login'}
          </span>
        </div>

        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* LEFT SECTION (Desktop): Brand Identity, Welcome Copy, Illustration & 3 Benefits */}
          <aside className="hidden lg:block lg:col-span-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
              <BrandLogo
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate({ name: 'home' });
                }}
              />

              <h1 className="font-display mt-6 text-3xl font-bold tracking-tight text-[#142B4A] [text-wrap:balance]">
                Welcome Back to Your Learning Journey
              </h1>

              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Sign in to discover books, explore personalised recommendations, and manage your
                reading activity.
              </p>

              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-[#F5F8FC]">
                {!illustrationError ? (
                  <img
                    src={LOGIN_ILLUSTRATION_IMAGE}
                    alt="Quiet academic library reading alcove with recommended book titles on a discovery display"
                    referrerPolicy="no-referrer"
                    onError={() => setIllustrationError(true)}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-6 text-center">
                    <BookOpen className="h-10 w-10 text-[#2563EB]" aria-hidden="true" />
                    <p className="mt-2 font-display text-sm font-semibold text-[#142B4A]">
                      AI Smart Library Portal
                    </p>
                  </div>
                )}
              </div>

              <ul className="mt-6 space-y-3.5 border-t border-slate-200 pt-6">
                {BENEFITS.map((benefit) => (
                  <li key={benefit.id} className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                      {benefit.icon}
                    </span>
                    <span className="text-sm font-medium text-[#142B4A]">{benefit.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* RIGHT SECTION: Centered Login Card */}
          <div className="mx-auto w-full max-w-lg lg:col-span-6 lg:max-w-none">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
              {/* Mobile/Tablet compact brand header */}
              <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4 lg:hidden">
                <BrandLogo
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'home' });
                  }}
                />
              </div>

              <header>
                <h2
                  id="login-card-heading"
                  className="font-display text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl"
                >
                  Sign in to your account
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
                  Enter your credentials to continue.
                </p>
              </header>

              {/* Role Selection Tabs */}
              <div className="mt-6">
                <span className="mb-2 block text-xs font-semibold text-slate-500">
                  Select Account Role
                </span>
                <div
                  role="tablist"
                  aria-label="Login role selection"
                  className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-1"
                >
                  {ROLE_ORDER.map((roleKey) => {
                    const cfg = LOGIN_ROLE_CONFIGS[roleKey];
                    const isActive = selectedRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        role="tab"
                        type="button"
                        aria-selected={isActive}
                        aria-controls={`login-panel-${roleKey}`}
                        id={`login-tab-${roleKey}`}
                        onClick={() => handleRoleChange(roleKey)}
                        className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-150 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                          isActive
                            ? 'bg-[#142B4A] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-white hover:text-[#142B4A]'
                        }`}
                      >
                        {cfg.tabLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Backend Integration & Role Verification Notice */}
              <div className="mt-5 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-relaxed text-slate-700">
                    {roleConfig.securityNote}
                  </p>
                </div>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                    aria-hidden="true"
                  />
                  <span>{authError}</span>
                </div>
              )}

              {/* Role-Specific Login Form */}
              <form
                id={`login-panel-${selectedRole}`}
                role="tabpanel"
                aria-labelledby={`login-tab-${selectedRole}`}
                onSubmit={handleLoginSubmit}
                noValidate
                className="mt-6 space-y-5"
              >
                {/* Identifier Field */}
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                  >
                    {roleConfig.identifierLabel} <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <UserCheck
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="login-identifier"
                      name="identifier"
                      type="text"
                      autoComplete={roleConfig.identifierAutoComplete}
                      required
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (fieldErrors.identifier) {
                          setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                        }
                        if (authError) setAuthError(null);
                      }}
                      placeholder={roleConfig.identifierPlaceholder}
                      aria-invalid={Boolean(fieldErrors.identifier)}
                      aria-describedby={
                        fieldErrors.identifier ? 'login-identifier-error' : undefined
                      }
                      className={`${inputClass(Boolean(fieldErrors.identifier))} pl-10 pr-3.5`}
                    />
                  </div>
                  {fieldErrors.identifier && (
                    <p id="login-identifier-error" className="mt-1.5 text-xs text-red-600">
                      {fieldErrors.identifier}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                  >
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                        if (authError) setAuthError(null);
                      }}
                      placeholder="Enter your password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                      className={`${inputClass(Boolean(fieldErrors.password))} pl-10 pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p id="login-password-error" className="mt-1.5 text-xs text-red-600">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Remember Me & Forgot Password Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
                  {roleConfig.showRememberMe ? (
                    <label
                      htmlFor="login-remember"
                      className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer"
                    >
                      <input
                        id="login-remember"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                      />
                      <span>Remember me</span>
                    </label>
                  ) : (
                    <span className="text-xs text-slate-500">Strict session-only mode</span>
                  )}

                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-sm font-semibold text-[#2563EB] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-sm cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
                >
                  <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                  {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <span className="h-px w-full bg-slate-200" aria-hidden="true" />
                  <span className="bg-white px-3 text-xs font-medium text-slate-400">or</span>
                  <span className="h-px w-full bg-slate-200" aria-hidden="true" />
                </div>

                <GoogleSignInButton
                  onClick={() => void handleGoogleLogin()}
                  disabled={isSubmitting}
                  label="Sign in with Google"
                  className="w-full"
                />
              </form>

              {/* Student Registration Link (ONLY for Student role) */}
              {roleConfig.showStudentSignupLink ? (
                <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
                  Don&apos;t have an account?{' '}
                  <a
                    href="/signup"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate({ name: 'signup' });
                    }}
                    className="font-semibold text-[#2563EB] hover:underline"
                  >
                    Create a student account
                  </a>
                </p>
              ) : (
                <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-500">
                  Staff and administrator accounts cannot be registered publicly. Contact an
                  authorized administrator for account provisioning.
                </p>
              )}

              {/* Collapsible Demo Account Credentials (fills form inputs cleanly for real server auth) */}
              <details className="mt-5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3 text-xs text-[#1E293B]">
                <summary className="cursor-pointer font-semibold text-[#142B4A] select-none">
                  Sample Demo Accounts (Optional)
                </summary>
                <div className="mt-2.5 space-y-2">
                  <p className="text-[11px] leading-relaxed text-[#64748B]">
                    Accounts created via Sign Up work directly with the live database. You can also
                    autofill a pre-seeded sample account below to test Librarian, Admin, or Student
                    portals:
                  </p>
                  {[
                    {
                      role: 'student' as LoginRole,
                      label: 'Student (Ananya Verma)',
                      id: 'ananya.verma@university.edu',
                      pass: 'Student@123',
                    },
                    {
                      role: 'student' as LoginRole,
                      label: 'Cold-Start Student (Rohan Kulkarni)',
                      id: 'rohan.kulkarni@university.edu',
                      pass: 'Student@123',
                    },
                    {
                      role: 'librarian' as LoginRole,
                      label: 'Librarian (Priya Nair)',
                      id: 'priya.nair@smartlibrary.edu',
                      pass: 'Librarian@123',
                    },
                    {
                      role: 'admin' as LoginRole,
                      label: 'Admin (Dr. Arvind Mehta)',
                      id: 'arvind.mehta@smartlibrary.edu',
                      pass: 'Admin@123',
                    },
                  ].map((acct) => (
                    <div
                      key={acct.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#142B4A]">{acct.label}</p>
                        <p className="truncate font-mono text-[11px] text-[#64748B]">
                          {acct.id} · {acct.pass}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRole(acct.role);
                          setIdentifier(acct.id);
                          setPassword(acct.pass);
                          setFieldErrors({});
                          setAuthError(null);
                        }}
                        className="rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer"
                      >
                        Fill
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-password-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setForgotModalOpen(false);
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setForgotModalOpen(false)}
                aria-label="Close password reset dialog"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <h3
              id="forgot-password-heading"
              className="font-display mt-4 text-xl font-bold text-[#142B4A]"
            >
              Reset Your Password
            </h3>

            {resetSubmitted ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  <p>
                    If an account is registered with that email address, password reset instructions
                    have been prepared.
                  </p>
                </div>

                <div className="rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-3.5 text-xs leading-relaxed text-slate-600">
                  <strong className="font-semibold text-[#142B4A]">
                    Password Reset Request Logged:
                  </strong>{' '}
                  Your request was recorded by the library server (`/api/auth/forgot-password`).
                  Please contact a library administrator if you need immediate password recovery.
                </div>

                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#142B4A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E3A63] cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} noValidate className="mt-3 space-y-4">
                <p className="text-sm leading-relaxed text-slate-600">
                  Enter your registered email address and we will prepare instructions to reset your
                  password.
                </p>

                <div>
                  <label
                    htmlFor="forgot-email"
                    className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                  >
                    Registered Email Address <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        if (resetEmailError) setResetEmailError(null);
                      }}
                      placeholder="Enter your registered email address"
                      aria-invalid={Boolean(resetEmailError)}
                      aria-describedby={resetEmailError ? 'forgot-email-error' : undefined}
                      className={`${inputClass(Boolean(resetEmailError))} pl-10 pr-3.5`}
                    />
                  </div>
                  {resetEmailError && (
                    <p id="forgot-email-error" className="mt-1.5 text-xs text-red-600">
                      {resetEmailError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
                  >
                    {isResetSubmitting ? 'Submitting...' : 'Send Reset Instructions'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

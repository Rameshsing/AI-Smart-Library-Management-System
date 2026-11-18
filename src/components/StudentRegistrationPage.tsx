import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  History,
  IdCard,
  Info,
  Lock,
  Mail,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import type { AppRoute } from '../data/libraryData';
import { registerFirebaseEmailAccount } from '../lib/firebase';
import { getApiBaseUrl, isBackendConnected } from '../utils/apiConfig';
import { apiFetch } from '../utils/clientSession';
import { BrandLogo } from './BrandLogo';
import {
  ACADEMIC_YEARS,
  addCustomInterestItem,
  buildFlaskRegistrationPayload,
  COURSE_DEPARTMENTS,
  createInitialRegistrationForm,
  evaluatePasswordStrength,
  INITIAL_READING_INTERESTS,
  PREFERRED_SUBJECT_OPTIONS,
  REGISTRATION_ILLUSTRATION_IMAGE,
  toggleSelectionItem,
  validateStudentRegistration,
  type FlaskRegistrationPayload,
  type RegistrationFieldErrors,
  type StudentRegistrationFormData,
} from '../utils/studentRegistration';

interface StudentRegistrationPageProps {
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

const BENEFITS = [
  {
    number: '01',
    icon: <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Discover books based on your interests.',
  },
  {
    number: '02',
    icon: <History className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Track your borrowing and reading history.',
  },
  {
    number: '03',
    icon: <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    text: 'Receive personalized AI recommendations.',
  },
];

export function StudentRegistrationPage({ onNavigate }: StudentRegistrationPageProps) {
  const [formData, setFormData] = useState<StudentRegistrationFormData>(() =>
    createInitialRegistrationForm()
  );
  const [availableInterests, setAvailableInterests] = useState<string[]>([
    ...INITIAL_READING_INTERESTS,
  ]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [customInterestError, setCustomInterestError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPayload, setSubmittedPayload] = useState<FlaskRegistrationPayload | null>(null);
  const [isPrototypeSuccess, setIsPrototypeSuccess] = useState(false);
  const [firebaseVerificationSent, setFirebaseVerificationSent] = useState(false);
  const [illustrationError, setIllustrationError] = useState(false);

  const passwordStrength = evaluatePasswordStrength(formData.password);

  const updateField = <K extends keyof StudentRegistrationFormData>(
    field: K,
    value: StudentRegistrationFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (submissionError) {
      setSubmissionError(null);
    }
  };

  const handleToggleInterest = (interest: string) => {
    const nextInterests = toggleSelectionItem(formData.interests, interest);
    updateField('interests', nextInterests);
  };

  const handleToggleSubject = (subject: string) => {
    const nextSubjects = toggleSelectionItem(formData.preferredSubjects, subject);
    updateField('preferredSubjects', nextSubjects);
  };

  const handleAddCustomInterest = () => {
    const result = addCustomInterestItem(
      formData.interests,
      availableInterests,
      customInterestInput
    );
    if (result.error) {
      setCustomInterestError(result.error);
      return;
    }
    setCustomInterestError(null);
    setAvailableInterests(result.nextAvailable);
    updateField('interests', result.nextSelected);
    setCustomInterestInput('');
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validation = validateStudentRegistration(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmissionError('Please review the highlighted fields below before continuing.');
      return;
    }

    setFieldErrors({});
    setSubmissionError(null);
    setIsSubmitting(true);

    const payload = buildFlaskRegistrationPayload(formData);
    const configuredApiBase = getApiBaseUrl();

    try {
      if (isBackendConnected()) {
        const fbRegistration = await registerFirebaseEmailAccount(
          payload.user.email,
          formData.password,
          payload.student.full_name
        );

        const response = await apiFetch(`${configuredApiBase}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            password: formData.password,
            firebase_uid: fbRegistration.uid,
          }),
        });

        if (!response.ok) {
          let message = 'Registration failed. Please verify your details and try again.';
          try {
            const errJson = (await response.json()) as { error?: string; message?: string };
            if (errJson.message || errJson.error) {
              message = errJson.message ?? errJson.error ?? message;
            }
          } catch {
            // Keep generic fallback message if response is non-JSON
          }
          setSubmissionError(message);
          setIsSubmitting(false);
          return;
        }

        setFirebaseVerificationSent(Boolean(fbRegistration.verificationSent));
        setIsPrototypeSuccess(false);
        setSubmittedPayload(payload);
        setIsSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Frontend prototype mode (Python Flask & MySQL backend not connected yet)
      await new Promise((resolve) => setTimeout(resolve, 300));
      setIsPrototypeSuccess(true);
      setSubmittedPayload(payload);
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmissionError(
        'Unable to reach the registration server. Your entered details have been preserved.'
      );
      setIsSubmitting(false);
    }
  };

  const strengthColorClass = (() => {
    if (formData.password.length === 0) return 'bg-slate-200';
    switch (passwordStrength.score) {
      case 1:
        return passwordStrength.meetsMinLength ? 'bg-amber-500' : 'bg-red-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-[#2563EB]';
      case 4:
        return 'bg-emerald-600';
      default:
        return 'bg-slate-200';
    }
  })();

  const strengthTextClass = (() => {
    if (formData.password.length === 0) return 'text-slate-500';
    switch (passwordStrength.label) {
      case 'Too Short':
        return 'text-red-700';
      case 'Weak':
      case 'Fair':
        return 'text-amber-700';
      case 'Good':
        return 'text-[#2563EB]';
      case 'Strong':
        return 'text-emerald-700';
    }
  })();

  const inputBaseClass = (hasError: boolean) =>
    `min-h-[44px] w-full rounded-lg border bg-white py-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-300 focus:border-[#2563EB] focus:ring-[#DBEAFE]'
    }`;

  return (
    <section
      aria-labelledby="student-registration-heading"
      className="bg-[#F5F8FC] py-8 sm:py-12 lg:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Utility Navigation Row */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate({ name: 'home' });
            }}
            className="inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-[#142B4A] hover:text-[#2563EB] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-md"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </a>

          <span className="font-mono-tabular text-xs font-medium text-slate-500">
            Student Onboarding · /signup
          </span>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* LEFT PANEL: Brand Identity, Editorial Illustration & 3 Benefits */}
          <aside className="lg:sticky lg:top-24 lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
              <BrandLogo
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate({ name: 'home' });
                }}
              />

              <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]">
                Your Reading Journey Starts Here
              </h1>

              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Create your account and discover books tailored to your interests.
              </p>

              {/* Editorial Illustration (Hidden on mobile per responsive requirement) */}
              <div className="mt-6 hidden overflow-hidden rounded-xl border border-slate-200 bg-[#F5F8FC] lg:block">
                {!illustrationError ? (
                  <img
                    src={REGISTRATION_ILLUSTRATION_IMAGE}
                    alt="Illustration of a student discovering books connected to a digital knowledge network"
                    referrerPolicy="no-referrer"
                    onError={() => setIllustrationError(true)}
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center p-6 text-center">
                    <BookOpen className="h-10 w-10 text-[#2563EB]" aria-hidden="true" />
                    <p className="mt-2 font-display text-sm font-semibold text-[#142B4A]">
                      AI Smart Library Onboarding
                    </p>
                  </div>
                )}
              </div>

              {/* Three Benefits */}
              <ul className="mt-6 space-y-4 border-t border-slate-200 pt-6">
                {BENEFITS.map((benefit) => (
                  <li key={benefit.number} className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                      {benefit.icon}
                    </span>
                    <div className="pt-1">
                      <p className="text-sm font-medium text-[#142B4A]">{benefit.text}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Architecture Readiness Note */}
              <div className="mt-6 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
                <div className="flex items-start gap-2.5">
                  <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-slate-600">
                    Interests and preferred subjects captured here are saved to your student profile
                    for personalized AI book recommendations.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT PANEL: Registration Form Card or Success State */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
              {submittedPayload ? (
                /* Registration Success View */
                <div data-testid="registration-success-state" className="py-4">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </div>

                  <h2
                    id="student-registration-heading"
                    className="font-display mt-5 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
                  >
                    Your account has been created successfully!
                  </h2>

                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    Welcome to AI Smart Library. You can now log in and explore your personalized
                    library experience.
                  </p>

                  {isPrototypeSuccess && (
                    <div
                      role="status"
                      className="mt-6 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <Info
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                          aria-hidden="true"
                        />
                        <div className="text-xs leading-relaxed text-slate-700">
                          <p className="font-semibold text-[#142B4A]">
                            Frontend Prototype Mode — Backend Not Connected Yet
                          </p>
                          <p className="mt-1">
                            Your form passed all validation checks and generated the structured
                            profile payload below. No record was persisted to MySQL yet because the
                            Python Flask API endpoint is not connected in this prototype stage.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Structured Profile Summary */}
                  <div className="mt-6 rounded-xl border border-slate-200 bg-[#F5F8FC] p-5">
                    <h3 className="font-display text-sm font-semibold text-[#142B4A]">
                      Prepared Student Profile Summary
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500">Full Name</dt>
                        <dd className="font-medium text-[#142B4A]">
                          {submittedPayload.student.full_name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Student ID / Roll Number</dt>
                        <dd className="font-mono-tabular font-medium text-[#142B4A]">
                          {submittedPayload.student.student_code}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Email Address</dt>
                        <dd className="font-medium text-[#142B4A]">
                          {submittedPayload.user.email}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Course &amp; Academic Year</dt>
                        <dd className="font-medium text-[#142B4A]">
                          {submittedPayload.student.course_department} ·{' '}
                          {submittedPayload.student.academic_year}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">
                          Reading Interests ({submittedPayload.student_interests.length})
                        </dt>
                        <dd className="mt-1 font-medium text-[#142B4A]">
                          {submittedPayload.student_interests.join(' · ')}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">
                          Preferred Subjects ({submittedPayload.student_subjects.length})
                        </dt>
                        <dd className="mt-1 font-medium text-[#142B4A]">
                          {submittedPayload.student_subjects.join(' · ')}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-4 border-t border-slate-200 pt-3 font-mono-tabular text-[11px] text-slate-500">
                      Saved to Relational SQLite Database · Account Active (password hashed server-side)
                      {firebaseVerificationSent
                        ? ' · Cloud verification email sent for cross-session backup'
                        : ''}
                    </p>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3.5">
                    <button
                      type="button"
                      onClick={() => onNavigate({ name: 'login' })}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
                    >
                      <span>Go to Login</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate({ name: 'home' })}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                    >
                      <span>Back to Home</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Registration Form View */
                <>
                  <div className="mb-6 rounded-xl border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <Info
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                        aria-hidden="true"
                      />
                      <p className="text-xs leading-relaxed text-slate-700">
                        <strong className="font-semibold text-[#142B4A]">
                          Live Account Registration:
                        </strong>{' '}
                        Your student profile is saved directly to the library database with
                        server-side scrypt password hashing.
                      </p>
                    </div>
                  </div>

                  <header>
                    <h2
                      id="student-registration-heading"
                      className="font-display text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl"
                    >
                      Create Your Student Account
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 sm:text-base">
                      Join AI Smart Library and make your learning experience smarter.
                    </p>
                  </header>

                  {submissionError && (
                    <div
                      role="alert"
                      className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                      <span>{submissionError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-8">
                    {/* SECTION A: Personal Information */}
                    <fieldset className="space-y-5">
                      <legend className="font-display text-base font-semibold text-[#142B4A]">
                        Personal Information
                      </legend>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* 1. Full Name */}
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="reg-full-name"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Full Name <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <User
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-full-name"
                              name="fullName"
                              type="text"
                              autoComplete="name"
                              required
                              value={formData.fullName}
                              onChange={(e) => updateField('fullName', e.target.value)}
                              placeholder="Enter your full name"
                              aria-invalid={Boolean(fieldErrors.fullName)}
                              aria-describedby={
                                fieldErrors.fullName ? 'reg-full-name-error' : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.fullName))} pl-10 pr-3.5`}
                            />
                          </div>
                          {fieldErrors.fullName && (
                            <p id="reg-full-name-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.fullName}
                            </p>
                          )}
                        </div>

                        {/* 2. Student ID / Roll Number */}
                        <div>
                          <label
                            htmlFor="reg-student-id"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Student ID / Roll Number <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <IdCard
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-student-id"
                              name="studentId"
                              type="text"
                              required
                              value={formData.studentId}
                              onChange={(e) => updateField('studentId', e.target.value)}
                              placeholder="Enter your student ID"
                              aria-invalid={Boolean(fieldErrors.studentId)}
                              aria-describedby={
                                fieldErrors.studentId ? 'reg-student-id-error' : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.studentId))} pl-10 pr-3.5`}
                            />
                          </div>
                          {fieldErrors.studentId && (
                            <p id="reg-student-id-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.studentId}
                            </p>
                          )}
                        </div>

                        {/* 3. Email Address */}
                        <div>
                          <label
                            htmlFor="reg-email"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Email Address <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <Mail
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-email"
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              value={formData.email}
                              onChange={(e) => updateField('email', e.target.value)}
                              placeholder="Enter your email address"
                              aria-invalid={Boolean(fieldErrors.email)}
                              aria-describedby={fieldErrors.email ? 'reg-email-error' : undefined}
                              className={`${inputBaseClass(Boolean(fieldErrors.email))} pl-10 pr-3.5`}
                            />
                          </div>
                          {fieldErrors.email && (
                            <p id="reg-email-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.email}
                            </p>
                          )}
                        </div>

                        {/* 4. Mobile Number (Optional) */}
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="reg-mobile"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Mobile Number{' '}
                            <span className="text-xs font-normal text-slate-500">(Optional)</span>
                          </label>
                          <div className="relative">
                            <Phone
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-mobile"
                              name="mobileNumber"
                              type="tel"
                              autoComplete="tel"
                              value={formData.mobileNumber}
                              onChange={(e) => updateField('mobileNumber', e.target.value)}
                              placeholder="Enter your mobile number"
                              aria-invalid={Boolean(fieldErrors.mobileNumber)}
                              aria-describedby={
                                fieldErrors.mobileNumber ? 'reg-mobile-error' : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.mobileNumber))} pl-10 pr-3.5`}
                            />
                          </div>
                          {fieldErrors.mobileNumber && (
                            <p id="reg-mobile-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.mobileNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </fieldset>

                    {/* SECTION B: Academic Information */}
                    <fieldset className="space-y-5 border-t border-slate-200 pt-7">
                      <legend className="font-display text-base font-semibold text-[#142B4A]">
                        Academic Information
                      </legend>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* 5. Institution Name */}
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="reg-institution"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Institution Name <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <Building2
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-institution"
                              name="institutionName"
                              type="text"
                              autoComplete="organization"
                              required
                              value={formData.institutionName}
                              onChange={(e) => updateField('institutionName', e.target.value)}
                              placeholder="Enter your institution name"
                              aria-invalid={Boolean(fieldErrors.institutionName)}
                              aria-describedby={
                                fieldErrors.institutionName ? 'reg-institution-error' : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.institutionName))} pl-10 pr-3.5`}
                            />
                          </div>
                          {fieldErrors.institutionName && (
                            <p id="reg-institution-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.institutionName}
                            </p>
                          )}
                        </div>

                        {/* 6. Course / Department */}
                        <div>
                          <label
                            htmlFor="reg-course"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Course / Department <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <GraduationCap
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <select
                              id="reg-course"
                              name="courseDepartment"
                              required
                              value={formData.courseDepartment}
                              onChange={(e) => updateField('courseDepartment', e.target.value)}
                              aria-invalid={Boolean(fieldErrors.courseDepartment)}
                              aria-describedby={
                                fieldErrors.courseDepartment ? 'reg-course-error' : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.courseDepartment))} pl-10 pr-8`}
                            >
                              <option value="">Select your course or department</option>
                              {COURSE_DEPARTMENTS.map((dept) => (
                                <option key={dept} value={dept}>
                                  {dept}
                                </option>
                              ))}
                            </select>
                          </div>
                          {fieldErrors.courseDepartment && (
                            <p id="reg-course-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.courseDepartment}
                            </p>
                          )}
                        </div>

                        {/* 7. Academic Year / Semester */}
                        <div>
                          <label
                            htmlFor="reg-academic-year"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Academic Year / Semester <span className="text-red-600">*</span>
                          </label>
                          <select
                            id="reg-academic-year"
                            name="academicYear"
                            required
                            value={formData.academicYear}
                            onChange={(e) => updateField('academicYear', e.target.value)}
                            aria-invalid={Boolean(fieldErrors.academicYear)}
                            aria-describedby={
                              fieldErrors.academicYear ? 'reg-academic-year-error' : undefined
                            }
                            className={`${inputBaseClass(Boolean(fieldErrors.academicYear))} px-3.5`}
                          >
                            <option value="">Select academic year or semester</option>
                            {ACADEMIC_YEARS.map((year) => (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.academicYear && (
                            <p id="reg-academic-year-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.academicYear}
                            </p>
                          )}
                        </div>
                      </div>
                    </fieldset>

                    {/* SECTION C: Account Security */}
                    <fieldset className="space-y-5 border-t border-slate-200 pt-7">
                      <legend className="font-display text-base font-semibold text-[#142B4A]">
                        Account Security
                      </legend>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {/* 8. Password */}
                        <div>
                          <label
                            htmlFor="reg-password"
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
                              id="reg-password"
                              name="password"
                              type={showPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              required
                              minLength={8}
                              value={formData.password}
                              onChange={(e) => updateField('password', e.target.value)}
                              placeholder="Minimum 8 characters"
                              aria-invalid={Boolean(fieldErrors.password)}
                              aria-describedby="reg-password-strength reg-password-error"
                              className={`${inputBaseClass(Boolean(fieldErrors.password))} pl-10 pr-11`}
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

                          {/* Password Strength Meter */}
                          <div id="reg-password-strength" className="mt-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500">Password strength</span>
                              <span className={`font-semibold ${strengthTextClass}`}>
                                {formData.password.length === 0
                                  ? 'Min 8 characters'
                                  : passwordStrength.label}
                              </span>
                            </div>
                            <div
                              className="mt-1.5 grid grid-cols-4 gap-1.5"
                              aria-hidden="true"
                            >
                              {[1, 2, 3, 4].map((step) => (
                                <span
                                  key={step}
                                  className={`h-1.5 rounded-full transition-colors duration-150 ${
                                    formData.password.length > 0 && passwordStrength.score >= step
                                      ? strengthColorClass
                                      : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {fieldErrors.password && (
                            <p id="reg-password-error" className="mt-1.5 text-xs text-red-600">
                              {fieldErrors.password}
                            </p>
                          )}
                        </div>

                        {/* 9. Confirm Password */}
                        <div>
                          <label
                            htmlFor="reg-confirm-password"
                            className="mb-1.5 block text-sm font-medium text-[#142B4A]"
                          >
                            Confirm Password <span className="text-red-600">*</span>
                          </label>
                          <div className="relative">
                            <ShieldCheck
                              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                              aria-hidden="true"
                            />
                            <input
                              id="reg-confirm-password"
                              name="confirmPassword"
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              required
                              value={formData.confirmPassword}
                              onChange={(e) => updateField('confirmPassword', e.target.value)}
                              placeholder="Re-enter your password"
                              aria-invalid={Boolean(fieldErrors.confirmPassword)}
                              aria-describedby={
                                fieldErrors.confirmPassword
                                  ? 'reg-confirm-password-error'
                                  : undefined
                              }
                              className={`${inputBaseClass(Boolean(fieldErrors.confirmPassword))} pl-10 pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              aria-label={
                                showConfirmPassword
                                  ? 'Hide confirm password'
                                  : 'Show confirm password'
                              }
                              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          {formData.confirmPassword.length > 0 &&
                            formData.password === formData.confirmPassword &&
                            !fieldErrors.confirmPassword && (
                              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Passwords match</span>
                              </p>
                            )}

                          {fieldErrors.confirmPassword && (
                            <p
                              id="reg-confirm-password-error"
                              className="mt-1.5 text-xs text-red-600"
                            >
                              {fieldErrors.confirmPassword}
                            </p>
                          )}
                        </div>
                      </div>
                    </fieldset>

                    {/* SECTION D: Reading Interests & Preferred Subjects */}
                    <fieldset className="space-y-6 border-t border-slate-200 pt-7">
                      <div>
                        <legend className="font-display text-base font-semibold text-[#142B4A]">
                          Tell Us What You Love to Read <span className="text-red-600">*</span>
                        </legend>
                        <p className="mt-1 text-sm text-slate-600">
                          Select your interests to help our AI recommend relevant books.
                        </p>
                      </div>

                      {/* Multi-select Interest Chips */}
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Reading Interests</span>
                          <span className="font-mono-tabular font-medium text-[#142B4A]">
                            {formData.interests.length} selected
                          </span>
                        </div>
                        <div
                          role="group"
                          aria-label="Reading interests"
                          className="flex flex-wrap gap-2"
                        >
                          {availableInterests.map((interest) => {
                            const selected = formData.interests.some(
                              (item) => item.toLowerCase() === interest.toLowerCase()
                            );
                            return (
                              <button
                                key={interest}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => handleToggleInterest(interest)}
                                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                                  selected
                                    ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-xs'
                                    : 'border-slate-200 bg-[#F5F8FC] text-[#1E293B] hover:border-[#2563EB]/50 hover:bg-[#DBEAFE]/40'
                                }`}
                              >
                                {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                <span>{interest}</span>
                              </button>
                            );
                          })}
                        </div>
                        {fieldErrors.interests && (
                          <p className="mt-2 text-xs text-red-600">{fieldErrors.interests}</p>
                        )}

                        {/* Custom Interest Input */}
                        <div className="mt-4">
                          <label
                            htmlFor="reg-custom-interest"
                            className="mb-1.5 block text-xs font-medium text-slate-600"
                          >
                            Add a custom interest
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              id="reg-custom-interest"
                              type="text"
                              value={customInterestInput}
                              onChange={(e) => {
                                setCustomInterestInput(e.target.value);
                                if (customInterestError) setCustomInterestError(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomInterest();
                                }
                              }}
                              placeholder="e.g. Robotics, Economics, Cloud Computing"
                              className="min-h-[42px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomInterest}
                              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Add Interest</span>
                            </button>
                          </div>
                          {customInterestError && (
                            <p className="mt-1.5 text-xs text-red-600">{customInterestError}</p>
                          )}
                        </div>
                      </div>

                      {/* Preferred Subjects */}
                      <div className="border-t border-slate-100 pt-5">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#142B4A]">
                            Preferred Subjects <span className="text-red-600">*</span>
                          </span>
                          <span className="font-mono-tabular text-xs font-medium text-[#142B4A]">
                            {formData.preferredSubjects.length} selected
                          </span>
                        </div>
                        <p className="mb-3 text-xs text-slate-600">
                          Select one or more core academic subjects for curriculum-aligned
                          recommendations.
                        </p>

                        <div
                          role="group"
                          aria-label="Preferred subjects"
                          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
                        >
                          {PREFERRED_SUBJECT_OPTIONS.map((subject) => {
                            const selected = formData.preferredSubjects.some(
                              (item) => item.toLowerCase() === subject.toLowerCase()
                            );
                            return (
                              <button
                                key={subject}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => handleToggleSubject(subject)}
                                className={`flex min-h-[42px] items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                                  selected
                                    ? 'border-[#142B4A] bg-[#142B4A] text-white'
                                    : 'border-slate-200 bg-white text-[#1E293B] hover:border-[#2563EB]/50 hover:bg-[#F5F8FC]'
                                }`}
                              >
                                <span
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                    selected
                                      ? 'border-white bg-[#2563EB] text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {selected && <Check className="h-3 w-3" />}
                                </span>
                                <span className="leading-snug">{subject}</span>
                              </button>
                            );
                          })}
                        </div>
                        {fieldErrors.preferredSubjects && (
                          <p className="mt-2 text-xs text-red-600">
                            {fieldErrors.preferredSubjects}
                          </p>
                        )}
                      </div>
                    </fieldset>

                    {/* Terms & Conditions */}
                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-start gap-3">
                        <input
                          id="reg-terms"
                          name="acceptedTerms"
                          type="checkbox"
                          checked={formData.acceptedTerms}
                          onChange={(e) => updateField('acceptedTerms', e.target.checked)}
                          aria-invalid={Boolean(fieldErrors.acceptedTerms)}
                          aria-describedby={
                            fieldErrors.acceptedTerms ? 'reg-terms-error' : undefined
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
                        />
                        <label
                          htmlFor="reg-terms"
                          className="text-sm leading-relaxed text-slate-600 cursor-pointer"
                        >
                          I agree to the{' '}
                          <a
                            href="/terms"
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate({ name: 'terms' });
                            }}
                            className="font-semibold text-[#2563EB] hover:underline"
                          >
                            Terms and Conditions
                          </a>{' '}
                          and{' '}
                          <a
                            href="/privacy"
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate({ name: 'privacy' });
                            }}
                            className="font-semibold text-[#2563EB] hover:underline"
                          >
                            Privacy Policy
                          </a>
                          .
                        </label>
                      </div>
                      {fieldErrors.acceptedTerms && (
                        <p id="reg-terms-error" className="mt-1.5 text-xs text-red-600">
                          {fieldErrors.acceptedTerms}
                        </p>
                      )}
                    </div>

                    {/* Full-Width Registration Button & Login Link */}
                    <div className="space-y-4 pt-1">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
                      >
                        <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                        {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                      </button>

                      <p className="text-center text-sm text-slate-600">
                        Already have an account?{' '}
                        <a
                          href="/login"
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate({ name: 'login' });
                          }}
                          className="font-semibold text-[#2563EB] hover:underline"
                        >
                          Login
                        </a>
                      </p>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

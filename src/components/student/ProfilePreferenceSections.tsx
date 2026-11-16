import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  Info,
  Loader2,
  Lock,
  MailCheck,
  Plus,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  addCustomInterestItem,
  toggleSelectionItem,
} from '../../utils/studentRegistration';
import {
  filterTopicOptions,
  PROFILE_ACADEMIC_YEARS,
  PROFILE_COURSE_DEPARTMENTS,
  SEMESTER_OPTIONS,
  SUPPORTED_CONTENT_FORMATS,
  SUPPORTED_CONTENT_LANGUAGES,
  type AcademicInfoFieldErrors,
  type AcademicInfoRecord,
  type AvailabilityPreference,
  type DiscoveryPreference,
  type PersonalInfoDraft,
  type PersonalInfoFieldErrors,
  type ProfilePolicyFlags,
  type ReadingLevelPreference,
  type RecommendationPreferences,
} from '../../utils/studentProfilePage';

interface PersonalInfoSectionProps {
  draft: PersonalInfoDraft;
  savedEmail: string;
  studentCode: string;
  emailVerified: boolean;
  emailVerificationPending: string | null;
  policy: ProfilePolicyFlags;
  errors: PersonalInfoFieldErrors;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (next: PersonalInfoDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PersonalInfoSection({
  draft,
  savedEmail,
  studentCode,
  emailVerified,
  emailVerificationPending,
  policy,
  errors,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: PersonalInfoSectionProps) {
  const emailChanged =
    draft.email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      noValidate
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-display text-lg font-bold text-[#142B4A]">
          Personal Information
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Keep your contact details accurate for borrowing receipts, hold notifications, and
          library desk verification.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label
            htmlFor="profile-full-name"
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Full Name <span className="text-red-600">*</span>
          </label>
          <input
            id="profile-full-name"
            type="text"
            value={draft.full_name}
            disabled={isSaving}
            aria-invalid={Boolean(errors.full_name)}
            onChange={(e) => onChange({ ...draft, full_name: e.target.value })}
            placeholder="Enter your full name"
            className={`mt-1.5 min-h-[42px] w-full rounded-lg border px-3.5 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
              errors.full_name
                ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
            }`}
          />
          {errors.full_name && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.full_name}
            </p>
          )}
        </div>

        {/* Email Address */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="profile-email"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Email Address <span className="text-red-600">*</span>
            </label>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                emailVerified && !emailChanged ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {emailChanged
                  ? 'Verification required on save'
                  : emailVerified
                    ? 'Verified'
                    : 'Pending verification'}
              </span>
            </span>
          </div>
          <input
            id="profile-email"
            type="email"
            value={draft.email}
            disabled={isSaving}
            aria-invalid={Boolean(errors.email)}
            onChange={(e) => onChange({ ...draft, email: e.target.value })}
            placeholder="student@university.edu"
            className={`mt-1.5 min-h-[42px] w-full rounded-lg border px-3.5 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
              errors.email
                ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
            }`}
          />
          {errors.email ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.email}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
              Duplicate student emails are rejected by the server. Changing your email triggers
              verification before replacing your primary sign-in address.
            </p>
          )}
          {emailVerificationPending && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Verification link pending for{' '}
              <strong className="font-semibold">{emailVerificationPending}</strong>.
            </div>
          )}
        </div>

        {/* Mobile Number */}
        <div>
          <label
            htmlFor="profile-mobile"
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Mobile Number <span className="font-normal text-[#64748B]">(Optional)</span>
          </label>
          <input
            id="profile-mobile"
            type="tel"
            value={draft.mobile_number}
            disabled={isSaving}
            aria-invalid={Boolean(errors.mobile_number)}
            onChange={(e) => onChange({ ...draft, mobile_number: e.target.value })}
            placeholder="+91 98765 43210"
            className={`mt-1.5 min-h-[42px] w-full rounded-lg border px-3.5 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
              errors.mobile_number
                ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
            }`}
          />
          {errors.mobile_number ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.mobile_number}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-[#64748B]">
              Used for urgent overdue or pickup desk notices when SMS is enabled.
            </p>
          )}
        </div>

        {/* Read-only Student ID */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="profile-student-code"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Student ID / Roll Number
            </label>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>{policy.allow_student_code_edit ? 'Editable' : 'Read-only'}</span>
            </span>
          </div>
          <input
            id="profile-student-code"
            type="text"
            value={studentCode}
            readOnly
            disabled
            className="font-mono-tabular mt-1.5 min-h-[42px] w-full cursor-not-allowed rounded-lg border border-slate-200 bg-[#F5F8FC] px-3.5 py-2 text-sm font-medium text-[#64748B]"
          />
          <p className="mt-1.5 text-[11px] text-[#64748B]">
            Assigned by your institution registrar; contact the library admin desk for ID
            corrections.
          </p>
        </div>

        {/* Profile Photo URL */}
        {policy.allow_profile_photo_edit && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="profile-avatar-url"
                className="block text-xs font-semibold text-[#142B4A]"
              >
                Profile Photo URL <span className="font-normal text-[#64748B]">(Optional)</span>
              </label>
              {draft.avatar_url.trim() && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onChange({ ...draft, avatar_url: '' })}
                  className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Use Initials Fallback
                </button>
              )}
            </div>
            <input
              id="profile-avatar-url"
              type="url"
              value={draft.avatar_url}
              disabled={isSaving}
              aria-invalid={Boolean(errors.avatar_url)}
              onChange={(e) => onChange({ ...draft, avatar_url: e.target.value })}
              placeholder="https://... or leave blank for initials"
              className={`mt-1.5 min-h-[42px] w-full rounded-lg border px-3.5 py-2 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
                errors.avatar_url
                  ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
              }`}
            />
            {errors.avatar_url && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {errors.avatar_url}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-[#64748B]">
          {isDirty ? 'You have unsaved personal information changes.' : 'All personal details synced.'}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={onCancel}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </form>
  );
}

interface AcademicInfoSectionProps {
  draft: AcademicInfoRecord;
  policy: ProfilePolicyFlags;
  errors: AcademicInfoFieldErrors;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (next: AcademicInfoRecord) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function AcademicInfoSection({
  draft,
  policy,
  errors,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: AcademicInfoSectionProps) {
  const canEditAcademic = policy.allow_academic_edit;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canEditAcademic) onSave();
      }}
      noValidate
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start">
        <div>
          <h3 className="font-display text-lg font-bold text-[#142B4A]">
            Academic Information
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Your department and semester help calibrate subject-level textbook recommendations and
            cohort trends.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2.5 py-1 text-[11px] font-semibold text-[#142B4A]">
          <GraduationCap className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
          <span>{canEditAcademic ? 'Department & Year Editable' : 'Registrar Managed'}</span>
        </span>
      </div>

      {/* Institutional Controlled Identifiers */}
      <div className="mt-5 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>Student ID / Roll Number (Read-only)</span>
          </p>
          <p className="font-mono-tabular mt-1 text-sm font-bold text-[#142B4A]">
            {draft.student_code}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>Institution (Administrator Controlled)</span>
          </p>
          <p className="mt-1 text-sm font-bold text-[#142B4A]">{draft.institution_name}</p>
        </div>
      </div>

      {/* Editable Academic Details (if policy allows) */}
      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="academic-course-dept"
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Course / Department <span className="text-red-600">*</span>
          </label>
          <select
            id="academic-course-dept"
            value={draft.course_department}
            disabled={!canEditAcademic || isSaving}
            aria-invalid={Boolean(errors.course_department)}
            onChange={(e) => onChange({ ...draft, course_department: e.target.value })}
            className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#64748B]"
          >
            <option value="">Select department</option>
            {PROFILE_COURSE_DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {errors.course_department && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.course_department}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="academic-year-select"
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Academic Year <span className="text-red-600">*</span>
          </label>
          <select
            id="academic-year-select"
            value={draft.academic_year}
            disabled={!canEditAcademic || isSaving}
            aria-invalid={Boolean(errors.academic_year)}
            onChange={(e) => onChange({ ...draft, academic_year: e.target.value })}
            className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#64748B]"
          >
            <option value="">Select academic year</option>
            {PROFILE_ACADEMIC_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {errors.academic_year && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.academic_year}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="academic-semester-select"
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Semester <span className="text-red-600">*</span>
          </label>
          <select
            id="academic-semester-select"
            value={draft.semester}
            disabled={!canEditAcademic || isSaving}
            aria-invalid={Boolean(errors.semester)}
            onChange={(e) => onChange({ ...draft, semester: e.target.value })}
            className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#64748B]"
          >
            <option value="">Select semester</option>
            {SEMESTER_OPTIONS.map((sem) => (
              <option key={sem} value={sem}>
                {sem}
              </option>
            ))}
          </select>
          {errors.semester && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
              {errors.semester}
            </p>
          )}
        </div>
      </div>

      {canEditAcademic && (
        <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#64748B]">
            {isDirty
              ? 'Academic details have unsaved changes.'
              : 'Department and semester are up to date.'}
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={onCancel}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>Save Academic Details</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

interface ReadingInterestsSectionProps {
  selectedInterests: string[];
  availableInterests: string[];
  isDirty: boolean;
  isSaving: boolean;
  onChange: (nextSelected: string[], nextAvailable: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ReadingInterestsSection({
  selectedInterests,
  availableInterests,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: ReadingInterestsSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  const filteredTopics = useMemo(
    () => filterTopicOptions(availableInterests, searchQuery),
    [availableInterests, searchQuery]
  );

  const handleToggleTopic = (topic: string) => {
    const next = toggleSelectionItem(selectedInterests, topic);
    onChange(next, availableInterests);
  };

  const handleAddCustom = () => {
    const result = addCustomInterestItem(selectedInterests, availableInterests, customTopic);
    if (result.error) {
      setCustomError(result.error);
      return;
    }
    setCustomError(null);
    setCustomTopic('');
    onChange(result.nextSelected, result.nextAvailable);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-lg font-bold text-[#142B4A]">
            Your Reading Interests
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Choose topics you enjoy reading. These directly power your AI book recommendations.
          </p>
        </div>
        <span className="font-mono-tabular shrink-0 self-start rounded-md bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#142B4A] sm:self-auto">
          {selectedInterests.length} selected
        </span>
      </div>

      {/* Selected Chips or Empty State */}
      <div className="mt-5">
        {selectedInterests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-[#F5F8FC] p-6 text-center">
            <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#142B4A]">
              <Tag className="h-5 w-5" aria-hidden="true" />
            </span>
            <h4 className="font-display mt-3 text-base font-bold text-[#142B4A]">
              Personalize your reading experience
            </h4>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#64748B]">
              Select topics you enjoy so we can suggest books that better match your interests.
            </p>
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="mt-4 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Interests</span>
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-[#142B4A]">Selected Interests</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedInterests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB]/30 bg-[#DBEAFE]/70 px-3 py-1.5 text-xs font-semibold text-[#142B4A]"
                >
                  <span>{interest}</span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleToggleTopic(interest)}
                    aria-label={`Remove interest ${interest}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded text-[#142B4A] hover:bg-[#2563EB] hover:text-white cursor-pointer"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Topic Search + Curated Multi-select */}
      <div className="mt-6 space-y-3 border-t border-slate-100 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-[#142B4A]">Browse &amp; Toggle Topics</p>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#64748B]"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter topics..."
              aria-label="Filter reading interests"
              className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] py-1.5 pr-3 pl-8 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div
          role="group"
          aria-label="Available reading interest topics"
          className="flex flex-wrap gap-2"
        >
          {filteredTopics.length === 0 ? (
            <p className="py-2 text-xs text-[#64748B]">
              No topics match &ldquo;{searchQuery}&rdquo;. Add it below as a custom interest.
            </p>
          ) : (
            filteredTopics.map((topic) => {
              const isSelected = selectedInterests.some(
                (item) => item.toLowerCase() === topic.toLowerCase()
              );
              return (
                <button
                  key={topic}
                  type="button"
                  disabled={isSaving}
                  aria-pressed={isSelected}
                  onClick={() => handleToggleTopic(topic)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#142B4A] bg-[#142B4A] text-white'
                      : 'border-slate-200 bg-white text-[#1E293B] hover:border-[#2563EB] hover:text-[#2563EB]'
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-[#DBEAFE]" aria-hidden="true" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                  )}
                  <span>{topic}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Add Custom Topic */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
        <label
          htmlFor="custom-reading-interest-input"
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Add Custom Interest
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="custom-reading-interest-input"
            type="text"
            value={customTopic}
            disabled={isSaving}
            onChange={(e) => {
              setCustomTopic(e.target.value);
              if (customError) setCustomError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              }
            }}
            placeholder="e.g. Quantum Computing, Bioinformatics..."
            className="min-h-[40px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          />
          <button
            type="button"
            disabled={isSaving}
            onClick={handleAddCustom}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[#142B4A] bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-[#142B4A] hover:text-white whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Topic</span>
          </button>
        </div>
        {customError && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
            {customError}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-[#64748B]">
          {isDirty ? 'You have unsaved reading interest changes.' : 'Reading interests saved.'}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={onCancel}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Save Interests</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface PreferredSubjectsSectionProps {
  selectedSubjects: string[];
  availableSubjects: string[];
  isDirty: boolean;
  isSaving: boolean;
  onChange: (nextSelected: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function PreferredSubjectsSection({
  selectedSubjects,
  availableSubjects,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: PreferredSubjectsSectionProps) {
  const handleToggleSubject = (subject: string) => {
    onChange(toggleSelectionItem(selectedSubjects, subject));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-lg font-bold text-[#142B4A]">
            Preferred Subjects
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Select institutional academic subjects separately from casual reading interests to align
            textbook and reference recommendations with your coursework.
          </p>
        </div>
        <span className="font-mono-tabular shrink-0 self-start rounded-md bg-[#DBEAFE] px-2.5 py-1 text-xs font-semibold text-[#142B4A] sm:self-auto">
          {selectedSubjects.length} subjects
        </span>
      </div>

      {/* Selected Subjects Strip */}
      {selectedSubjects.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-[#142B4A]">Active Coursework Subjects</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedSubjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB]/30 bg-[#EFF6FF] px-3 py-1.5 text-xs font-semibold text-[#142B4A]"
              >
                <BookOpen className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>{subject}</span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleToggleSubject(subject)}
                  aria-label={`Remove preferred subject ${subject}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded text-[#142B4A] hover:bg-[#2563EB] hover:text-white cursor-pointer"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Multi-Select Subject Grid */}
      <div className="mt-5">
        <p className="text-xs font-semibold text-[#142B4A]">Library Subject Catalogue</p>
        <div
          role="group"
          aria-label="Institutional academic subjects"
          className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          {availableSubjects.map((subject) => {
            const checked = selectedSubjects.some(
              (item) => item.toLowerCase() === subject.toLowerCase()
            );
            return (
              <label
                key={subject}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-xs font-medium transition-colors cursor-pointer ${
                  checked
                    ? 'border-[#2563EB] bg-[#EFF6FF]/60 text-[#142B4A]'
                    : 'border-slate-200 bg-white text-[#1E293B] hover:bg-[#F5F8FC]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isSaving}
                  onChange={() => handleToggleSubject(subject)}
                  className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                />
                <span className="min-w-0 flex-1">{subject}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-[#64748B]">
          {isDirty ? 'You have unsaved subject changes.' : 'Preferred subjects synced.'}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={!isDirty || isSaving}
            onClick={onCancel}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Save Preferred Subjects</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface RecommendationPreferencesSectionProps {
  draft: RecommendationPreferences;
  availableTopics: string[];
  isDirty: boolean;
  isSaving: boolean;
  onChange: (next: RecommendationPreferences) => void;
  onSave: () => void;
  onCancel: () => void;
  onNavigate: (route: AppRoute) => void;
}

const DISCOVERY_OPTIONS: Array<{
  value: DiscoveryPreference;
  label: string;
  description: string;
}> = [
  {
    value: 'mostly_familiar',
    label: 'Mostly familiar topics',
    description: 'Stay closely aligned with your existing subjects and past reads.',
  },
  {
    value: 'balanced',
    label: 'A balance of familiar and new topics',
    description: 'Mix core curriculum picks with adjacent interdisciplinary discoveries.',
  },
  {
    value: 'explore_new',
    label: 'Explore new subjects',
    description: 'Surface broader genres and emerging subjects beyond past borrowings.',
  },
];

const READING_LEVEL_OPTIONS: ReadingLevelPreference[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'No preference',
];

export function RecommendationPreferencesSection({
  draft,
  availableTopics,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
  onNavigate,
}: RecommendationPreferencesSectionProps) {
  const priorityTopicPool = useMemo(() => availableTopics.slice(0, 12), [availableTopics]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-display text-lg font-bold text-[#142B4A]">
            Personalize Your Recommendations
          </h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Fine-tune how our hybrid TF-IDF and collaborative filtering engine ranks titles on your
            Recommended for You page.
          </p>
        </div>

        <div className="mt-5 space-y-6">
          {/* Priority Recommendation Topics */}
          <div>
            <p className="text-xs font-semibold text-[#142B4A]">
              Priority Recommendation Topics
            </p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Highlight top focus topics for extra weighting in recommendation rankings.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {priorityTopicPool.map((topic) => {
                const active = draft.preferred_topics.some(
                  (item) => item.toLowerCase() === topic.toLowerCase()
                );
                return (
                  <button
                    key={topic}
                    type="button"
                    disabled={isSaving}
                    aria-pressed={active}
                    onClick={() =>
                      onChange({
                        ...draft,
                        preferred_topics: toggleSelectionItem(draft.preferred_topics, topic),
                      })
                    }
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#2563EB] bg-[#DBEAFE] font-semibold text-[#142B4A]'
                        : 'border-slate-200 bg-white text-[#1E293B] hover:border-[#2563EB]'
                    }`}
                  >
                    {active && <Check className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />}
                    <span>{topic}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Discovery Preference */}
          <fieldset>
            <legend className="text-xs font-semibold text-[#142B4A]">Discovery Preference</legend>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {DISCOVERY_OPTIONS.map((opt) => {
                const selected = draft.discovery_preference === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex flex-col rounded-xl border p-3.5 text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#2563EB] bg-[#EFF6FF]/60'
                        : 'border-slate-200 bg-white hover:bg-[#F5F8FC]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="discovery_preference"
                        value={opt.value}
                        checked={selected}
                        disabled={isSaving}
                        onChange={() =>
                          onChange({ ...draft, discovery_preference: opt.value })
                        }
                        className="h-4 w-4 border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span className="font-semibold text-[#142B4A]">{opt.label}</span>
                    </div>
                    <span className="mt-1.5 pl-6 text-[11px] leading-relaxed text-[#64748B]">
                      {opt.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Reading Level & Availability Preference */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="rec-reading-level"
                className="block text-xs font-semibold text-[#142B4A]"
              >
                Preferred Reading Level
              </label>
              <select
                id="rec-reading-level"
                value={draft.reading_level}
                disabled={isSaving}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    reading_level: e.target.value as ReadingLevelPreference,
                  })
                }
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
              >
                {READING_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="rec-availability-pref"
                className="block text-xs font-semibold text-[#142B4A]"
              >
                Availability Preference
              </label>
              <select
                id="rec-availability-pref"
                value={draft.availability_preference}
                disabled={isSaving}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    availability_preference: e.target.value as AvailabilityPreference,
                  })
                }
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
              >
                <option value="available_first">Prioritize available books first</option>
                <option value="include_unavailable">
                  Include checked-out books (for reservations)
                </option>
              </select>
            </div>
          </div>

          {/* Content Formats & Languages */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-[#142B4A]">Supported Formats</p>
              <div className="mt-2 space-y-2">
                {SUPPORTED_CONTENT_FORMATS.map((fmt) => {
                  const checked = draft.content_formats.includes(fmt);
                  return (
                    <label
                      key={fmt}
                      className="flex items-center gap-2.5 text-xs text-[#1E293B] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSaving}
                        onChange={() =>
                          onChange({
                            ...draft,
                            content_formats: toggleSelectionItem(draft.content_formats, fmt),
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span>{fmt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#142B4A]">Preferred Languages</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SUPPORTED_CONTENT_LANGUAGES.map((lang) => {
                  const checked = draft.content_languages.includes(lang);
                  return (
                    <label
                      key={lang}
                      className="flex items-center gap-2.5 text-xs text-[#1E293B] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSaving}
                        onChange={() =>
                          onChange({
                            ...draft,
                            content_languages: toggleSelectionItem(draft.content_languages, lang),
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                      />
                      <span>{lang}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Previously Read Filter */}
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC] p-4 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={draft.avoid_previously_read}
              disabled={isSaving}
              onChange={(e) =>
                onChange({ ...draft, avoid_previously_read: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
            />
            <div>
              <span className="font-semibold text-[#142B4A]">
                Avoid recommending books I have already read
              </span>
              <p className="mt-0.5 text-[11px] text-[#64748B]">
                Books already in your reading history or active borrowings are filtered out of top
                recommendations unless you browse your Read Again section.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#64748B]">
            {isDirty
              ? 'Recommendation preferences have unsaved changes.'
              : 'Recommendation ranking settings synced.'}
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!isDirty || isSaving}
              onClick={onCancel}
              className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={onSave}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>Save Recommendation Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transparency & Recommendation Explanation Card */}
      <section className="rounded-xl border border-[#DBEAFE] bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#142B4A]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h4 className="font-display text-base font-bold text-[#142B4A]">
                How your preferences improve recommendations
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                Your recommendations combine your explicit choices with real library activity—never
                black-box guesswork:
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-2 text-xs text-[#1E293B] sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <span>Selected reading interests and academic subjects</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <span>Book metadata, descriptions, and syllabus tags</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <span>Your ratings, reviews, and &ldquo;Not Interested&rdquo; feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                  <span>Anonymized reading patterns of similar students &amp; live copy availability</span>
                </li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'student-recommendations' })}
            className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3d66] whitespace-nowrap cursor-pointer"
          >
            <span>View My Recommendations</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}

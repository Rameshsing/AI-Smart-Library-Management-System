import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  BookOpen,
  GraduationCap,
  Heart,
  Info,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import { auth } from '../../lib/firebase';
import { syncUserProfileToFirestore } from '../../lib/firestoreLibrary';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import type { StudentProfile } from '../../utils/studentDashboard';
import type { NotificationPreferencesPayload } from '../../utils/notificationsPage';
import {
  buildAcademicUpdatePayload,
  buildPersonalInfoUpdatePayload,
  createEmptyPasswordDraft,
  createSampleStudentProfilePayload,
  getStudentInitials,
  isAcademicInfoDirty,
  isNotificationPreferencesDirty,
  isPasswordDraftDirty,
  isPersonalInfoDirty,
  isRecommendationPreferencesDirty,
  isStringListDirty,
  PROFILE_SECTIONS,
  validateAcademicInfo,
  validateChangePassword,
  validatePersonalInfo,
  type AcademicInfoFieldErrors,
  type AcademicInfoRecord,
  type ChangePasswordDraft,
  type ChangePasswordFieldErrors,
  type PersonalInfoDraft,
  type PersonalInfoFieldErrors,
  type ProfileSectionId,
  type RecommendationPreferences,
  type StudentProfileFullPayload,
} from '../../utils/studentProfilePage';
import {
  AcademicInfoSection,
  PersonalInfoSection,
  PreferredSubjectsSection,
  ReadingInterestsSection,
  RecommendationPreferencesSection,
} from './ProfilePreferenceSections';
import {
  AccountSecuritySection,
  NotificationPreferencesSection,
  UnsavedChangesConfirmModal,
} from './ProfileSecuritySection';

interface MyProfilePageProps {
  student: StudentProfile;
  onNavigate: (route: AppRoute) => void;
}

const SECTION_ICONS: Record<ProfileSectionId, React.ReactNode> = {
  personal: <User className="h-4 w-4 shrink-0" aria-hidden="true" />,
  academic: <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />,
  interests: <Heart className="h-4 w-4 shrink-0" aria-hidden="true" />,
  subjects: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />,
  recommendations: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />,
  notifications: <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />,
  security: <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />,
};

export function MyProfilePage({ student, onNavigate }: MyProfilePageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [savedProfile, setSavedProfile] = useState<StudentProfileFullPayload | null>(null);
  const [activeSection, setActiveSection] = useState<ProfileSectionId>('personal');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [avatarError, setAvatarError] = useState<boolean>(false);

  // Editable Section Drafts
  const [personalDraft, setPersonalDraft] = useState<PersonalInfoDraft>({
    full_name: student.name,
    email: student.email,
    mobile_number: '',
    avatar_url: student.avatar_url,
  });
  const [personalErrors, setPersonalErrors] = useState<PersonalInfoFieldErrors>({});

  const [academicDraft, setAcademicDraft] = useState<AcademicInfoRecord>({
    student_code: student.student_code,
    institution_name: '',
    course_department: student.course_department,
    academic_year: student.academic_year,
    semester: '',
  });
  const [academicErrors, setAcademicErrors] = useState<AcademicInfoFieldErrors>({});

  const [interestsDraft, setInterestsDraft] = useState<string[]>([]);
  const [availableInterests, setAvailableInterests] = useState<string[]>([]);

  const [subjectsDraft, setSubjectsDraft] = useState<string[]>([]);
  const [recommendationDraft, setRecommendationDraft] = useState<RecommendationPreferences | null>(
    null
  );
  const [notificationDraft, setNotificationDraft] =
    useState<NotificationPreferencesPayload | null>(null);

  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordDraft>(
    createEmptyPasswordDraft()
  );
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordFieldErrors>({});

  // Action & Feedback States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [actionAlertMessage, setActionAlertMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Unsaved Changes Switch Guard
  const [pendingSwitchTarget, setPendingSwitchTarget] = useState<
    | { kind: 'section'; sectionId: ProfileSectionId }
    | { kind: 'route'; route: AppRoute }
    | null
  >(null);

  const onNavigateRef = React.useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const apiBaseUrl = getApiBaseUrl();
  const backendConnected = isBackendConnected();

  const syncProfileChangesToCloud = useCallback(
    (overrides?: {
      displayName?: string;
      email?: string;
      department?: string;
      academicYear?: string;
      interests?: string[];
      preferredSubjects?: string[];
      studentCode?: string;
    }) => {
      const fbUser = auth.currentUser;
      if (!fbUser || !fbUser.emailVerified) return;
      void syncUserProfileToFirestore({
        uid: fbUser.uid,
        displayName:
          overrides?.displayName ?? savedProfile?.personal.full_name ?? personalDraft.full_name,
        email: overrides?.email ?? savedProfile?.personal.email ?? personalDraft.email,
        department:
          overrides?.department ??
          savedProfile?.academic.course_department ??
          academicDraft.course_department,
        academicYear:
          overrides?.academicYear ??
          savedProfile?.academic.academic_year ??
          academicDraft.academic_year,
        interests: overrides?.interests ?? savedProfile?.reading_interests ?? interestsDraft,
        preferredSubjects:
          overrides?.preferredSubjects ?? savedProfile?.preferred_subjects ?? subjectsDraft,
        studentCode:
          overrides?.studentCode ??
          savedProfile?.academic.student_code ??
          academicDraft.student_code,
      }).catch(() => {});
    },
    [
      academicDraft.academic_year,
      academicDraft.course_department,
      academicDraft.student_code,
      interestsDraft,
      personalDraft.email,
      personalDraft.full_name,
      savedProfile,
      subjectsDraft,
    ]
  );

  const hydrateDraftsFromSaved = useCallback((payload: StudentProfileFullPayload) => {
    setPersonalDraft({ ...payload.personal });
    setPersonalErrors({});
    setAcademicDraft({ ...payload.academic });
    setAcademicErrors({});
    setInterestsDraft([...payload.reading_interests]);
    setAvailableInterests([...payload.available_reading_interests]);
    setSubjectsDraft([...payload.preferred_subjects]);
    setRecommendationDraft({
      ...payload.recommendation_preferences,
      preferred_topics: [...payload.recommendation_preferences.preferred_topics],
      content_formats: [...payload.recommendation_preferences.content_formats],
      content_languages: [...payload.recommendation_preferences.content_languages],
    });
    setNotificationDraft({
      ...payload.notification_preferences,
      categories: payload.notification_preferences.categories.map((cat) => ({ ...cat })),
      reminder_timings: [...payload.notification_preferences.reminder_timings],
    });
    setPasswordDraft(createEmptyPasswordDraft());
    setPasswordErrors({});
    setAvatarError(false);
  }, []);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    if (backendConnected) {
      try {
        const response = await apiFetch(`${apiBaseUrl}/api/student/profile`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (response.status === 401 || response.status === 403) {
          onNavigateRef.current({ name: 'login' });
          return;
        }

        if (!response.ok) {
          throw new Error(`Unable to load profile (${response.status}).`);
        }

        const remotePayload = (await response.json()) as StudentProfileFullPayload;
        const normalized: StudentProfileFullPayload = {
          ...remotePayload,
          is_prototype_sample: false,
        };
        setSavedProfile(normalized);
        hydrateDraftsFromSaved(normalized);
        setIsLoading(false);
        return;
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load your profile. Please try again.'
        );
        setIsLoading(false);
        return;
      }
    }

    // Prototype / development mode when VITE_API_BASE_URL is unset
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const sample = createSampleStudentProfilePayload(student, referenceDate);
    setSavedProfile(sample);
    hydrateDraftsFromSaved(sample);
    setIsLoading(false);
  }, [apiBaseUrl, backendConnected, hydrateDraftsFromSaved, referenceDate, student]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, reloadNonce]);

  const dirtyMap = useMemo<Record<ProfileSectionId, boolean>>(() => {
    if (!savedProfile || !recommendationDraft || !notificationDraft) {
      return {
        personal: false,
        academic: false,
        interests: false,
        subjects: false,
        recommendations: false,
        notifications: false,
        security: false,
      };
    }

    return {
      personal: isPersonalInfoDirty(personalDraft, savedProfile.personal),
      academic:
        savedProfile.policy.allow_academic_edit &&
        isAcademicInfoDirty(academicDraft, savedProfile.academic),
      interests: isStringListDirty(interestsDraft, savedProfile.reading_interests),
      subjects: isStringListDirty(subjectsDraft, savedProfile.preferred_subjects),
      recommendations: isRecommendationPreferencesDirty(
        recommendationDraft,
        savedProfile.recommendation_preferences
      ),
      notifications: isNotificationPreferencesDirty(
        notificationDraft,
        savedProfile.notification_preferences
      ),
      security: isPasswordDraftDirty(passwordDraft),
    };
  }, [
    savedProfile,
    personalDraft,
    academicDraft,
    interestsDraft,
    subjectsDraft,
    recommendationDraft,
    notificationDraft,
    passwordDraft,
  ]);

  const hasAnyUnsavedChanges = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap]
  );

  // Warn before browser refresh / close if unsaved edits exist
  useEffect(() => {
    if (!hasAnyUnsavedChanges) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasAnyUnsavedChanges]);

  const resetSectionDraft = (sectionId: ProfileSectionId) => {
    if (!savedProfile) return;
    setActionAlertMessage(null);
    if (sectionId === 'personal') {
      setPersonalDraft({ ...savedProfile.personal });
      setPersonalErrors({});
      setAvatarError(false);
    } else if (sectionId === 'academic') {
      setAcademicDraft({ ...savedProfile.academic });
      setAcademicErrors({});
    } else if (sectionId === 'interests') {
      setInterestsDraft([...savedProfile.reading_interests]);
      setAvailableInterests([...savedProfile.available_reading_interests]);
    } else if (sectionId === 'subjects') {
      setSubjectsDraft([...savedProfile.preferred_subjects]);
    } else if (sectionId === 'recommendations') {
      setRecommendationDraft({
        ...savedProfile.recommendation_preferences,
        preferred_topics: [...savedProfile.recommendation_preferences.preferred_topics],
        content_formats: [...savedProfile.recommendation_preferences.content_formats],
        content_languages: [...savedProfile.recommendation_preferences.content_languages],
      });
    } else if (sectionId === 'notifications') {
      setNotificationDraft({
        ...savedProfile.notification_preferences,
        categories: savedProfile.notification_preferences.categories.map((c) => ({ ...c })),
        reminder_timings: [...savedProfile.notification_preferences.reminder_timings],
      });
    } else if (sectionId === 'security') {
      setPasswordDraft(createEmptyPasswordDraft());
      setPasswordErrors({});
    }
  };

  const handleRequestSectionSwitch = (targetSection: ProfileSectionId) => {
    if (targetSection === activeSection) return;
    setActionAlertMessage(null);
    setToastMessage(null);

    if (dirtyMap[activeSection]) {
      setPendingSwitchTarget({ kind: 'section', sectionId: targetSection });
      return;
    }
    setActiveSection(targetSection);
  };

  const handleGuardedNavigate = (route: AppRoute) => {
    if (hasAnyUnsavedChanges) {
      setPendingSwitchTarget({ kind: 'route', route });
      return;
    }
    onNavigate(route);
  };

  const handleConfirmDiscardSwitch = () => {
    if (!pendingSwitchTarget) return;
    resetSectionDraft(activeSection);
    if (pendingSwitchTarget.kind === 'section') {
      setActiveSection(pendingSwitchTarget.sectionId);
    } else {
      onNavigate(pendingSwitchTarget.route);
    }
    setPendingSwitchTarget(null);
  };

  const handleSavePersonal = async () => {
    if (!savedProfile) return;
    setActionAlertMessage(null);
    setToastMessage(null);

    const validation = validatePersonalInfo(personalDraft, savedProfile.personal.email);
    setPersonalErrors(validation.errors);
    if (!validation.isValid) return;

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to save profile changes (PUT /api/student/profile).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildPersonalInfoUpdatePayload(personalDraft)),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      const json = (await response.json().catch(() => ({}))) as {
        message?: string;
        profile?: StudentProfileFullPayload;
      };

      if (!response.ok) {
        throw new Error(
          json.message ?? `Unable to update personal information (${response.status}).`
        );
      }

      if (json.profile) {
        const nextSaved = { ...json.profile, is_prototype_sample: false };
        setSavedProfile(nextSaved);
        hydrateDraftsFromSaved(nextSaved);
        syncProfileChangesToCloud({
          displayName: nextSaved.personal.full_name,
          email: nextSaved.personal.email,
          department: nextSaved.academic.course_department,
          academicYear: nextSaved.academic.academic_year,
          interests: nextSaved.reading_interests,
          preferredSubjects: nextSaved.preferred_subjects,
          studentCode: nextSaved.academic.student_code,
        });
      } else {
        setReloadNonce((prev) => prev + 1);
        syncProfileChangesToCloud({
          displayName: personalDraft.full_name,
          email: personalDraft.email,
        });
      }

      setToastMessage(
        validation.emailChanged
          ? 'Personal information saved. A verification email has been sent to confirm your new address.'
          : 'Personal information updated.'
      );
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to save personal information right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAcademic = async () => {
    if (!savedProfile || !savedProfile.policy.allow_academic_edit) return;
    setActionAlertMessage(null);
    setToastMessage(null);

    const validation = validateAcademicInfo(academicDraft);
    setAcademicErrors(validation.errors);
    if (!validation.isValid) return;

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to update academic details (PUT /api/student/profile).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAcademicUpdatePayload(academicDraft)),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to update academic details (${response.status}).`);
      }

      syncProfileChangesToCloud({
        department: academicDraft.course_department,
        academicYear: academicDraft.academic_year,
        studentCode: academicDraft.student_code,
      });
      setToastMessage('Academic details updated.');
      setReloadNonce((prev) => prev + 1);
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to update academic details right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInterests = async () => {
    setActionAlertMessage(null);
    setToastMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to save reading interests (PUT /api/student/interests).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/interests`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interests: interestsDraft }),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to save reading interests (${response.status}).`);
      }

      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              reading_interests: [...interestsDraft],
              available_reading_interests: [...availableInterests],
            }
          : prev
      );
      syncProfileChangesToCloud({ interests: [...interestsDraft] });
      setToastMessage('Reading interests updated.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to save reading interests right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSubjects = async () => {
    setActionAlertMessage(null);
    setToastMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to save preferred subjects (PUT /api/student/subjects).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/subjects`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferred_subjects: subjectsDraft }),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to save preferred subjects (${response.status}).`);
      }

      setSavedProfile((prev) =>
        prev ? { ...prev, preferred_subjects: [...subjectsDraft] } : prev
      );
      syncProfileChangesToCloud({ preferredSubjects: [...subjectsDraft] });
      setToastMessage('Preferred subjects updated.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to save preferred subjects right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRecommendationPrefs = async () => {
    if (!recommendationDraft) return;
    setActionAlertMessage(null);
    setToastMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to save recommendation preferences (PUT /api/student/recommendation-preferences).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/recommendation-preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(recommendationDraft),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to save recommendation preferences (${response.status}).`);
      }

      setSavedProfile((prev) =>
        prev ? { ...prev, recommendation_preferences: recommendationDraft } : prev
      );
      setToastMessage('Recommendation preferences saved.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error
          ? err.message
          : 'Unable to save recommendation preferences right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotificationPrefs = async () => {
    if (!notificationDraft) return;
    setActionAlertMessage(null);
    setToastMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to save notification preferences (PUT /api/student/notification-preferences).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/notification-preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories: notificationDraft.categories,
          reminder_timings: notificationDraft.reminder_timings,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to save notification preferences (${response.status}).`);
      }

      const savedPrefs = (await response.json()) as NotificationPreferencesPayload;
      setSavedProfile((prev) =>
        prev ? { ...prev, notification_preferences: savedPrefs } : prev
      );
      setNotificationDraft(savedPrefs);
      setToastMessage('Notification preferences saved.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error
          ? err.message
          : 'Unable to save notification preferences right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitPasswordChange = async () => {
    setActionAlertMessage(null);
    setToastMessage(null);

    const validation = validateChangePassword(passwordDraft);
    setPasswordErrors(validation.errors);
    if (!validation.isValid) return;

    if (!backendConnected) {
      setActionAlertMessage(
        'Live backend server required to verify your current password and hash your new password (POST /api/student/change-password).'
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwordDraft.current_password,
          new_password: passwordDraft.new_password,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      const json = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message ?? `Unable to update password (${response.status}).`);
      }

      setPasswordDraft(createEmptyPasswordDraft());
      setPasswordErrors({});
      setToastMessage('Your password has been updated.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to change password right now.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setActionAlertMessage(null);
    setToastMessage(null);

    if (!backendConnected) {
      setActionAlertMessage(
        `Live backend server required to revoke sessions (DELETE /api/student/sessions/${sessionId}).`
      );
      return;
    }

    setRevokingSessionId(sessionId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/api/student/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (response.status === 401 || response.status === 403) {
        onNavigateRef.current({ name: 'login' });
        return;
      }

      if (!response.ok) {
        throw new Error(`Unable to revoke session (${response.status}).`);
      }

      setSavedProfile((prev) =>
        prev
          ? {
              ...prev,
              active_sessions: prev.active_sessions.filter(
                (item) => item.session_id !== sessionId
              ),
            }
          : prev
      );
      setToastMessage('Session revoked.');
    } catch (err) {
      setActionAlertMessage(
        err instanceof Error ? err.message : 'Unable to revoke session right now.'
      );
    } finally {
      setRevokingSessionId(null);
    }
  };

  const summaryName = savedProfile?.personal.full_name ?? student.name;
  const summaryStudentCode = savedProfile?.academic.student_code ?? student.student_code;
  const summaryEmail = savedProfile?.personal.email ?? student.email;
  const summaryDept = savedProfile?.academic.course_department ?? student.course_department;
  const summaryAvatar = personalDraft.avatar_url.trim();
  const initials = getStudentInitials(summaryName);

  const pendingTargetLabel =
    pendingSwitchTarget?.kind === 'section'
      ? (PROFILE_SECTIONS.find((s) => s.id === pendingSwitchTarget.sectionId)?.label ??
        'the selected section')
      : 'Recommended for You';

  return (
    <div className="space-y-6">

      {/* Prototype Sample Notice */}
      {savedProfile?.is_prototype_sample && !isLoading && !errorMessage && (
        <div
          role="note"
          className="flex flex-col justify-between gap-2 rounded-xl border border-[#DBEAFE] bg-white px-4 py-3 text-xs text-[#1E293B] shadow-xs sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-[#142B4A]">
                Sample Profile Preview:
              </strong>{' '}
              Showing development account and preference data for {summaryName} (
              {summaryStudentCode}) structured for the student profile &amp; preferences API.
            </span>
          </div>
          <span className="font-mono-tabular shrink-0 text-[11px] font-medium text-[#64748B]">
            GET /api/student/profile
          </span>
        </div>
      )}

      {/* Backend-Required / Validation Error Alert */}
      {actionAlertMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span className="font-medium leading-relaxed">{actionAlertMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlertMessage(null)}
            aria-label="Dismiss error alert"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-700 hover:bg-red-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Confirmation Toast Banner */}
      {toastMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#142B4A]"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss confirmation banner"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] hover:bg-white hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Main Content */}
      {isLoading ? (
        <section aria-label="Loading profile" className="space-y-6">
          <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-4" />
            <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-8" />
          </div>
        </section>
      ) : errorMessage || !savedProfile || !recommendationDraft || !notificationDraft ? (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs"
        >
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="font-display mt-4 text-lg font-bold text-[#142B4A]">
            Unable to load your profile
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">Please try again.</p>
          {errorMessage && <p className="mt-1 text-xs text-red-700">{errorMessage}</p>}
          <button
            type="button"
            onClick={() => setReloadNonce((prev) => prev + 1)}
            className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          {/* Profile Summary Card */}
          <section
            aria-label="Profile summary"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
          >
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4 min-w-0">
                {!avatarError && summaryAvatar ? (
                  <img
                    src={summaryAvatar}
                    alt={summaryName}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover"
                  />
                ) : (
                  <span
                    aria-label={`${summaryName} initials`}
                    className="font-display flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#142B4A] text-xl font-bold text-white"
                  >
                    {initials}
                  </span>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display truncate text-xl font-bold text-[#142B4A]">
                      {summaryName}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        savedProfile.account_status === 'Active'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : savedProfile.account_status === 'Pending'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                      }`}
                    >
                      <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                      <span>{savedProfile.account_status}</span>
                    </span>
                    {hasAnyUnsavedChanges && (
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        Unsaved changes pending
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                    <span className="font-mono-tabular font-semibold text-[#142B4A]">
                      {summaryStudentCode}
                    </span>
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                      <span className="truncate">{summaryEmail}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                      <span>{summaryDept}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                <div>
                  <p className="text-[11px] font-medium text-[#64748B]">Interests</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#142B4A]">
                    {interestsDraft.length}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-[#64748B]">Subjects</p>
                  <p className="font-mono-tabular mt-0.5 text-lg font-bold text-[#2563EB]">
                    {subjectsDraft.length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Settings Navigation + Active Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Mobile Section Selector */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:hidden">
              <label
                htmlFor="mobile-profile-section-select"
                className="block text-xs font-semibold text-[#142B4A]"
              >
                Profile Section
              </label>
              <select
                id="mobile-profile-section-select"
                value={activeSection}
                onChange={(e) =>
                  handleRequestSectionSwitch(e.target.value as ProfileSectionId)
                }
                className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-[#F5F8FC] px-3 py-2 text-sm font-medium text-[#142B4A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
              >
                {PROFILE_SECTIONS.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.label}
                    {dirtyMap[sec.id] ? ' (Unsaved)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Desktop Left Section Navigation */}
            <aside className="hidden lg:col-span-4 lg:block xl:col-span-3">
              <nav
                aria-label="Profile settings sections"
                className="sticky top-24 space-y-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs"
              >
                {PROFILE_SECTIONS.map((sec) => {
                  const isActive = activeSection === sec.id;
                  const isDirty = dirtyMap[sec.id];
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      aria-current={isActive ? 'location' : undefined}
                      onClick={() => handleRequestSectionSwitch(sec.id)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#142B4A] text-white'
                          : 'text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={isActive ? 'text-[#DBEAFE]' : 'text-[#64748B]'}>
                          {SECTION_ICONS[sec.id]}
                        </span>
                        <span className="truncate">{sec.label}</span>
                      </span>
                      {isDirty && (
                        <span
                          title="Unsaved changes"
                          aria-label="Unsaved changes"
                          className="h-2 w-2 shrink-0 rounded-full bg-amber-400"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Active Section Workspace */}
            <div className="min-w-0 lg:col-span-8 xl:col-span-9">
              {activeSection === 'personal' && (
                <PersonalInfoSection
                  draft={personalDraft}
                  savedEmail={savedProfile.personal.email}
                  studentCode={savedProfile.academic.student_code}
                  emailVerified={savedProfile.email_verified}
                  emailVerificationPending={savedProfile.email_verification_pending}
                  policy={savedProfile.policy}
                  errors={personalErrors}
                  isDirty={dirtyMap.personal}
                  isSaving={isSaving}
                  onChange={(next) => {
                    if (next.avatar_url !== personalDraft.avatar_url) {
                      setAvatarError(false);
                    }
                    setPersonalDraft(next);
                  }}
                  onSave={() => void handleSavePersonal()}
                  onCancel={() => resetSectionDraft('personal')}
                />
              )}

              {activeSection === 'academic' && (
                <AcademicInfoSection
                  draft={academicDraft}
                  policy={savedProfile.policy}
                  errors={academicErrors}
                  isDirty={dirtyMap.academic}
                  isSaving={isSaving}
                  onChange={setAcademicDraft}
                  onSave={() => void handleSaveAcademic()}
                  onCancel={() => resetSectionDraft('academic')}
                />
              )}

              {activeSection === 'interests' && (
                <ReadingInterestsSection
                  selectedInterests={interestsDraft}
                  availableInterests={availableInterests}
                  isDirty={dirtyMap.interests}
                  isSaving={isSaving}
                  onChange={(nextSelected, nextAvailable) => {
                    setInterestsDraft(nextSelected);
                    setAvailableInterests(nextAvailable);
                  }}
                  onSave={() => void handleSaveInterests()}
                  onCancel={() => resetSectionDraft('interests')}
                />
              )}

              {activeSection === 'subjects' && (
                <PreferredSubjectsSection
                  selectedSubjects={subjectsDraft}
                  availableSubjects={savedProfile.available_subjects}
                  isDirty={dirtyMap.subjects}
                  isSaving={isSaving}
                  onChange={setSubjectsDraft}
                  onSave={() => void handleSaveSubjects()}
                  onCancel={() => resetSectionDraft('subjects')}
                />
              )}

              {activeSection === 'recommendations' && (
                <RecommendationPreferencesSection
                  draft={recommendationDraft}
                  availableTopics={availableInterests}
                  isDirty={dirtyMap.recommendations}
                  isSaving={isSaving}
                  onChange={setRecommendationDraft}
                  onSave={() => void handleSaveRecommendationPrefs()}
                  onCancel={() => resetSectionDraft('recommendations')}
                  onNavigate={handleGuardedNavigate}
                />
              )}

              {activeSection === 'notifications' && (
                <NotificationPreferencesSection
                  draft={notificationDraft}
                  isDirty={dirtyMap.notifications}
                  isSaving={isSaving}
                  onChange={setNotificationDraft}
                  onSave={() => void handleSaveNotificationPrefs()}
                  onCancel={() => resetSectionDraft('notifications')}
                />
              )}

              {activeSection === 'security' && (
                <AccountSecuritySection
                  accountStatus={savedProfile.account_status}
                  emailVerified={savedProfile.email_verified}
                  passwordDraft={passwordDraft}
                  passwordErrors={passwordErrors}
                  isSavingPassword={isSaving}
                  activeSessions={savedProfile.active_sessions}
                  revokingSessionId={revokingSessionId}
                  policy={savedProfile.policy}
                  onPasswordChange={setPasswordDraft}
                  onSubmitPassword={() => void handleSubmitPasswordChange()}
                  onResetPasswordDraft={() => resetSectionDraft('security')}
                  onRevokeSession={(sessionId) => void handleRevokeSession(sessionId)}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesConfirmModal
        isOpen={pendingSwitchTarget !== null}
        targetSectionLabel={pendingTargetLabel}
        onDiscard={handleConfirmDiscardSwitch}
        onStay={() => setPendingSwitchTarget(null)}
      />
    </div>
  );
}

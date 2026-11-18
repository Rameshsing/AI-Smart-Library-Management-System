import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Info,
  KeyRound,
  Lock,
  Monitor,
  Save,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianShortDate,
  formatStaffDateTime,
  type LibrarianProfile,
} from '../../utils/librarianDashboard';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import { apiFetch } from '../../utils/clientSession';
import {
  buildLibrarianNotificationPrefsPayload,
  buildLibrarianProfileUpdatePayload,
  createSampleLibrarianFullProfilePayload,
  getLibrarianInitials,
  getStaffRolePermissionEntries,
  isLibrarianNotificationsDirty,
  isLibrarianPersonalDraftDirty,
  mapLibrarianProfileApiError,
  sanitizeLibrarianNotificationPreferences,
  validateLibrarianPasswordChange,
  validateLibrarianPersonalDraft,
  validateLibrarianPhotoFile,
  type LibrarianFullProfilePayload,
  type LibrarianNotificationCategory,
  type LibrarianNotificationPreferenceItem,
  type LibrarianPersonalDraft,
  type LibrarianPersonalFieldErrors,
  type LibrarianProfileSectionTab,
} from '../../utils/librarianProfile';
import {
  createEmptyPasswordDraft,
  isPasswordDraftDirty,
  type ChangePasswordDraft,
  type ChangePasswordFieldErrors,
} from '../../utils/studentProfilePage';
import { evaluatePasswordStrength } from '../../utils/studentRegistration';
import {
  CirculationPageHeader,
  CirculationStatusBadge,
} from './CirculationSharedComponents';

interface LibrarianProfilePageProps {
  librarian: LibrarianProfile;
  activeSection?: LibrarianProfileSectionTab;
  onProfileUpdated: (updated: LibrarianProfile) => void;
  onRegisterUnsavedGuard?: (guard: ((targetRoute: AppRoute) => boolean) | null) => void;
  onNavigate: (route: AppRoute) => void;
}

export function LibrarianProfilePage({
  librarian,
  activeSection = 'profile',
  onProfileUpdated,
  onRegisterUnsavedGuard,
  onNavigate,
}: LibrarianProfilePageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [sectionTab, setSectionTab] = useState<LibrarianProfileSectionTab>(activeSection);

  useEffect(() => {
    setSectionTab(activeSection);
  }, [activeSection]);

  const [payload, setPayload] = useState<LibrarianFullProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Personal info draft
  const [personalDraft, setPersonalDraft] = useState<LibrarianPersonalDraft>({
    full_name: librarian.full_name,
    email: librarian.email,
    mobile_number: '',
    avatar_url: librarian.avatar_url,
  });
  const [savedPersonal, setSavedPersonal] = useState<LibrarianPersonalDraft>({
    full_name: librarian.full_name,
    email: librarian.email,
    mobile_number: '',
    avatar_url: librarian.avatar_url,
  });
  const [personalErrors, setPersonalErrors] = useState<LibrarianPersonalFieldErrors>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [pendingEmailNotice, setPendingEmailNotice] = useState<string | null>(null);

  // Notifications draft
  const [notifDraft, setNotifDraft] = useState<LibrarianNotificationPreferenceItem[]>([]);
  const [savedNotifs, setSavedNotifs] = useState<LibrarianNotificationPreferenceItem[]>([]);
  const [isSavingNotifs, setIsSavingNotifs] = useState<boolean>(false);

  // Password draft
  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordDraft>(() =>
    createEmptyPasswordDraft()
  );
  const [passwordErrors, setPasswordErrors] = useState<ChangePasswordFieldErrors>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Unsaved navigation confirmation modal
  const [pendingLeaveRoute, setPendingLeaveRoute] = useState<AppRoute | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    tone: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const hydrateFromPayload = useCallback((data: LibrarianFullProfilePayload) => {
    setPayload(data);
    const basePersonal: LibrarianPersonalDraft = {
      full_name: data.librarian.full_name,
      email: data.librarian.email,
      mobile_number: data.librarian.mobile_number ?? '',
      avatar_url: data.librarian.avatar_url,
    };
    setPersonalDraft(basePersonal);
    setSavedPersonal(basePersonal);
    const sanitizedNotifs = sanitizeLibrarianNotificationPreferences(
      data.notification_preferences
    );
    setNotifDraft(sanitizedNotifs);
    setSavedNotifs(sanitizedNotifs);
  }, []);

  const loadLibrarianProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    if (!hasBackendApi) {
      await new Promise((r) => window.setTimeout(r, 80));
      const sample = createSampleLibrarianFullProfilePayload(librarian, referenceDate);
      hydrateFromPayload(sample);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/profile`, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 401) {
        onNavigate({ name: 'admin-login' });
        return;
      }
      if (!res.ok) {
        throw new Error(mapLibrarianProfileApiError(res.status));
      }
      const data = (await res.json()) as LibrarianFullProfilePayload;
      hydrateFromPayload({ ...data, is_prototype_sample: false });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load librarian profile.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, hasBackendApi, hydrateFromPayload, librarian, onNavigate, referenceDate]);

  useEffect(() => {
    void loadLibrarianProfile();
    // Load initial profile on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPersonalDirty = useMemo(
    () => isLibrarianPersonalDraftDirty(personalDraft, savedPersonal),
    [personalDraft, savedPersonal]
  );
  const isNotifDirty = useMemo(
    () => isLibrarianNotificationsDirty(notifDraft, savedNotifs),
    [notifDraft, savedNotifs]
  );
  const isPasswordDirty = useMemo(
    () => isPasswordDraftDirty(passwordDraft),
    [passwordDraft]
  );
  const hasAnyUnsavedChanges = isPersonalDirty || isNotifDirty || isPasswordDirty;

  useEffect(() => {
    if (!onRegisterUnsavedGuard) return;
    onRegisterUnsavedGuard((targetRoute: AppRoute) => {
      // Allow switching sub-sections inside librarian-profile without tripping route leave modal
      if (targetRoute.name === 'librarian-profile') {
        return true;
      }
      if (!hasAnyUnsavedChanges) {
        return true;
      }
      setPendingLeaveRoute(targetRoute);
      return false;
    });
    return () => onRegisterUnsavedGuard(null);
  }, [hasAnyUnsavedChanges, onRegisterUnsavedGuard]);

  useEffect(() => {
    if (!hasAnyUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasAnyUnsavedChanges]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    const validation = validateLibrarianPhotoFile(file);
    if (!validation.isValid) {
      setPhotoError(validation.error);
      event.target.value = '';
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setPersonalDraft((prev) => ({ ...prev, avatar_url: previewUrl }));
    setIsEditingProfile(true);
  };

  const handleRemovePhoto = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhotoError(null);
    setPersonalDraft((prev) => ({ ...prev, avatar_url: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalErrors({});
    setPhotoError(null);

    const check = validateLibrarianPersonalDraft(personalDraft, savedPersonal.email);
    if (!check.isValid) {
      setPersonalErrors(check.errors);
      return;
    }

    const requestBody = buildLibrarianProfileUpdatePayload(personalDraft);
    setIsSavingProfile(true);

    try {
      if (hasBackendApi) {
        const res = await apiFetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/profile`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          librarian?: LibrarianProfile;
        };
        if (!res.ok) {
          throw new Error(mapLibrarianProfileApiError(res.status, data.message));
        }
        if (data.librarian) {
          onProfileUpdated(data.librarian);
        }
      } else {
        await new Promise((r) => window.setTimeout(r, 120));
        if (payload) {
          const updatedLibrarian: LibrarianProfile = {
            librarian_id: payload.librarian.librarian_id,
            user_id: payload.librarian.user_id,
            staff_code: payload.librarian.staff_code,
            full_name: requestBody.full_name,
            email: requestBody.email,
            department_title: payload.librarian.department_title,
            role: 'librarian',
            account_status: payload.librarian.account_status,
            avatar_url: requestBody.avatar_url,
            permissions: payload.librarian.permissions,
          };
          setPayload((prev) =>
            prev
              ? {
                  ...prev,
                  librarian: {
                    ...prev.librarian,
                    ...updatedLibrarian,
                    mobile_number: requestBody.mobile_number ?? '',
                  },
                }
              : prev
          );
          onProfileUpdated(updatedLibrarian);
        }
      }

      const committed: LibrarianPersonalDraft = {
        full_name: requestBody.full_name,
        email: requestBody.email,
        mobile_number: requestBody.mobile_number ?? '',
        avatar_url: requestBody.avatar_url,
      };
      setPersonalDraft(committed);
      setSavedPersonal(committed);
      setIsEditingProfile(false);
      setPendingEmailNotice(
        check.emailChanged
          ? `Email updated to ${requestBody.email}. Institutional email verification may be required on next sign-in.`
          : null
      );
      setToastMessage({
        tone: 'success',
        text: 'Librarian profile details saved successfully.',
      });
    } catch (err) {
      setToastMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to save profile details.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleNotification = (
    category: LibrarianNotificationCategory,
    channel: 'in_app_enabled' | 'email_enabled'
  ) => {
    setNotifDraft((prev) =>
      sanitizeLibrarianNotificationPreferences(
        prev.map((item) => {
          if (item.category !== category) return item;
          if (channel === 'in_app_enabled' && item.is_mandatory) {
            return item;
          }
          if (channel === 'email_enabled' && !item.email_supported) {
            return item;
          }
          return { ...item, [channel]: !item[channel] };
        })
      )
    );
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestBody = buildLibrarianNotificationPrefsPayload(notifDraft);
    setIsSavingNotifs(true);

    try {
      if (hasBackendApi) {
        const res = await apiFetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/notification-preferences`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(mapLibrarianProfileApiError(res.status, data.message));
        }
      } else {
        await new Promise((r) => window.setTimeout(r, 120));
      }

      const sanitized = sanitizeLibrarianNotificationPreferences(notifDraft);
      setNotifDraft(sanitized);
      setSavedNotifs(sanitized);
      setToastMessage({
        tone: 'success',
        text: 'Librarian notification preferences saved.',
      });
    } catch (err) {
      setToastMessage({
        tone: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to update notification preferences.',
      });
    } finally {
      setIsSavingNotifs(false);
    }
  };

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(passwordDraft.new_password),
    [passwordDraft.new_password]
  );

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});

    const validation = validateLibrarianPasswordChange(passwordDraft);
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      return;
    }

    setIsSavingPassword(true);
    try {
      if (hasBackendApi) {
        const res = await apiFetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/change-password`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              current_password: passwordDraft.current_password,
              new_password: passwordDraft.new_password,
            }),
          }
        );
        if (res.status === 401) {
          onNavigate({ name: 'admin-login' });
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          if (res.status === 400 || res.status === 422) {
            setPasswordErrors({
              current_password: data.message ?? 'Current password verification failed.',
            });
            return;
          }
          throw new Error(mapLibrarianProfileApiError(res.status, data.message));
        }
      } else {
        await new Promise((r) => window.setTimeout(r, 140));
      }

      setPasswordDraft(createEmptyPasswordDraft());
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setToastMessage({
        tone: 'success',
        text: 'Staff password updated successfully. Security confirmation logged.',
      });
    } catch (err) {
      setToastMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Unable to update password.',
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!payload) return;
    if (hasBackendApi) {
      try {
        const res = await apiFetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/librarian/sessions/${encodeURIComponent(
            sessionId
          )}`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        );
        if (!res.ok) throw new Error('Unable to revoke session.');
      } catch (err) {
        setToastMessage({
          tone: 'error',
          text: err instanceof Error ? err.message : 'Unable to revoke session.',
        });
        return;
      }
    }
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            active_sessions: prev.active_sessions.filter((s) => s.session_id !== sessionId),
          }
        : prev
    );
    setToastMessage({ tone: 'success', text: 'Staff session revoked.' });
  };

  const switchSection = (nextSection: LibrarianProfileSectionTab) => {
    setSectionTab(nextSection);
    onNavigate({ name: 'librarian-profile', section: nextSection });
  };

  const staff = payload?.librarian;
  const initials = getLibrarianInitials(personalDraft.full_name || librarian.full_name);

  return (
    <div className="space-y-6">
      <CirculationPageHeader
        title="My Staff Profile & Preferences"
        subtitle="Manage your personal librarian contact details, operational alert preferences, and staff account password."
        onNavigate={(target) => {
          if (hasAnyUnsavedChanges) {
            setPendingLeaveRoute(target);
          } else {
            onNavigate(target);
          }
        }}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium shadow-xs ${
            toastMessage.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : toastMessage.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-[#DBEAFE] bg-[#F5F8FC] text-[#142B4A]'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : toastMessage.tone === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Dismiss notification"
            className="rounded p-1 hover:bg-black/5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadLibrarianProfile()}
              className="rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800 cursor-pointer"
            >
              Retry
            </button>
          </div>
        </section>
      ) : isLoading || !payload || !staff ? (
        <div className="space-y-6 animate-pulse" aria-label="Loading librarian profile">
          <div className="h-32 rounded-xl border border-slate-200 bg-white p-6" />
          <div className="h-80 rounded-xl border border-slate-200 bg-white p-6" />
        </div>
      ) : (
        <>
          {/* Profile Summary Header Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-[#DBEAFE] bg-[#142B4A] text-white sm:h-20 sm:w-20">
                  {personalDraft.avatar_url ? (
                    <img
                      src={personalDraft.avatar_url}
                      alt={personalDraft.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-xl font-bold tracking-tight">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-[#142B4A] sm:text-xl">
                      {personalDraft.full_name}
                    </h3>
                    <CirculationStatusBadge status={staff.account_status} />
                    <span className="rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#142B4A]">
                      {staff.staff_code}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#1E293B]">
                    {staff.designation} · {staff.branch}
                  </p>
                  <p className="mt-0.5 text-xs text-[#64748B]">{personalDraft.email}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    switchSection('profile');
                    setIsEditingProfile(true);
                    window.requestAnimationFrame(() => nameInputRef.current?.focus());
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
                >
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>

            {/* Section Tabs */}
            <div
              role="tablist"
              aria-label="Librarian profile sections"
              className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sectionTab === 'profile'}
                onClick={() => switchSection('profile')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  sectionTab === 'profile'
                    ? 'bg-[#142B4A] text-white'
                    : 'bg-[#F5F8FC] text-[#1E293B] hover:bg-[#DBEAFE]/60'
                }`}
              >
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Personal &amp; Staff Details</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={sectionTab === 'settings'}
                onClick={() => switchSection('settings')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  sectionTab === 'settings'
                    ? 'bg-[#142B4A] text-white'
                    : 'bg-[#F5F8FC] text-[#1E293B] hover:bg-[#DBEAFE]/60'
                }`}
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Notification Preferences</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={sectionTab === 'password'}
                onClick={() => switchSection('password')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  sectionTab === 'password'
                    ? 'bg-[#142B4A] text-white'
                    : 'bg-[#F5F8FC] text-[#1E293B] hover:bg-[#DBEAFE]/60'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Security &amp; Password</span>
              </button>
            </div>
          </section>

          {/* TAB 1: Personal & Employment Details */}
          {sectionTab === 'profile' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              {/* Editable Personal Info Form */}
              <section
                aria-labelledby="librarian-personal-info-heading"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4
                      id="librarian-personal-info-heading"
                      className="font-display text-base font-bold text-[#142B4A]"
                    >
                      Personal Contact Information
                    </h4>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Update your display name, institutional email, phone number, or staff photo.
                    </p>
                  </div>
                  {isPersonalDirty && (
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Unsaved Changes
                    </span>
                  )}
                </div>

                {pendingEmailNotice && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] p-3 text-xs text-[#142B4A]">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                    <span>{pendingEmailNotice}</span>
                  </div>
                )}

                <form onSubmit={handleSavePersonalInfo} className="mt-5 space-y-5" noValidate>
                  {/* Photo Upload Control */}
                  {payload.capabilities.allow_photo_upload && (
                    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#142B4A] text-white">
                        {personalDraft.avatar_url ? (
                          <img
                            src={personalDraft.avatar_url}
                            alt="Profile photo preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-display text-sm font-bold">
                            {initials}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#142B4A]">
                          Staff Profile Photo
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          JPG, PNG, or WebP up to 2 MB.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            ref={fileInputRef}
                            id="librarian-photo-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handlePhotoSelect}
                            className="sr-only"
                          />
                          <label
                            htmlFor="librarian-photo-upload"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                          >
                            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Upload Photo</span>
                          </label>
                          {personalDraft.avatar_url && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                        {photoError && (
                          <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                            {photoError}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="librarian-full-name"
                        className="block text-xs font-semibold text-[#142B4A]"
                      >
                        Full Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        ref={nameInputRef}
                        id="librarian-full-name"
                        type="text"
                        value={personalDraft.full_name}
                        onChange={(e) => {
                          setIsEditingProfile(true);
                          setPersonalDraft((prev) => ({
                            ...prev,
                            full_name: e.target.value,
                          }));
                        }}
                        aria-invalid={Boolean(personalErrors.full_name)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1E293B] focus:outline-hidden ${
                          personalErrors.full_name
                            ? 'border-red-400 bg-red-50/40'
                            : 'border-slate-300 bg-white focus:border-[#2563EB]'
                        }`}
                      />
                      {personalErrors.full_name && (
                        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                          {personalErrors.full_name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="librarian-email"
                        className="block text-xs font-semibold text-[#142B4A]"
                      >
                        Institutional Email <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="librarian-email"
                        type="email"
                        value={personalDraft.email}
                        onChange={(e) => {
                          setIsEditingProfile(true);
                          setPersonalDraft((prev) => ({ ...prev, email: e.target.value }));
                        }}
                        aria-invalid={Boolean(personalErrors.email)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1E293B] focus:outline-hidden ${
                          personalErrors.email
                            ? 'border-red-400 bg-red-50/40'
                            : 'border-slate-300 bg-white focus:border-[#2563EB]'
                        }`}
                      />
                      {personalErrors.email && (
                        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                          {personalErrors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="librarian-mobile"
                        className="block text-xs font-semibold text-[#142B4A]"
                      >
                        Mobile / Desk Extension
                      </label>
                      <input
                        id="librarian-mobile"
                        type="tel"
                        value={personalDraft.mobile_number}
                        onChange={(e) => {
                          setIsEditingProfile(true);
                          setPersonalDraft((prev) => ({
                            ...prev,
                            mobile_number: e.target.value,
                          }));
                        }}
                        placeholder="+91 98204 51120"
                        aria-invalid={Boolean(personalErrors.mobile_number)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-[#1E293B] focus:outline-hidden ${
                          personalErrors.mobile_number
                            ? 'border-red-400 bg-red-50/40'
                            : 'border-slate-300 bg-white focus:border-[#2563EB]'
                        }`}
                      />
                      {personalErrors.mobile_number && (
                        <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                          {personalErrors.mobile_number}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                    {(isPersonalDirty || isEditingProfile) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPersonalDraft(savedPersonal);
                          setPersonalErrors({});
                          setPhotoError(null);
                          setIsEditingProfile(false);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
                      >
                        Discard Changes
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={isSavingProfile || !isPersonalDirty}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSavingProfile ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Read-Only Employment & Role Scope Card */}
              <div className="space-y-6 xl:col-span-5">
                <section
                  aria-labelledby="librarian-employment-heading"
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h4
                        id="librarian-employment-heading"
                        className="font-display text-base font-bold text-[#142B4A]"
                      >
                        Staff Employment &amp; Role Scope
                      </h4>
                      <p className="mt-0.5 text-xs text-[#64748B]">
                        Verified read-only institutional assignment.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-[#F5F8FC] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      <span>Read-Only</span>
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg bg-[#F5F8FC] p-3">
                      <dt className="text-[11px] font-medium text-[#64748B]">Staff ID</dt>
                      <dd className="font-mono-tabular mt-0.5 font-bold text-[#142B4A]">
                        {staff.staff_code}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-[#F5F8FC] p-3">
                      <dt className="text-[11px] font-medium text-[#64748B]">Account Role</dt>
                      <dd className="mt-0.5 font-bold capitalize text-[#142B4A]">
                        {staff.role}
                      </dd>
                    </div>
                    <div className="col-span-2 rounded-lg bg-[#F5F8FC] p-3">
                      <dt className="text-[11px] font-medium text-[#64748B]">
                        Designation / Department
                      </dt>
                      <dd className="mt-0.5 font-semibold text-[#142B4A]">
                        {staff.designation}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-[#F5F8FC] p-3">
                      <dt className="text-[11px] font-medium text-[#64748B]">Assigned Branch</dt>
                      <dd className="mt-0.5 font-semibold text-[#1E293B]">{staff.branch}</dd>
                    </div>
                    <div className="rounded-lg bg-[#F5F8FC] p-3">
                      <dt className="text-[11px] font-medium text-[#64748B]">Joining Date</dt>
                      <dd className="font-mono-tabular mt-0.5 font-semibold text-[#1E293B]">
                        {formatLibrarianShortDate(staff.joining_date)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold text-[#142B4A]">
                      Assigned Operational Permissions
                    </p>
                    <ul className="mt-2.5 grid grid-cols-1 gap-1.5 text-xs">
                      {getStaffRolePermissionEntries(staff.permissions).map((perm) => (
                        <li
                          key={perm.key}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F8FC]/70 px-2.5 py-1.5"
                        >
                          <span className="text-[#1E293B]">{perm.label}</span>
                          <span
                            className={`font-semibold ${
                              perm.granted ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {perm.granted ? 'Enabled' : 'Restricted'}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">
                      Roles, account status, staff IDs, and operational permissions are governed
                      exclusively by Library Administrators and cannot be self-modified.
                    </p>
                  </div>
                </section>

                {/* Audit Trail / Recent Activity */}
                <section
                  aria-labelledby="librarian-audit-heading"
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
                >
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <History className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                    <h4
                      id="librarian-audit-heading"
                      className="font-display text-sm font-bold text-[#142B4A]"
                    >
                      Recent Staff Activity Log
                    </h4>
                  </div>

                  {!payload.capabilities.supports_audit_logs ? (
                    <p className="mt-3 text-xs leading-relaxed text-[#64748B]">
                      Central staff audit logging is managed by the university authentication
                      backend. Connect a live reporting/audit server to display verified action
                      logs.
                    </p>
                  ) : payload.recent_activity.length === 0 ? (
                    <p className="mt-3 text-xs text-[#64748B]">
                      No recent staff profile activity recorded.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100 text-xs">
                      {payload.recent_activity.map((item) => (
                        <li key={item.activity_id} className="py-2.5 first:pt-1 last:pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#142B4A]">{item.action}</span>
                            <span className="font-mono-tabular text-[11px] text-[#64748B]">
                              {formatStaffDateTime(item.timestamp)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[#64748B]">{item.target_summary}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}

          {/* TAB 2: Notification Preferences */}
          {sectionTab === 'settings' && (
            <section
              aria-labelledby="librarian-notifications-heading"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h4
                    id="librarian-notifications-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Operational Notification Preferences
                  </h4>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Choose which library alerts appear in your staff workspace.
                    {!payload.capabilities.supports_email_notifications
                      ? ' Email delivery channels require SMTP configuration on the backend.'
                      : ''}
                  </p>
                </div>
                {isNotifDirty && (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Unsaved Preferences
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveNotifications} className="mt-5 space-y-3">
                {notifDraft.map((item) => (
                  <div
                    key={item.category}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#142B4A]">{item.label}</span>
                        {item.is_mandatory && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#DBEAFE] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                            <ShieldCheck className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                            <span>Mandatory</span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#64748B]">{item.description}</p>
                      {item.mandatory_reason && (
                        <p className="mt-1 text-[11px] font-medium text-[#2563EB]">
                          {item.mandatory_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-2 font-medium text-[#1E293B]">
                        <input
                          type="checkbox"
                          checked={item.in_app_enabled}
                          disabled={item.is_mandatory}
                          onChange={() =>
                            handleToggleNotification(item.category, 'in_app_enabled')
                          }
                          aria-label={`${item.label} in-app alerts`}
                          className="h-4 w-4 rounded border-slate-300 text-[#2563EB] disabled:opacity-60"
                        />
                        <span>In-App</span>
                      </label>

                      <label
                        className={`inline-flex items-center gap-2 font-medium ${
                          item.email_supported ? 'text-[#1E293B]' : 'text-slate-400'
                        }`}
                        title={
                          item.email_supported
                            ? 'Toggle email alerts'
                            : 'Email notification service not configured'
                        }
                      >
                        <input
                          type="checkbox"
                          checked={item.email_enabled}
                          disabled={!item.email_supported}
                          onChange={() =>
                            handleToggleNotification(item.category, 'email_enabled')
                          }
                          aria-label={`${item.label} email alerts`}
                          className="h-4 w-4 rounded border-slate-300 text-[#2563EB] disabled:opacity-50"
                        />
                        <span>Email</span>
                      </label>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={isSavingNotifs || !isNotifDirty}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {isSavingNotifs ? 'Saving Preferences...' : 'Save Notification Preferences'}
                    </span>
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* TAB 3: Security & Password */}
          {sectionTab === 'password' && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <section
                aria-labelledby="librarian-password-heading"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-7"
              >
                <div className="border-b border-slate-100 pb-4">
                  <h4
                    id="librarian-password-heading"
                    className="font-display text-base font-bold text-[#142B4A]"
                  >
                    Change Staff Account Password
                  </h4>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Verify your current password before setting a strong new password (minimum 8
                    characters).
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="mt-5 space-y-4" noValidate>
                  <div>
                    <label
                      htmlFor="staff-current-password"
                      className="block text-xs font-semibold text-[#142B4A]"
                    >
                      Current Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="staff-current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordDraft.current_password}
                        onChange={(e) =>
                          setPasswordDraft((prev) => ({
                            ...prev,
                            current_password: e.target.value,
                          }))
                        }
                        autoComplete="current-password"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={
                          showCurrentPassword ? 'Hide current password' : 'Show current password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#142B4A] cursor-pointer"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.current_password && (
                      <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                        {passwordErrors.current_password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="staff-new-password"
                      className="block text-xs font-semibold text-[#142B4A]"
                    >
                      New Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="staff-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordDraft.new_password}
                        onChange={(e) =>
                          setPasswordDraft((prev) => ({
                            ...prev,
                            new_password: e.target.value,
                          }))
                        }
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword ? 'Hide new password' : 'Show new password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#142B4A] cursor-pointer"
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {passwordDraft.new_password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#64748B]">Password Strength</span>
                          <span
                            className={`font-semibold ${
                              passwordStrength.label === 'Strong'
                                ? 'text-emerald-700'
                                : passwordStrength.label === 'Good' ||
                                    passwordStrength.label === 'Fair'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                          >
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full transition-all ${
                              passwordStrength.label === 'Strong'
                                ? 'w-full bg-emerald-600'
                                : passwordStrength.label === 'Good'
                                  ? 'w-3/4 bg-[#2563EB]'
                                  : passwordStrength.label === 'Fair'
                                    ? 'w-1/2 bg-amber-500'
                                    : 'w-1/4 bg-red-500'
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {passwordErrors.new_password && (
                      <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                        {passwordErrors.new_password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="staff-confirm-password"
                      className="block text-xs font-semibold text-[#142B4A]"
                    >
                      Confirm New Password <span className="text-red-600">*</span>
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="staff-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordDraft.confirm_new_password}
                        onChange={(e) =>
                          setPasswordDraft((prev) => ({
                            ...prev,
                            confirm_new_password: e.target.value,
                          }))
                        }
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? 'Hide confirm password'
                            : 'Show confirm password'
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#142B4A] cursor-pointer"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirm_new_password && (
                      <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                        {passwordErrors.confirm_new_password}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                    <button
                      type="submit"
                      disabled={isSavingPassword}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSavingPassword ? 'Updating...' : 'Update Password'}</span>
                    </button>
                  </div>
                </form>
              </section>

              {/* Active Sessions */}
              <section
                aria-labelledby="librarian-sessions-heading"
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 xl:col-span-5"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Monitor className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                  <div>
                    <h4
                      id="librarian-sessions-heading"
                      className="font-display text-base font-bold text-[#142B4A]"
                    >
                      Active Staff Sessions
                    </h4>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      Manage devices signed into your librarian account.
                    </p>
                  </div>
                </div>

                {!payload.capabilities.supports_session_management ? (
                  <p className="mt-4 text-xs text-[#64748B]">
                    Session management is handled by the central institutional SSO provider.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {payload.active_sessions.map((sess) => (
                      <li
                        key={sess.session_id}
                        className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-[#142B4A]">{sess.device_label}</p>
                            <p className="mt-0.5 text-[#64748B]">
                              {sess.browser} · {sess.location_summary}
                            </p>
                            <p className="font-mono-tabular mt-1 text-[11px] text-[#64748B]">
                              Last active: {formatStaffDateTime(sess.last_active_at)}
                            </p>
                          </div>
                          {sess.is_current ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Current
                            </span>
                          ) : sess.can_revoke ? (
                            <button
                              type="button"
                              onClick={() => void handleRevokeSession(sess.session_id)}
                              className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                            >
                              Sign Out
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {/* Unsaved Changes Leave Confirmation Modal */}
      {pendingLeaveRoute && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-profile-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div>
                <h4
                  id="unsaved-profile-modal-title"
                  className="font-display text-base font-bold text-[#142B4A]"
                >
                  Unsaved Profile Changes
                </h4>
                <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                  You have unsaved edits in your staff profile, preferences, or password form.
                  Leave without saving?
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLeaveRoute(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
              >
                Stay on Page
              </button>
              <button
                type="button"
                onClick={() => {
                  const dest = pendingLeaveRoute;
                  setPendingLeaveRoute(null);
                  setPersonalDraft(savedPersonal);
                  setNotifDraft(savedNotifs);
                  setPasswordDraft(createEmptyPasswordDraft());
                  onNavigate(dest);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
              >
                Discard &amp; Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

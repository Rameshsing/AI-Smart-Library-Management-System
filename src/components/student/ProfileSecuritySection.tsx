import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Laptop,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { NotificationPreferencesPayload } from '../../utils/notificationsPage';
import { formatNotificationDateTime } from '../../utils/notificationsPage';
import { evaluatePasswordStrength } from '../../utils/studentRegistration';
import type {
  AccountStatus,
  ActiveSessionRecord,
  ChangePasswordDraft,
  ChangePasswordFieldErrors,
  ProfilePolicyFlags,
} from '../../utils/studentProfilePage';
import { NotificationPreferencesPanel } from './NotificationModals';

interface NotificationPreferencesSectionProps {
  draft: NotificationPreferencesPayload;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (next: NotificationPreferencesPayload) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function NotificationPreferencesSection({
  draft,
  isDirty,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: NotificationPreferencesSectionProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-display text-lg font-bold text-[#142B4A]">
          Notification Preferences
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Control in-app alerts, supported email notifications, and due-date reminder timings while
          preserving mandatory library compliance notices.
        </p>
      </div>

      <div className="mt-5">
        <NotificationPreferencesPanel
          preferences={draft}
          isDisabled={isSaving}
          onChange={onChange}
        />
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2.5 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-[#64748B]">
          {isDirty
            ? 'Notification preferences have unsaved changes.'
            : 'Notification channels match your saved settings.'}
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
            <span>Save Notification Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface AccountSecuritySectionProps {
  accountStatus: AccountStatus;
  emailVerified: boolean;
  passwordDraft: ChangePasswordDraft;
  passwordErrors: ChangePasswordFieldErrors;
  isSavingPassword: boolean;
  activeSessions: ActiveSessionRecord[];
  revokingSessionId: string | null;
  policy: ProfilePolicyFlags;
  onPasswordChange: (next: ChangePasswordDraft) => void;
  onSubmitPassword: () => void;
  onResetPasswordDraft: () => void;
  onRevokeSession: (sessionId: string) => void;
}

function getStatusBadgeClasses(status: AccountStatus): string {
  if (status === 'Active') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'Pending') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-red-200 bg-red-50 text-red-800';
}

export function AccountSecuritySection({
  accountStatus,
  emailVerified,
  passwordDraft,
  passwordErrors,
  isSavingPassword,
  activeSessions,
  revokingSessionId,
  policy,
  onPasswordChange,
  onSubmitPassword,
  onResetPasswordDraft,
  onRevokeSession,
}: AccountSecuritySectionProps) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = evaluatePasswordStrength(passwordDraft.new_password);
  const hasPasswordInput = Boolean(
    passwordDraft.current_password ||
      passwordDraft.new_password ||
      passwordDraft.confirm_new_password
  );

  const strengthBarColors: Record<number, string> = {
    0: 'bg-slate-200',
    1: 'bg-red-500',
    2: 'bg-amber-500',
    3: 'bg-[#2563EB]',
    4: 'bg-emerald-600',
  };

  return (
    <div className="space-y-6">
      {/* Account Status (Read-only) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#142B4A]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-[#142B4A]">
                Account Status &amp; Verification
              </h3>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Account status and borrowing eligibility are governed by library administration.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClasses(
                accountStatus
              )}`}
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Status: {accountStatus}</span>
            </span>
            <span className="rounded-md border border-slate-200 bg-[#F5F8FC] px-2.5 py-1 text-xs font-medium text-[#142B4A]">
              {emailVerified ? 'Email Verified' : 'Email Verification Pending'}
            </span>
          </div>
        </div>
      </section>

      {/* Change Password */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmitPassword();
        }}
        noValidate
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-display text-lg font-bold text-[#142B4A]">Change Password</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Passwords are verified and hashed server-side—never stored in plain text.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:max-w-lg">
          {/* Current Password */}
          <div>
            <label
              htmlFor="sec-current-password"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Current Password <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                id="sec-current-password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwordDraft.current_password}
                disabled={isSavingPassword}
                aria-invalid={Boolean(passwordErrors.current_password)}
                onChange={(e) =>
                  onPasswordChange({ ...passwordDraft, current_password: e.target.value })
                }
                placeholder="Enter current password"
                className={`min-h-[42px] w-full rounded-lg border py-2 pr-10 pl-3.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
                  passwordErrors.current_password
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-[#142B4A] cursor-pointer"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.current_password && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {passwordErrors.current_password}
              </p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label
              htmlFor="sec-new-password"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              New Password <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                id="sec-new-password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordDraft.new_password}
                disabled={isSavingPassword}
                aria-invalid={Boolean(passwordErrors.new_password)}
                onChange={(e) =>
                  onPasswordChange({ ...passwordDraft, new_password: e.target.value })
                }
                placeholder="Minimum 8 characters with letters & numbers"
                className={`min-h-[42px] w-full rounded-lg border py-2 pr-10 pl-3.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
                  passwordErrors.new_password
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-[#142B4A] cursor-pointer"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {passwordDraft.new_password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={`h-1.5 rounded-full transition-colors ${
                        strength.score >= step
                          ? strengthBarColors[strength.score]
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-medium text-[#64748B]">
                  Password strength:{' '}
                  <strong className="text-[#142B4A]">{strength.label}</strong>
                </p>
              </div>
            )}

            {passwordErrors.new_password && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {passwordErrors.new_password}
              </p>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="sec-confirm-password"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Confirm New Password <span className="text-red-600">*</span>
            </label>
            <div className="relative mt-1.5">
              <input
                id="sec-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordDraft.confirm_new_password}
                disabled={isSavingPassword}
                aria-invalid={Boolean(passwordErrors.confirm_new_password)}
                onChange={(e) =>
                  onPasswordChange({
                    ...passwordDraft,
                    confirm_new_password: e.target.value,
                  })
                }
                placeholder="Re-enter your new password"
                className={`min-h-[42px] w-full rounded-lg border py-2 pr-10 pl-3.5 text-sm text-[#1E293B] focus:outline-none focus:ring-2 ${
                  passwordErrors.confirm_new_password
                    ? 'border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 bg-white focus:border-[#2563EB] focus:ring-[#DBEAFE]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-[#142B4A] cursor-pointer"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.confirm_new_password && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                {passwordErrors.confirm_new_password}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-5">
          <button
            type="button"
            disabled={!hasPasswordInput || isSavingPassword}
            onClick={onResetPasswordDraft}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSavingPassword}
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isSavingPassword && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>Update Password</span>
          </button>
        </div>
      </form>

      {/* Active Sessions */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-display text-lg font-bold text-[#142B4A]">Active Sessions</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            Devices currently signed in to your library account. Revoke unfamiliar sessions
            immediately.
          </p>
        </div>

        {activeSessions.length === 0 ? (
          <p className="mt-4 text-xs text-[#64748B]">No active session metadata available.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {activeSessions.map((session) => {
              const isMobile = /mobile|android|iphone/i.test(session.device_label);
              const isRevoking = revokingSessionId === session.session_id;
              return (
                <div
                  key={session.session_id}
                  className="flex flex-col justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F5F8FC] text-[#142B4A]">
                      {isMobile ? (
                        <Smartphone className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Laptop className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-[#142B4A]">
                          {session.device_label}
                        </p>
                        {session.is_current && (
                          <span className="rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#64748B]">
                        {session.browser} · {session.location_summary} · Last active{' '}
                        <span className="font-mono-tabular">
                          {formatNotificationDateTime(session.last_active_at)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {!session.is_current && policy.allow_session_revoke && session.can_revoke && (
                    <button
                      type="button"
                      disabled={isRevoking}
                      onClick={() => onRevokeSession(session.session_id)}
                      className="inline-flex min-h-[36px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                    >
                      {isRevoking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Revoke Session</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!policy.allow_account_deletion && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-3.5 text-xs text-[#64748B]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
            <span>
              Institutional library accounts retain borrowing &amp; clearance audit logs per
              university policy and cannot be self-deleted online. Contact the library
              administration desk upon graduation or withdrawal.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

interface UnsavedChangesConfirmModalProps {
  isOpen: boolean;
  targetSectionLabel: string;
  onDiscard: () => void;
  onStay: () => void;
}

export function UnsavedChangesConfirmModal({
  isOpen,
  targetSectionLabel,
  onDiscard,
  onStay,
}: UnsavedChangesConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onStay();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onStay]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-profile-changes-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]" onClick={onStay} />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2
              id="unsaved-profile-changes-title"
              className="font-display text-base font-bold text-[#142B4A]"
            >
              Unsaved changes
            </h2>
          </div>

          <button
            type="button"
            onClick={onStay}
            aria-label="Stay on current section"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm leading-relaxed text-[#1E293B]">
            You have unsaved edits in the current section. If you switch to{' '}
            <strong className="text-[#142B4A]">{targetSectionLabel}</strong> now, those unsaved
            edits will be discarded.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            Stay &amp; Keep Editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

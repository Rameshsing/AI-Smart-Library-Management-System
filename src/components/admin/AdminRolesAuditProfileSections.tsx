import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileClock,
  KeyRound,
  Lock,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import type { AdminProfile } from '../../utils/adminDashboard';
import { formatStaffDateTime } from '../../utils/adminDashboard';
import {
  canUpdateRolePermission,
  filterAndPaginateAuditLogs,
  PERMISSION_CATALOG,
  type AdminAuditLogEntry,
  type PermissionKey,
  type RolePermissionDefinition,
} from '../../utils/adminManagement';
import {
  validateChangePassword,
  type ChangePasswordDraft,
} from '../../utils/studentProfilePage';
import { evaluatePasswordStrength } from '../../utils/studentRegistration';

interface AdminRolePermissionSectionProps {
  roles: RolePermissionDefinition[];
  onToggleRolePermission: (
    roleKey: 'admin' | 'librarian' | 'student',
    permissionKey: PermissionKey,
    nextValue: boolean
  ) => { ok: boolean; error?: string };
}

export function AdminRolePermissionSection({
  roles,
  onToggleRolePermission,
}: AdminRolePermissionSectionProps) {
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, typeof PERMISSION_CATALOG> = {};
    for (const item of PERMISSION_CATALOG) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return Object.entries(groups);
  }, []);

  const handleToggle = (
    roleKey: 'admin' | 'librarian' | 'student',
    permKey: PermissionKey,
    nextValue: boolean
  ) => {
    const guard = canUpdateRolePermission({
      roleKey,
      permissionKey: permKey,
      nextValue,
    });
    if (!guard.allowed) {
      setFeedback({ type: 'error', message: guard.reason ?? 'Permission rule protected.' });
      return;
    }
    const res = onToggleRolePermission(roleKey, permKey, nextValue);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Could not update permission.' });
    } else {
      setFeedback({
        type: 'success',
        message: `Updated "${permKey}" permission on ${roleKey.toUpperCase()} role.`,
      });
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {feedback.message}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-[#142B4A]">
            Role & Permission Governance Matrix
          </h2>
          <p className="text-xs text-[#64748B]">
            Core Administrator governance safeguards and strict Student isolation boundaries are enforced automatically.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {roles.map((role) => (
            <div
              key={role.role_key}
              className="rounded-lg border border-slate-200 bg-[#F5F8FC]/60 p-3.5"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                <h3 className="text-xs font-bold text-[#142B4A]">{role.display_name}</h3>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                {role.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-4 font-semibold">Capability / Scope</th>
                {roles.map((r) => (
                  <th key={r.role_key} className="py-2.5 px-3 text-center font-semibold">
                    {r.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupedCatalog.map(([category, items]) => (
                <React.Fragment key={category}>
                  <tr className="bg-[#F5F8FC]">
                    <td
                      colSpan={roles.length + 1}
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#142B4A]"
                    >
                      {category}
                    </td>
                  </tr>
                  {items.map((perm) => (
                    <tr key={perm.key} className="hover:bg-[#F5F8FC]/40">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#142B4A]">{perm.label}</p>
                        <p className="text-[11px] text-[#64748B]">{perm.description}</p>
                      </td>
                      {roles.map((role) => {
                        const checked = role.permissions[perm.key];
                        const guard = canUpdateRolePermission({
                          roleKey: role.role_key,
                          permissionKey: perm.key,
                          nextValue: !checked,
                        });

                        return (
                          <td key={role.role_key} className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${role.display_name}: ${perm.label}`}
                              checked={checked}
                              disabled={!guard.allowed}
                              title={guard.reason ?? undefined}
                              onChange={(e) =>
                                handleToggle(role.role_key, perm.key, e.target.checked)
                              }
                              className="h-4 w-4 accent-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface AdminAuditLogsSectionProps {
  logs: AdminAuditLogEntry[];
}

export function AdminAuditLogsSection({ logs }: AdminAuditLogsSectionProps) {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState<'All' | AdminAuditLogEntry['entity_type']>('All');
  const [resultFilter, setResultFilter] = useState<'All' | AdminAuditLogEntry['result']>('All');
  const [page, setPage] = useState(1);

  const paged = useMemo(
    () =>
      filterAndPaginateAuditLogs(
        logs,
        { query, entityType, result: resultFilter },
        page,
        10
      ),
    [logs, query, entityType, resultFilter, page]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#142B4A]">
            Administrative Audit Log ({paged.totalCount})
          </h2>
          <p className="text-xs text-[#64748B]">
            Read-only compliance log. Sensitive credentials, tokens, and secrets are strictly redacted and never stored.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search actor, action, entity..."
            aria-label="Search audit logs"
            className="h-10 w-full rounded-lg border border-slate-200 bg-[#F5F8FC]/60 pl-9 pr-3 text-xs focus:border-[#2563EB] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as 'All' | AdminAuditLogEntry['entity_type']);
            setPage(1);
          }}
          aria-label="Filter audit logs by entity type"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
        >
          <option value="All">All Entity Types</option>
          <option value="staff">Staff</option>
          <option value="student">Student</option>
          <option value="category">Category</option>
          <option value="subject">Subject</option>
          <option value="branch">Branch</option>
          <option value="settings">Settings</option>
          <option value="role">Role</option>
          <option value="profile">Profile</option>
        </select>

        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value as 'All' | AdminAuditLogEntry['result']);
            setPage(1);
          }}
          aria-label="Filter audit logs by result"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
        >
          <option value="All">All Results</option>
          <option value="Success">Success</option>
          <option value="Blocked">Blocked</option>
          <option value="Failed">Failed</option>
        </select>
      </div>

      {paged.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-[#F5F8FC]/60 p-8 text-center">
          <FileClock className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-[#142B4A]">No matching audit entries</p>
          <p className="mt-1 text-xs text-[#64748B]">
            {logs.length === 0
              ? 'Audit events appear automatically as you provision staff, update students, modify taxonomy, or save library settings.'
              : 'Try clearing your search filter to inspect earlier recorded events.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[740px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-3 font-semibold">Timestamp</th>
                <th className="py-2.5 pr-3 font-semibold">Actor</th>
                <th className="py-2.5 pr-3 font-semibold">Action & Target</th>
                <th className="py-2.5 pr-3 font-semibold">Details</th>
                <th className="py-2.5 text-right font-semibold">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.items.map((entry) => (
                <tr key={entry.log_id} className="hover:bg-[#F5F8FC]/60">
                  <td className="font-mono-tabular whitespace-nowrap py-3 pr-3 text-[11px] text-[#64748B]">
                    {formatStaffDateTime(entry.timestamp)}
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-[#142B4A]">{entry.actor_name}</p>
                    <p className="text-[10px] uppercase text-[#64748B]">{entry.actor_role}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-[#1E293B]">{entry.action}</p>
                    <p className="text-[11px] text-[#2563EB]">
                      [{entry.entity_type}] {entry.entity_label}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-[#64748B]">{entry.details}</td>
                  <td className="py-3 text-right">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${
                        entry.result === 'Success'
                          ? 'bg-emerald-100 text-emerald-800'
                          : entry.result === 'Blocked'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {entry.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paged.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-[#64748B]">
          <span className="font-mono-tabular">
            Page {paged.currentPage} of {paged.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={paged.currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Prev
            </button>
            <button
              type="button"
              disabled={paged.currentPage >= paged.totalPages}
              onClick={() => setPage((p) => Math.min(paged.totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold cursor-pointer disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminProfileSectionProps {
  admin: AdminProfile;
  initialSection?: 'profile' | 'password';
  onUpdateProfile: (updates: {
    full_name: string;
    email: string;
    mobile_number: string;
    designation: string;
  }) => void;
  onChangePassword: (draft: ChangePasswordDraft) => Promise<{ ok: boolean; error?: string }> | void;
}

export function AdminProfileSection({
  admin,
  initialSection = 'profile',
  onUpdateProfile,
  onChangePassword,
}: AdminProfileSectionProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialSection);
  const [fullName, setFullName] = useState(admin.full_name);
  const [email, setEmail] = useState(admin.email);
  const [mobile, setMobile] = useState(admin.mobile_number);
  const [designation, setDesignation] = useState(admin.designation);
  const [profileSaved, setProfileSaved] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordDraft, setPasswordDraft] = useState<ChangePasswordDraft>({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordSaved, setPasswordSaved] = useState<string | null>(null);

  const strength = useMemo(
    () => evaluatePasswordStrength(passwordDraft.new_password),
    [passwordDraft.new_password]
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) {
      setProfileError('Enter a valid full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setProfileError('Enter a valid administrator email address.');
      return;
    }
    setProfileError(null);
    onUpdateProfile({
      full_name: fullName.trim(),
      email: email.trim(),
      mobile_number: mobile.trim(),
      designation: designation.trim(),
    });
    setProfileSaved('Administrator profile details updated successfully.');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateChangePassword(passwordDraft);
    if (!res.isValid) {
      setPasswordErrors(res.errors as Record<string, string>);
      setPasswordSaved(null);
      return;
    }
    setPasswordErrors({});
    setPasswordSaved(null);
    const result = await onChangePassword(passwordDraft);
    if (result && !result.ok) {
      setPasswordErrors({
        current_password: result.error ?? 'Failed to update administrator password.',
      });
      return;
    }
    setPasswordDraft({
      current_password: '',
      new_password: '',
      confirm_new_password: '',
    });
    setPasswordSaved('Administrator password updated and security audit event recorded.');
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-[#142B4A] text-white'
              : 'border border-slate-200 bg-white text-[#142B4A]'
          }`}
        >
          <User className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Profile Details</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer ${
            activeTab === 'password'
              ? 'bg-[#142B4A] text-white'
              : 'border border-slate-200 bg-white text-[#142B4A]'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Change Password</span>
        </button>
      </div>

      {activeTab === 'profile' ? (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 text-xs"
        >
          {profileSaved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{profileSaved}</span>
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 font-medium text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Staff ID (Read-Only)</label>
              <input
                type="text"
                readOnly
                value={admin.staff_code}
                className="font-mono-tabular h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-[#64748B]"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Mobile Number</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Designation</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#142B4A]">Role & Status</label>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 font-semibold text-[#142B4A]">
                <Lock className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span>System Administrator · {admin.account_status}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleSavePassword}
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4 text-xs max-w-xl"
        >
          {passwordSaved && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{passwordSaved}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-[#142B4A]">Current Password</label>
            <input
              type="password"
              value={passwordDraft.current_password}
              onChange={(e) =>
                setPasswordDraft((prev) => ({
                  ...prev,
                  current_password: e.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
            {passwordErrors.current_password && (
              <p className="mt-1 text-[11px] text-red-600">{passwordErrors.current_password}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#142B4A]">New Password</label>
            <input
              type="password"
              value={passwordDraft.new_password}
              onChange={(e) =>
                setPasswordDraft((prev) => ({ ...prev, new_password: e.target.value }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
            {passwordDraft.new_password && (
              <p className="mt-1 text-[11px] text-[#64748B]">
                Strength: <strong className="text-[#142B4A]">{strength.label}</strong>
              </p>
            )}
            {passwordErrors.new_password && (
              <p className="mt-1 text-[11px] text-red-600">{passwordErrors.new_password}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-[#142B4A]">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordDraft.confirm_new_password}
              onChange={(e) =>
                setPasswordDraft((prev) => ({
                  ...prev,
                  confirm_new_password: e.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3"
            />
            {passwordErrors.confirm_new_password && (
              <p className="mt-1 text-[11px] text-red-600">
                {passwordErrors.confirm_new_password}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Update Password</span>
          </button>
        </form>
      )}
    </div>
  );
}

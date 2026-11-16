import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  KeyRound,
  Mail,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import {
  canDeactivateOrDemoteStaffMember,
  canDeleteStudentAccount,
  filterAndPaginateAdminStudents,
  filterAndPaginateStaff,
  validateCreateStaffInput,
  type CreateStaffInput,
  type EditStaffInput,
  type LibraryBranchRecord,
  type StaffAccountRecord,
  type StaffAccountStatus,
  type StaffRole,
  type StaffSortKey,
} from '../../utils/adminManagement';
import type { ActiveBorrowingDetail } from '../../utils/librarianCirculation';
import type { LibrarianReservationItem } from '../../utils/librarianReservations';
import type { LibrarianStudentDirectoryItem } from '../../utils/librarianStudents';

const PAGE_SIZE = 6;

interface AdminStaffManagementSectionProps {
  staff: StaffAccountRecord[];
  branches: LibraryBranchRecord[];
  currentAdminStaffId: number;
  initialSearchQuery?: string;
  initialOpenCreateModal?: boolean;
  onConsumeOpenCreateModal?: () => void;
  onCreateStaff: (input: CreateStaffInput) => { ok: boolean; error?: string };
  onEditStaff: (staffId: number, updates: EditStaffInput) => { ok: boolean; error?: string };
  onChangeStaffStatus: (
    staffId: number,
    nextStatus: StaffAccountStatus
  ) => { ok: boolean; error?: string };
  onResetStaffAccess: (staffId: number) => void;
}

export function AdminStaffManagementSection({
  staff,
  branches,
  currentAdminStaffId,
  initialSearchQuery = '',
  initialOpenCreateModal = false,
  onConsumeOpenCreateModal,
  onCreateStaff,
  onEditStaff,
  onChangeStaffStatus,
  onResetStaffAccess,
}: AdminStaffManagementSectionProps) {
  const [query, setQuery] = useState(initialSearchQuery);
  const [roleFilter, setRoleFilter] = useState<'All' | StaffRole>('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | StaffAccountStatus>('All');
  const [sortBy, setSortBy] = useState<StaffSortKey>('created_desc');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(initialOpenCreateModal);
  const [viewingStaff, setViewingStaff] = useState<StaffAccountRecord | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffAccountRecord | null>(null);
  const [confirmStatusTarget, setConfirmStatusTarget] = useState<{
    member: StaffAccountRecord;
    nextStatus: StaffAccountStatus;
  } | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const defaultBranch = branches[0]?.name ?? 'Main Central Library';
  const [createForm, setCreateForm] = useState<CreateStaffInput>({
    full_name: '',
    staff_code: '',
    email: '',
    mobile_number: '',
    designation: 'Assistant Librarian',
    branch: defaultBranch,
    role: 'librarian',
    onboarding_mode: 'invitation',
    temporary_password: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [editForm, setEditForm] = useState<EditStaffInput>({
    full_name: '',
    email: '',
    mobile_number: '',
    designation: '',
    branch: defaultBranch,
    role: 'librarian',
  });
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOpenCreateModal) {
      setCreateOpen(true);
      onConsumeOpenCreateModal?.();
    }
  }, [initialOpenCreateModal, onConsumeOpenCreateModal]);

  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const branchNames = useMemo(
    () => Array.from(new Set(branches.map((b) => b.name))).sort(),
    [branches]
  );

  const paged = useMemo(
    () =>
      filterAndPaginateStaff(
        staff,
        {
          query,
          role: roleFilter,
          branch: branchFilter,
          status: statusFilter,
          sort: sortBy,
        },
        page,
        PAGE_SIZE
      ),
    [staff, query, roleFilter, branchFilter, statusFilter, sortBy, page]
  );

  const openCreateModal = () => {
    const nextNum = 120 + staff.length + 1;
    setCreateForm({
      full_name: '',
      staff_code: `LIB-${nextNum}`,
      email: '',
      mobile_number: '',
      designation: 'Assistant Librarian',
      branch: defaultBranch,
      role: 'librarian',
      onboarding_mode: 'invitation',
      temporary_password: '',
    });
    setCreateErrors({});
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCreateStaffInput(createForm, staff);
    if (!validation.valid) {
      const flatErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(validation.errors)) {
        if (v) flatErrors[k] = v;
      }
      setCreateErrors(flatErrors);
      return;
    }

    const result = onCreateStaff({
      ...createForm,
      temporary_password:
        createForm.onboarding_mode === 'temporary_password'
          ? createForm.temporary_password
          : undefined,
    });
    if (!result.ok) {
      setCreateErrors({ general: result.error ?? 'Unable to create staff account.' });
      return;
    }

    setCreateOpen(false);
    setFeedback({
      type: 'success',
      message:
        createForm.onboarding_mode === 'invitation'
          ? `Provisioned ${createForm.full_name.trim()} (${createForm.staff_code.toUpperCase()}) and queued account activation invitation.`
          : `Created ${createForm.full_name.trim()} (${createForm.staff_code.toUpperCase()}) with forced password rotation on first login.`,
    });
  };

  const openEditModal = (member: StaffAccountRecord) => {
    setEditingStaff(member);
    setEditForm({
      full_name: member.full_name,
      email: member.email,
      mobile_number: member.mobile_number,
      designation: member.designation,
      branch: member.branch,
      role: member.role,
    });
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    if (editForm.full_name.trim().length < 3) {
      setEditError('Full name must be at least 3 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(editForm.email.trim())) {
      setEditError('Enter a valid official email address.');
      return;
    }

    if (editForm.role !== editingStaff.role) {
      const check = canDeactivateOrDemoteStaffMember({
        targetStaff: editingStaff,
        currentAdminStaffId,
        allStaff: staff,
        nextRole: editForm.role,
      });
      if (!check.allowed) {
        setEditError(check.reason);
        return;
      }
    }

    const res = onEditStaff(editingStaff.staff_id, editForm);
    if (!res.ok) {
      setEditError(res.error ?? 'Unable to save staff updates.');
      return;
    }

    setFeedback({
      type: 'success',
      message: `Updated staff profile for ${editForm.full_name.trim()}.`,
    });
    setEditingStaff(null);
  };

  const handleConfirmStatusChange = () => {
    if (!confirmStatusTarget) return;
    const { member, nextStatus } = confirmStatusTarget;
    const guard = canDeactivateOrDemoteStaffMember({
      targetStaff: member,
      currentAdminStaffId,
      allStaff: staff,
      nextStatus,
    });
    if (!guard.allowed) {
      setFeedback({ type: 'error', message: guard.reason ?? 'Action blocked.' });
      setConfirmStatusTarget(null);
      return;
    }
    const res = onChangeStaffStatus(member.staff_id, nextStatus);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Unable to update staff status.' });
    } else {
      setFeedback({
        type: 'success',
        message: `${member.full_name} account status updated to ${nextStatus}.`,
      });
    }
    setConfirmStatusTarget(null);
  };

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="text-current/70 hover:text-current cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Staff & Librarian Accounts ({paged.totalCount})
            </h2>
            <p className="text-xs text-[#64748B]">
              Only administrators can provision Librarian accounts, modify staff roles, or revoke access.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1d4ed8] cursor-pointer"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>Create Librarian Account</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
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
              placeholder="Search name, Staff ID, email..."
              aria-label="Search staff accounts"
              className="h-10 w-full rounded-lg border border-slate-200 bg-[#F5F8FC]/60 pl-9 pr-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as 'All' | StaffRole);
              setPage(1);
            }}
            aria-label="Filter staff by role"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="All">All Roles</option>
            <option value="librarian">Librarian</option>
            <option value="admin">Administrator</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter staff by branch"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
          >
            <option value="All">All Branches</option>
            {branchNames.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'All' | StaffAccountStatus);
                setPage(1);
              }}
              aria-label="Filter staff by status"
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as StaffSortKey)}
              aria-label="Sort staff accounts"
              className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="created_desc">Newest First</option>
              <option value="name_asc">Name (A–Z)</option>
              <option value="name_desc">Name (Z–A)</option>
              <option value="role_asc">By Role</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-3 font-semibold">Staff Member</th>
                <th className="py-2.5 pr-3 font-semibold">Staff ID</th>
                <th className="py-2.5 pr-3 font-semibold">Role & Designation</th>
                <th className="py-2.5 pr-3 font-semibold">Branch</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                    No staff accounts match the active filter criteria.
                  </td>
                </tr>
              ) : (
                paged.items.map((member) => {
                  const statusGuard = canDeactivateOrDemoteStaffMember({
                    targetStaff: member,
                    currentAdminStaffId,
                    allStaff: staff,
                    nextStatus: member.status === 'Active' ? 'Inactive' : 'Active',
                  });

                  return (
                    <tr key={member.staff_id} className="hover:bg-[#F5F8FC]/60">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#142B4A]">{member.full_name}</p>
                        <p className="text-[11px] text-[#64748B]">{member.email}</p>
                      </td>
                      <td className="font-mono-tabular py-3 pr-3 font-semibold text-[#142B4A]">
                        {member.staff_code}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            member.role === 'admin'
                              ? 'bg-[#142B4A] text-white'
                              : 'bg-[#DBEAFE] text-[#142B4A]'
                          }`}
                        >
                          {member.role === 'admin' && (
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          )}
                          {member.role}
                        </span>
                        <p className="mt-1 text-[11px] text-[#64748B]">
                          {member.designation}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-[#1E293B]">{member.branch}</td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                            member.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : member.status === 'Suspended'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {member.status}
                        </span>
                        {member.invitation_pending && (
                          <p className="mt-0.5 text-[10px] font-medium text-[#2563EB]">
                            Invite pending
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingStaff(member)}
                            aria-label={`View ${member.full_name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#142B4A] hover:bg-[#F5F8FC] cursor-pointer"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            aria-label={`Edit ${member.full_name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]/40 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onResetStaffAccess(member.staff_id);
                              setFeedback({
                                type: 'success',
                                message: `Access reset / activation link queued for ${member.email}.`,
                              });
                            }}
                            aria-label={`Reset access for ${member.full_name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#1E293B] hover:bg-[#F5F8FC] cursor-pointer"
                          >
                            <KeyRound className="h-3 w-3" aria-hidden="true" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            disabled={!statusGuard.allowed}
                            title={statusGuard.reason ?? undefined}
                            onClick={() =>
                              setConfirmStatusTarget({
                                member,
                                nextStatus: member.status === 'Active' ? 'Inactive' : 'Active',
                              })
                            }
                            aria-label={`${
                              member.status === 'Active' ? 'Deactivate' : 'Activate'
                            } ${member.full_name}`}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${
                              !statusGuard.allowed
                                ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                : member.status === 'Active'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                            }`}
                          >
                            {member.status === 'Active' ? (
                              <>
                                <UserX className="h-3 w-3" aria-hidden="true" />
                                <span>Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                <span>Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Prev
              </button>
              <button
                type="button"
                disabled={paged.currentPage >= paged.totalPages}
                onClick={() => setPage((p) => Math.min(paged.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Librarian Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-staff-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3
                  id="create-staff-modal-title"
                  className="font-display text-lg font-bold text-[#142B4A]"
                >
                  Create Staff / Librarian Account
                </h3>
                <p className="text-xs text-[#64748B]">
                  Staff accounts are provisioned securely by administrators only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {createErrors.general && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {createErrors.general}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="staff-create-name"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Full Name
                  </label>
                  <input
                    id="staff-create-name"
                    type="text"
                    value={createForm.full_name}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    placeholder="e.g., Neha Verma"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {createErrors.full_name && (
                    <p className="mt-1 text-[11px] text-red-600">{createErrors.full_name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="staff-create-code"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Staff ID
                  </label>
                  <input
                    id="staff-create-code"
                    type="text"
                    value={createForm.staff_code}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, staff_code: e.target.value }))
                    }
                    placeholder="LIB-125"
                    className="font-mono-tabular h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {createErrors.staff_code && (
                    <p className="mt-1 text-[11px] text-red-600">{createErrors.staff_code}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="staff-create-email"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Official Email
                  </label>
                  <input
                    id="staff-create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="name@smartlibrary.edu"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {createErrors.email && (
                    <p className="mt-1 text-[11px] text-red-600">{createErrors.email}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="staff-create-mobile"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Contact Phone
                  </label>
                  <input
                    id="staff-create-mobile"
                    type="text"
                    value={createForm.mobile_number}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, mobile_number: e.target.value }))
                    }
                    placeholder="+1 (555) 204-8899"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {createErrors.mobile_number && (
                    <p className="mt-1 text-[11px] text-red-600">{createErrors.mobile_number}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="staff-create-designation"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Designation
                  </label>
                  <input
                    id="staff-create-designation"
                    type="text"
                    value={createForm.designation}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, designation: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  />
                  {createErrors.designation && (
                    <p className="mt-1 text-[11px] text-red-600">{createErrors.designation}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="staff-create-branch"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Branch
                  </label>
                  <select
                    id="staff-create-branch"
                    value={createForm.branch}
                    onChange={(e) =>
                      setCreateForm((prev) => ({ ...prev, branch: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    {branchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="staff-create-role"
                    className="mb-1 block text-xs font-semibold text-[#142B4A]"
                  >
                    Assigned Role
                  </label>
                  <select
                    id="staff-create-role"
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        role: e.target.value as StaffRole,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                  >
                    <option value="librarian">Librarian</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-3.5">
                <p className="text-xs font-bold text-[#142B4A]">Credential Provisioning Mode</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <input
                      type="radio"
                      name="onboarding_mode"
                      checked={createForm.onboarding_mode === 'invitation'}
                      onChange={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          onboarding_mode: 'invitation',
                          temporary_password: '',
                        }))
                      }
                    />
                    <span className="font-semibold text-[#142B4A]">
                      Send Setup Invitation (Recommended)
                    </span>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                    <input
                      type="radio"
                      name="onboarding_mode"
                      checked={createForm.onboarding_mode === 'temporary_password'}
                      onChange={() =>
                        setCreateForm((prev) => ({
                          ...prev,
                          onboarding_mode: 'temporary_password',
                        }))
                      }
                    />
                    <span className="font-semibold text-[#142B4A]">
                      Assign Temporary Password
                    </span>
                  </label>
                </div>

                {createForm.onboarding_mode === 'temporary_password' && (
                  <div className="mt-3">
                    <label
                      htmlFor="staff-create-temp-password"
                      className="mb-1 block text-xs font-semibold text-[#142B4A]"
                    >
                      Temporary Password (hashed on save, forced reset at first login)
                    </label>
                    <input
                      id="staff-create-temp-password"
                      type="password"
                      value={createForm.temporary_password ?? ''}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          temporary_password: e.target.value,
                        }))
                      }
                      placeholder="Minimum 10 chars with upper, lower & digit"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                    />
                    {createErrors.temporary_password && (
                      <p className="mt-1 text-[11px] text-red-600">
                        {createErrors.temporary_password}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-[#1E293B] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Staff Modal */}
      {viewingStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-staff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="view-staff-title" className="font-display text-base font-bold text-[#142B4A]">
                Staff Account Details
              </h3>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                aria-label="Close staff details"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Full Name</dt>
                <dd className="font-semibold text-[#142B4A]">{viewingStaff.full_name}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Staff ID</dt>
                <dd className="font-mono-tabular font-semibold text-[#142B4A]">
                  {viewingStaff.staff_code}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Email</dt>
                <dd className="text-[#1E293B]">{viewingStaff.email}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Phone</dt>
                <dd className="text-[#1E293B]">{viewingStaff.mobile_number || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Role</dt>
                <dd className="capitalize font-semibold text-[#2563EB]">{viewingStaff.role}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Designation</dt>
                <dd className="text-[#1E293B]">{viewingStaff.designation}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Branch</dt>
                <dd className="text-[#1E293B]">{viewingStaff.branch}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[#64748B]">Status</dt>
                <dd className="font-semibold text-[#142B4A]">{viewingStaff.status}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3a61] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="edit-staff-title" className="font-display text-base font-bold text-[#142B4A]">
                Edit Staff ({editingStaff.staff_code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                aria-label="Close edit dialog"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              {editError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {editError}
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#142B4A]">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#142B4A]">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#142B4A]">
                  Designation
                </label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, designation: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#142B4A]">Branch</label>
                  <select
                    value={editForm.branch}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, branch: e.target.value }))}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    {branchNames.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#142B4A]">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, role: e.target.value as StaffRole }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                  >
                    <option value="librarian">Librarian</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-[#1E293B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {confirmStatusTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-staff-status-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="confirm-staff-status-title"
              className="font-display text-base font-bold text-[#142B4A]"
            >
              Confirm Staff Status Update
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
              Are you sure you want to set{' '}
              <strong className="text-[#142B4A]">
                {confirmStatusTarget.member.full_name}
              </strong>{' '}
              ({confirmStatusTarget.member.staff_code}) to{' '}
              <strong className="text-[#142B4A]">{confirmStatusTarget.nextStatus}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmStatusTarget(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                className="rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3a61] cursor-pointer"
              >
                Confirm {confirmStatusTarget.nextStatus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AdminUserManagementSectionProps {
  students: LibrarianStudentDirectoryItem[];
  activeBorrowings: ActiveBorrowingDetail[];
  reservations: LibrarianReservationItem[];
  initialSearchQuery?: string;
  onEditStudent: (
    studentId: number,
    updates: {
      full_name: string;
      email: string;
      mobile: string | null;
      department: string;
      program: string;
      academic_year: string;
      max_borrowing_limit: number;
    }
  ) => { ok: boolean; error?: string };
  onChangeStudentStatus: (
    studentId: number,
    nextStatus: 'Active' | 'Blocked' | 'Suspended',
    reason: string | null
  ) => void;
  onDeleteStudent: (studentId: number) => { ok: boolean; error?: string };
}

export function AdminUserManagementSection({
  students,
  activeBorrowings,
  reservations,
  initialSearchQuery = '',
  onEditStudent,
  onChangeStudentStatus,
  onDeleteStudent,
}: AdminUserManagementSectionProps) {
  const [query, setQuery] = useState(initialSearchQuery);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Blocked' | 'Suspended'>(
    'All'
  );
  const [page, setPage] = useState(1);

  const [viewingStudent, setViewingStudent] = useState<LibrarianStudentDirectoryItem | null>(
    null
  );
  const [editingStudent, setEditingStudent] = useState<LibrarianStudentDirectoryItem | null>(
    null
  );
  const [confirmStudentStatus, setConfirmStudentStatus] = useState<{
    student: LibrarianStudentDirectoryItem;
    nextStatus: 'Active' | 'Blocked' | 'Suspended';
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    mobile: '',
    department: '',
    program: '',
    academic_year: '',
    max_borrowing_limit: 5,
  });

  useEffect(() => {
    if (initialSearchQuery) {
      setQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  const departments = useMemo(
    () => Array.from(new Set(students.map((s) => s.department))).sort(),
    [students]
  );
  const courses = useMemo(
    () => Array.from(new Set(students.map((s) => s.program))).sort(),
    [students]
  );
  const years = useMemo(
    () => Array.from(new Set(students.map((s) => s.academic_year))).sort(),
    [students]
  );

  const paged = useMemo(
    () =>
      filterAndPaginateAdminStudents(
        students,
        {
          query,
          department: departmentFilter,
          course: courseFilter,
          academicYear: yearFilter,
          status: statusFilter,
        },
        page,
        PAGE_SIZE
      ),
    [students, query, departmentFilter, courseFilter, yearFilter, statusFilter, page]
  );

  const openEdit = (student: LibrarianStudentDirectoryItem) => {
    setEditingStudent(student);
    setEditForm({
      full_name: student.full_name,
      email: student.email,
      mobile: student.mobile ?? '',
      department: student.department,
      program: student.program,
      academic_year: student.academic_year,
      max_borrowing_limit: student.max_borrowing_limit,
    });
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const res = onEditStudent(editingStudent.student_id, {
      ...editForm,
      mobile: editForm.mobile.trim() ? editForm.mobile.trim() : null,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Failed to update student.' });
      return;
    }
    setFeedback({
      type: 'success',
      message: `Updated student details for ${editForm.full_name.trim()}.`,
    });
    setEditingStudent(null);
  };

  const handleDeleteAttempt = (student: LibrarianStudentDirectoryItem) => {
    const guard = canDeleteStudentAccount(student);
    if (!guard.allowed) {
      setFeedback({
        type: 'error',
        message: guard.reason ?? 'Permanent deletion blocked to protect borrowing audit records.',
      });
      return;
    }
    const res = onDeleteStudent(student.student_id);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error ?? 'Could not remove student.' });
    } else {
      setFeedback({
        type: 'success',
        message: `Removed student account ${student.full_name} (${student.student_code}) with zero historical circulation records.`,
      });
    }
  };

  const viewingStudentLoans = useMemo(() => {
    if (!viewingStudent) return [];
    return activeBorrowings.filter(
      (b) => b.student_id === viewingStudent.student_id && b.status !== 'Returned'
    );
  }, [viewingStudent, activeBorrowings]);

  const viewingStudentReservations = useMemo(() => {
    if (!viewingStudent) return [];
    return reservations.filter((r) => r.student_id === viewingStudent.student_id);
  }, [viewingStudent, reservations]);

  return (
    <div className="space-y-5">
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss message"
            className="text-current/70 hover:text-current cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Student Accounts ({paged.totalCount})
            </h2>
            <p className="text-xs text-[#64748B]">
              Inspect student records, borrowing history, active holds, and safely activate or deactivate accounts.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
              placeholder="Name, ID, roll no, email..."
              aria-label="Search student accounts"
              className="h-10 w-full rounded-lg border border-slate-200 bg-[#F5F8FC]/60 pl-9 pr-3 text-xs text-[#1E293B] focus:border-[#2563EB] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={departmentFilter}
            onChange={(e) => {
              setDepartmentFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter students by department"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
          >
            <option value="All">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter students by course"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
          >
            <option value="All">All Programs</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter students by academic year"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
          >
            <option value="All">All Academic Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(
                e.target.value as 'All' | 'Active' | 'Blocked' | 'Suspended'
              );
              setPage(1);
            }}
            aria-label="Filter students by status"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#1E293B]"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Blocked">Blocked</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[#64748B]">
                <th className="py-2.5 pr-3 font-semibold">Student</th>
                <th className="py-2.5 pr-3 font-semibold">Student ID</th>
                <th className="py-2.5 pr-3 font-semibold">Department & Program</th>
                <th className="py-2.5 pr-3 font-semibold">Loans / Holds</th>
                <th className="py-2.5 pr-3 font-semibold">Status</th>
                <th className="py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                    No students match the selected filters.
                  </td>
                </tr>
              ) : (
                paged.items.map((student) => {
                  const deleteCheck = canDeleteStudentAccount(student);
                  return (
                    <tr key={student.student_id} className="hover:bg-[#F5F8FC]/60">
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#142B4A]">{student.full_name}</p>
                        <p className="text-[11px] text-[#64748B]">{student.email}</p>
                      </td>
                      <td className="font-mono-tabular py-3 pr-3">
                        <p className="font-semibold text-[#142B4A]">{student.student_code}</p>
                        <p className="text-[11px] text-[#64748B]">{student.roll_number}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-[#1E293B]">{student.department}</p>
                        <p className="text-[11px] text-[#64748B]">
                          {student.program} · {student.academic_year}
                        </p>
                      </td>
                      <td className="font-mono-tabular py-3 pr-3">
                        <p className="text-[#142B4A]">
                          Active: <strong>{student.active_loans_count}</strong> /{' '}
                          {student.max_borrowing_limit}
                        </p>
                        <p className="text-[11px] text-[#64748B]">
                          Total borrowed: {student.total_books_borrowed} · Holds:{' '}
                          {student.active_reservations_count}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                            student.account_status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : student.account_status === 'Blocked'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {student.account_status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingStudent(student)}
                            aria-label={`Inspect ${student.full_name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#142B4A] hover:bg-[#F5F8FC] cursor-pointer"
                          >
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(student)}
                            aria-label={`Edit ${student.full_name}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#2563EB] hover:bg-[#DBEAFE]/40 cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatusReason(student.restriction_reason ?? '');
                              setConfirmStudentStatus({
                                student,
                                nextStatus:
                                  student.account_status === 'Active' ? 'Suspended' : 'Active',
                              });
                            }}
                            aria-label={`${
                              student.account_status === 'Active' ? 'Deactivate' : 'Activate'
                            } ${student.full_name}`}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                              student.account_status === 'Active'
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {student.account_status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttempt(student)}
                            title={deleteCheck.reason ?? 'Delete student account'}
                            aria-label={`Delete ${student.full_name}`}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold ${
                              deleteCheck.allowed
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer'
                                : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 cursor-pointer'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

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
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Prev
              </button>
              <button
                type="button"
                disabled={paged.currentPage >= paged.totalPages}
                onClick={() => setPage((p) => Math.min(paged.totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-semibold text-[#142B4A] disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Student Details Modal */}
      {viewingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-student-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3
                  id="view-student-modal-title"
                  className="font-display text-base font-bold text-[#142B4A]"
                >
                  {viewingStudent.full_name}
                </h3>
                <p className="font-mono-tabular text-xs text-[#64748B]">
                  {viewingStudent.student_code} · {viewingStudent.department}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                aria-label="Close student modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
                <div>
                  <p className="text-[#64748B]">Program & Semester</p>
                  <p className="font-semibold text-[#142B4A]">{viewingStudent.program}</p>
                </div>
                <div>
                  <p className="text-[#64748B]">Account Standing</p>
                  <p className="font-semibold text-[#142B4A]">
                    {viewingStudent.account_status}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Total Books Borrowed</p>
                  <p className="font-mono-tabular font-bold text-[#142B4A]">
                    {viewingStudent.total_books_borrowed} ({viewingStudent.completed_loans_count}{' '}
                    completed)
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B]">Email</p>
                  <p className="flex items-center gap-1 font-medium text-[#1E293B]">
                    <Mail className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                    <span className="truncate">{viewingStudent.email}</span>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#142B4A]">
                  Active Borrowings ({viewingStudentLoans.length})
                </h4>
                {viewingStudentLoans.length === 0 ? (
                  <p className="mt-1 text-[#64748B]">No active checkouts right now.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {viewingStudentLoans.map((loan) => (
                      <li
                        key={loan.borrowing_id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" aria-hidden="true" />
                          <span className="truncate font-semibold text-[#142B4A]">
                            {loan.book_title}
                          </span>
                        </div>
                        <span className="font-mono-tabular shrink-0 text-[11px] text-[#64748B]">
                          Due {loan.due_date}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-[#142B4A]">
                  Reservations ({viewingStudentReservations.length})
                </h4>
                {viewingStudentReservations.length === 0 ? (
                  <p className="mt-1 text-[#64748B]">No active or recent holds.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {viewingStudentReservations.map((res) => (
                      <li
                        key={res.reservation_id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <span className="truncate font-medium text-[#142B4A]">
                          {res.book_title}
                        </span>
                        <span className="rounded bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-semibold text-[#142B4A]">
                          {res.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                className="rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-student-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3
                id="edit-student-modal-title"
                className="font-display text-base font-bold text-[#142B4A]"
              >
                Edit Student ({editingStudent.student_code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                aria-label="Close edit student dialog"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#142B4A]">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, department: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">Program</label>
                  <input
                    type="text"
                    value={editForm.program}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, program: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">Academic Year</label>
                  <input
                    type="text"
                    value={editForm.academic_year}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, academic_year: e.target.value }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#142B4A]">
                    Max Borrowing Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editForm.max_borrowing_limit}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        max_borrowing_limit: Number(e.target.value) || 1,
                      }))
                    }
                    className="font-mono-tabular h-9 w-full rounded-lg border border-slate-200 px-3 focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold text-[#1E293B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-4 py-2 font-semibold text-white hover:bg-[#1d4ed8] cursor-pointer"
                >
                  Save Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Student Activate / Deactivate */}
      {confirmStudentStatus && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-student-status-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#142B4A]/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3
              id="confirm-student-status-title"
              className="font-display text-base font-bold text-[#142B4A]"
            >
              Confirm Student Account {confirmStudentStatus.nextStatus === 'Active' ? 'Activation' : 'Deactivation'}
            </h3>
            <p className="mt-2 text-xs text-[#64748B]">
              Set <strong className="text-[#142B4A]">{confirmStudentStatus.student.full_name}</strong>{' '}
              ({confirmStudentStatus.student.student_code}) to{' '}
              <strong className="text-[#142B4A]">{confirmStudentStatus.nextStatus}</strong>.
            </p>
            {confirmStudentStatus.nextStatus !== 'Active' && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-[#142B4A]">
                  Reason / Audit Note
                </label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g., Administrative hold requested"
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmStudentStatus(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-[#1E293B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onChangeStudentStatus(
                    confirmStudentStatus.student.student_id,
                    confirmStudentStatus.nextStatus,
                    confirmStudentStatus.nextStatus === 'Active'
                      ? null
                      : statusReason.trim() || 'Administrative status update'
                  );
                  setFeedback({
                    type: 'success',
                    message: `${confirmStudentStatus.student.full_name} status updated to ${confirmStudentStatus.nextStatus}.`,
                  });
                  setConfirmStudentStatus(null);
                }}
                className="rounded-lg bg-[#142B4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1e3a61] cursor-pointer"
              >
                Confirm {confirmStudentStatus.nextStatus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

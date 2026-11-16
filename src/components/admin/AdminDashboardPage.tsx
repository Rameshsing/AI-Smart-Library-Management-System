import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AdminManagementSection, AppRoute } from '../../data/libraryData';
import {
  computeAdminDashboardMetrics,
  deriveAdminSystemAlerts,
  deriveLibrarianCompatPermissions,
  verifyAdminSessionRole,
  type AdminSectionRoute,
  type AdminSessionCheckResponse,
} from '../../utils/adminDashboard';
import {
  canDeactivateOrDemoteStaffMember,
  canDeleteStudentAccount,
  canDeleteTaxonomyRecord,
  canUpdateRolePermission,
  computeBranchInventoryCounts,
  computeCategoryBookCounts,
  computeSubjectBookCounts,
  createAuditLogEntry,
  createInitialAdminWorkspaceStore,
  type AdminWorkspaceStore,
  type CreateStaffInput,
  type EditStaffInput,
  type LibraryPolicySettings,
  type PermissionKey,
  type StaffAccountStatus,
} from '../../utils/adminManagement';
import { getApiBaseUrl, isBackendConnected } from '../../utils/apiConfig';
import type { ChangePasswordDraft } from '../../utils/studentProfilePage';
import { AddBookPage } from '../librarian/AddBookPage';
import { LibrarianInventoryPage } from '../librarian/LibrarianInventoryPage';
import { ReportsAnalyticsPage } from '../librarian/ReportsAnalyticsPage';
import { AdminManagementPage } from './AdminManagementPage';
import { AdminOverviewView } from './AdminOverviewView';
import {
  AdminAuditLogsSection,
  AdminProfileSection,
} from './AdminRolesAuditProfileSections';
import { AdminShell } from './AdminShell';

const ADMIN_STORE_STORAGE_KEY = 'ai_smart_library_admin_workspace_v1';

interface AdminDashboardPageProps {
  activeRoute: AdminSectionRoute;
  routeState?: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

function loadInitialAdminStore(referenceDate: Date): AdminWorkspaceStore {
  try {
    const raw = window.sessionStorage.getItem(ADMIN_STORE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminWorkspaceStore;
      if (parsed && parsed.adminProfile && Array.isArray(parsed.staff)) {
        return parsed;
      }
    }
  } catch {
    // Ignore invalid sessionStorage data
  }
  return createInitialAdminWorkspaceStore(referenceDate);
}

export function AdminDashboardPage({
  activeRoute,
  routeState,
  onNavigate,
}: AdminDashboardPageProps) {
  const [referenceDate] = useState<Date>(() => new Date());
  const [store, setStore] = useState<AdminWorkspaceStore>(() =>
    loadInitialAdminStore(referenceDate)
  );
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [unauthorizedMessage, setUnauthorizedMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [openCreateStaffRequested, setOpenCreateStaffRequested] = useState(false);

  const apiBaseUrl = getApiBaseUrl();
  const hasBackendApi = isBackendConnected();

  const unsavedLeaveGuardRef = useRef<((targetRoute: AppRoute) => boolean) | null>(null);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  // Persist workspace mutations locally only when running in offline/preview mode
  useEffect(() => {
    if (hasBackendApi) return;
    try {
      window.sessionStorage.setItem(ADMIN_STORE_STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota / privacy mode restrictions
    }
  }, [hasBackendApi, store]);

  const refreshAdminWorkspace = useCallback(
    async (signal?: AbortSignal) => {
      if (!hasBackendApi) return;
      const wsRes = await fetch(
        `${apiBaseUrl.replace(/\/+$/, '')}/api/admin/workspace`,
        {
          method: 'GET',
          credentials: 'include',
          signal,
          headers: { Accept: 'application/json' },
        }
      );
      if (wsRes.ok) {
        const wsData = (await wsRes.json()) as Partial<AdminWorkspaceStore>;
        setStore((prev) => ({
          ...prev,
          ...wsData,
          reportsDataset: wsData.reportsDataset ?? prev.reportsDataset,
        }));
      }
    },
    [apiBaseUrl, hasBackendApi]
  );

  // Server-verified Admin session check & live workspace hydration
  useEffect(() => {
    const controller = new AbortController();

    if (!hasBackendApi) {
      setUnauthorizedMessage(null);
      setIsCheckingSession(false);
      return;
    }

    const verify = async () => {
      try {
        setIsCheckingSession(true);
        const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (res.status === 401 || res.status === 403) {
          setUnauthorizedMessage('Administrator authentication required.');
          onNavigateRef.current({ name: 'admin-login' });
          return;
        }

        const payload = (await res.json()) as AdminSessionCheckResponse;
        const guard = verifyAdminSessionRole(payload);
        if (!guard.authorized) {
          setUnauthorizedMessage(guard.reason ?? 'Administrator privileges required.');
          if (guard.redirectRoute) {
            onNavigateRef.current(guard.redirectRoute);
          }
          return;
        }

        if (payload.admin) {
          setStore((prev) => ({ ...prev, adminProfile: payload.admin! }));
        }
        await refreshAdminWorkspace(controller.signal);
        setUnauthorizedMessage(null);
      } catch {
        if (!controller.signal.aborted) {
          setUnauthorizedMessage(
            'Unable to verify administrator session with the server. Sign in again.'
          );
          onNavigateRef.current({ name: 'admin-login' });
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCheckingSession(false);
        }
      }
    };

    void verify();
    return () => controller.abort();
  }, [apiBaseUrl, hasBackendApi, refreshAdminWorkspace]);

  const handleGuardedNavigate = useCallback(
    (targetRoute: AppRoute) => {
      if (unsavedLeaveGuardRef.current && !unsavedLeaveGuardRef.current(targetRoute)) {
        return;
      }
      onNavigate(targetRoute);
    },
    [onNavigate]
  );

  const handleLogout = async () => {
    if (hasBackendApi) {
      try {
        await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Proceed cleanly to login redirect
      }
    }
    onNavigate({ name: 'admin-login' });
  };

  const syncAdminMutation = useCallback(
    async (path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => {
      if (!hasBackendApi) return;
      setSyncError(null);
      try {
        const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const errJson = (await res.json().catch(() => null)) as {
            message?: string;
            error?: string;
          } | null;
          setSyncError(
            errJson?.message ?? errJson?.error ?? `Administrator action failed (${res.status}).`
          );
        }
        await refreshAdminWorkspace();
      } catch (err) {
        setSyncError(
          err instanceof Error ? err.message : 'Unable to sync change to server.'
        );
      }
    },
    [apiBaseUrl, hasBackendApi, refreshAdminWorkspace]
  );

  const alerts = useMemo(
    () =>
      deriveAdminSystemAlerts({
        books: store.books,
        copies: store.copies,
        overdueRecords: store.overdueRecords,
        reservations: store.reservations,
        students: store.students,
        staff: store.staff,
        categories: store.categories,
      }),
    [store]
  );

  const metrics = useMemo(
    () =>
      computeAdminDashboardMetrics({
        students: store.students,
        staff: store.staff,
        books: store.books,
        copies: store.copies,
        categories: store.categories,
        subjects: store.subjects,
        branches: store.branches,
        activeBorrowings: store.activeBorrowings,
        returnedHistoryCount: store.returnedHistoryCount,
        overdueRecords: store.overdueRecords,
        reservations: store.reservations,
        announcements: store.announcements,
        alertsCount: alerts.length,
        auditEventsCount: store.auditLogs.length,
      }),
    [store, alerts.length]
  );

  const actor = useMemo(
    () => ({
      id: store.adminProfile.admin_id,
      name: store.adminProfile.full_name,
      role: 'admin' as const,
    }),
    [store.adminProfile]
  );

  const handleQuickSearch = (query: string, target: 'users' | 'staff' | 'inventory') => {
    setQuickSearchQuery(query);
    if (target === 'inventory') {
      handleGuardedNavigate({ name: 'admin-inventory' });
    } else {
      handleGuardedNavigate({ name: 'admin-management', section: target });
    }
  };

  // Staff mutations + audit logging
  const handleCreateStaff = (input: CreateStaffInput): { ok: boolean; error?: string } => {
    const nextId =
      store.staff.reduce((max, s) => Math.max(max, s.staff_id), 200) + 1;
    const nowIso = new Date().toISOString();
    const cleanCode = input.staff_code.trim().toUpperCase();
    const newRecord = {
      staff_id: nextId,
      staff_code: cleanCode,
      full_name: input.full_name.trim(),
      email: input.email.trim().toLowerCase(),
      mobile_number: input.mobile_number.trim(),
      designation: input.designation.trim(),
      branch: input.branch.trim(),
      role: input.role,
      status: 'Active' as const,
      joining_date: nowIso.slice(0, 10),
      created_at: nowIso,
      invitation_pending: input.onboarding_mode === 'invitation',
      invitation_sent_at: input.onboarding_mode === 'invitation' ? nowIso : null,
      must_change_password: input.onboarding_mode === 'temporary_password',
    };

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Provisioned staff account',
      entity_type: 'staff',
      entity_id: String(nextId),
      entity_label: `${newRecord.full_name} (${cleanCode})`,
      details: `Role: ${newRecord.role} · Branch: ${newRecord.branch} · Onboarding: ${input.onboarding_mode}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      staff: [newRecord, ...prev.staff],
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));

    void syncAdminMutation('/api/admin/staff', 'POST', input);
    return { ok: true };
  };

  const handleEditStaff = (
    staffId: number,
    updates: EditStaffInput
  ): { ok: boolean; error?: string } => {
    const target = store.staff.find((s) => s.staff_id === staffId);
    if (!target) return { ok: false, error: 'Staff record not found.' };

    const guard = canDeactivateOrDemoteStaffMember({
      targetStaff: target,
      currentAdminStaffId: store.adminProfile.admin_id,
      allStaff: store.staff,
      nextRole: updates.role,
    });
    if (!guard.allowed) {
      return { ok: false, error: guard.reason ?? 'Role change blocked.' };
    }

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Updated staff account',
      entity_type: 'staff',
      entity_id: String(staffId),
      entity_label: `${updates.full_name.trim()} (${target.staff_code})`,
      details: `Role: ${updates.role} · Designation: ${updates.designation.trim()} · Branch: ${updates.branch}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      staff: prev.staff.map((s) =>
        s.staff_id === staffId
          ? {
              ...s,
              full_name: updates.full_name.trim(),
              email: updates.email.trim().toLowerCase(),
              mobile_number: updates.mobile_number.trim(),
              designation: updates.designation.trim(),
              branch: updates.branch,
              role: updates.role,
            }
          : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));

    void syncAdminMutation(`/api/admin/staff/${staffId}`, 'PUT', updates);
    return { ok: true };
  };

  const handleChangeStaffStatus = (
    staffId: number,
    nextStatus: StaffAccountStatus
  ): { ok: boolean; error?: string } => {
    const target = store.staff.find((s) => s.staff_id === staffId);
    if (!target) return { ok: false, error: 'Staff record not found.' };

    const guard = canDeactivateOrDemoteStaffMember({
      targetStaff: target,
      currentAdminStaffId: store.adminProfile.admin_id,
      allStaff: store.staff,
      nextStatus,
    });
    if (!guard.allowed) {
      return { ok: false, error: guard.reason ?? 'Action blocked.' };
    }

    const auditEntry = createAuditLogEntry(actor, {
      action: `Set staff status to ${nextStatus}`,
      entity_type: 'staff',
      entity_id: String(staffId),
      entity_label: `${target.full_name} (${target.staff_code})`,
      details: `Previous status: ${target.status} → New status: ${nextStatus}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      staff: prev.staff.map((s) =>
        s.staff_id === staffId ? { ...s, status: nextStatus } : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));

    void syncAdminMutation(`/api/admin/staff/${staffId}/status`, 'POST', {
      status: nextStatus,
    });
    return { ok: true };
  };

  const handleResetStaffAccess = (staffId: number) => {
    const target = store.staff.find((s) => s.staff_id === staffId);
    if (!target) return;
    const nowIso = new Date().toISOString();

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Triggered staff password reset / invite',
      entity_type: 'staff',
      entity_id: String(staffId),
      entity_label: `${target.full_name} (${target.staff_code})`,
      details: `Issued secure account recovery notification to ${target.email}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      staff: prev.staff.map((s) =>
        s.staff_id === staffId
          ? {
              ...s,
              invitation_pending: true,
              invitation_sent_at: nowIso,
              must_change_password: true,
            }
          : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/staff/${staffId}/reset-password`, 'POST', {});
  };

  // Student mutations + audit logging
  const handleEditStudent = (
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
  ): { ok: boolean; error?: string } => {
    const target = store.students.find((s) => s.student_id === studentId);
    if (!target) return { ok: false, error: 'Student account not found.' };

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Updated student profile record',
      entity_type: 'student',
      entity_id: String(studentId),
      entity_label: `${updates.full_name.trim()} (${target.student_code})`,
      details: `Department: ${updates.department} · Borrowing limit: ${updates.max_borrowing_limit}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              full_name: updates.full_name.trim(),
              email: updates.email.trim(),
              mobile: updates.mobile,
              department: updates.department.trim(),
              program: updates.program.trim(),
              academic_year: updates.academic_year.trim(),
              max_borrowing_limit: updates.max_borrowing_limit,
              remaining_capacity: Math.max(
                0,
                updates.max_borrowing_limit - s.active_loans_count
              ),
            }
          : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));

    void syncAdminMutation(`/api/admin/students/${studentId}`, 'PUT', updates);
    return { ok: true };
  };

  const handleChangeStudentStatus = (
    studentId: number,
    nextStatus: 'Active' | 'Blocked' | 'Suspended',
    reason: string | null
  ) => {
    const target = store.students.find((s) => s.student_id === studentId);
    if (!target) return;

    const auditEntry = createAuditLogEntry(actor, {
      action: `Updated student status to ${nextStatus}`,
      entity_type: 'student',
      entity_id: String(studentId),
      entity_label: `${target.full_name} (${target.student_code})`,
      details: reason ? `Reason: ${reason}` : 'Account standing restored to Active',
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.student_id === studentId
          ? { ...s, account_status: nextStatus, restriction_reason: reason }
          : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/students/${studentId}/status`, 'POST', {
      account_status: nextStatus,
      reason,
    });
  };

  const handleDeleteStudent = (studentId: number): { ok: boolean; error?: string } => {
    const target = store.students.find((s) => s.student_id === studentId);
    if (!target) return { ok: false, error: 'Student account not found.' };

    const guard = canDeleteStudentAccount(target);
    if (!guard.allowed) {
      return { ok: false, error: guard.reason ?? 'Deletion blocked.' };
    }

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Deleted unused student account',
      entity_type: 'student',
      entity_id: String(studentId),
      entity_label: `${target.full_name} (${target.student_code})`,
      details: 'Removed account with zero active or historical library records.',
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      students: prev.students.filter((s) => s.student_id !== studentId),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/students/${studentId}`, 'DELETE');
    return { ok: true };
  };

  // Taxonomy mutations
  const handleSaveCategory = (input: {
    category_id?: number;
    name: string;
    description: string;
    status: 'Active' | 'Inactive';
  }): { ok: boolean; error?: string } => {
    const nowIso = new Date().toISOString();
    const duplicate = store.categories.some(
      (c) =>
        c.name.toLowerCase() === input.name.toLowerCase() &&
        c.category_id !== input.category_id
    );
    if (duplicate) {
      return { ok: false, error: `Category "${input.name}" already exists.` };
    }

    if (input.category_id) {
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Updated category',
        entity_type: 'category',
        entity_id: String(input.category_id),
        entity_label: input.name,
        details: `Status: ${input.status}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        categories: prev.categories.map((c) =>
          c.category_id === input.category_id
            ? {
                ...c,
                name: input.name,
                description: input.description,
                status: input.status,
                updated_at: nowIso,
              }
            : c
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    } else {
      const nextId =
        store.categories.reduce((m, c) => Math.max(m, c.category_id), 0) + 1;
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Created category',
        entity_type: 'category',
        entity_id: String(nextId),
        entity_label: input.name,
        details: `Status: ${input.status}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        categories: [
          ...prev.categories,
          {
            category_id: nextId,
            name: input.name,
            description: input.description,
            status: input.status,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    }

    void syncAdminMutation(
      input.category_id
        ? `/api/admin/categories/${input.category_id}`
        : '/api/admin/categories',
      input.category_id ? 'PUT' : 'POST',
      input
    );
    return { ok: true };
  };

  const handleDeleteCategory = (categoryId: number): { ok: boolean; error?: string } => {
    const withCounts = computeCategoryBookCounts(store.categories, store.books);
    const target = withCounts.find((c) => c.category_id === categoryId);
    if (!target) return { ok: false, error: 'Category not found.' };

    const guard = canDeleteTaxonomyRecord({
      entityLabel: 'category',
      name: target.name,
      bookCount: target.book_count,
    });
    if (!guard.allowed) return { ok: false, error: guard.reason ?? 'Delete blocked.' };

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Deleted unused category',
      entity_type: 'category',
      entity_id: String(categoryId),
      entity_label: target.name,
      details: 'Deleted unreferenced classification.',
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.category_id !== categoryId),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/categories/${categoryId}`, 'DELETE');
    return { ok: true };
  };

  const handleSaveSubject = (input: {
    subject_id?: number;
    name: string;
    code: string;
    description: string;
    status: 'Active' | 'Inactive';
  }): { ok: boolean; error?: string } => {
    const nowIso = new Date().toISOString();
    const duplicate = store.subjects.some(
      (s) =>
        (s.name.toLowerCase() === input.name.toLowerCase() ||
          s.code.toUpperCase() === input.code.toUpperCase()) &&
        s.subject_id !== input.subject_id
    );
    if (duplicate) {
      return { ok: false, error: 'Subject name or code already exists.' };
    }

    if (input.subject_id) {
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Updated subject',
        entity_type: 'subject',
        entity_id: String(input.subject_id),
        entity_label: `${input.name} (${input.code})`,
        details: `Status: ${input.status}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.subject_id === input.subject_id
            ? {
                ...s,
                name: input.name,
                code: input.code,
                description: input.description,
                status: input.status,
                updated_at: nowIso,
              }
            : s
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    } else {
      const nextId =
        store.subjects.reduce((m, s) => Math.max(m, s.subject_id), 0) + 1;
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Created subject',
        entity_type: 'subject',
        entity_id: String(nextId),
        entity_label: `${input.name} (${input.code})`,
        details: `Status: ${input.status}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        subjects: [
          ...prev.subjects,
          {
            subject_id: nextId,
            name: input.name,
            code: input.code,
            description: input.description,
            status: input.status,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    }
    void syncAdminMutation(
      input.subject_id
        ? `/api/admin/subjects/${input.subject_id}`
        : '/api/admin/subjects',
      input.subject_id ? 'PUT' : 'POST',
      input
    );
    return { ok: true };
  };

  const handleDeleteSubject = (subjectId: number): { ok: boolean; error?: string } => {
    const withCounts = computeSubjectBookCounts(store.subjects, store.books);
    const target = withCounts.find((s) => s.subject_id === subjectId);
    if (!target) return { ok: false, error: 'Subject not found.' };

    const guard = canDeleteTaxonomyRecord({
      entityLabel: 'subject',
      name: target.name,
      bookCount: target.book_count,
    });
    if (!guard.allowed) return { ok: false, error: guard.reason ?? 'Delete blocked.' };

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Deleted unused subject',
      entity_type: 'subject',
      entity_id: String(subjectId),
      entity_label: `${target.name} (${target.code})`,
      details: 'Deleted unreferenced subject.',
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.subject_id !== subjectId),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/subjects/${subjectId}`, 'DELETE');
    return { ok: true };
  };

  const handleSaveBranch = (input: {
    branch_id?: number;
    name: string;
    code: string;
    address: string;
    contact_info: string;
    status: 'Active' | 'Inactive';
  }): { ok: boolean; error?: string } => {
    const nowIso = new Date().toISOString();
    if (input.branch_id) {
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Updated library branch',
        entity_type: 'branch',
        entity_id: String(input.branch_id),
        entity_label: `${input.name} (${input.code})`,
        details: `Status: ${input.status}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        branches: prev.branches.map((b) =>
          b.branch_id === input.branch_id
            ? {
                ...b,
                name: input.name,
                code: input.code,
                address: input.address,
                contact_info: input.contact_info,
                status: input.status,
                updated_at: nowIso,
              }
            : b
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    } else {
      const nextId =
        store.branches.reduce((m, b) => Math.max(m, b.branch_id), 0) + 1;
      const auditEntry = createAuditLogEntry(actor, {
        action: 'Created library branch',
        entity_type: 'branch',
        entity_id: String(nextId),
        entity_label: `${input.name} (${input.code})`,
        details: `Address: ${input.address}`,
        result: 'Success',
      });
      setStore((prev) => ({
        ...prev,
        branches: [
          ...prev.branches,
          {
            branch_id: nextId,
            name: input.name,
            code: input.code,
            address: input.address,
            contact_info: input.contact_info,
            status: input.status,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }));
    }
    void syncAdminMutation(
      input.branch_id
        ? `/api/admin/branches/${input.branch_id}`
        : '/api/admin/branches',
      input.branch_id ? 'PUT' : 'POST',
      input
    );
    return { ok: true };
  };

  const handleDeleteBranch = (branchId: number): { ok: boolean; error?: string } => {
    const withCounts = computeBranchInventoryCounts(
      store.branches,
      store.books,
      store.copies
    );
    const target = withCounts.find((b) => b.branch_id === branchId);
    if (!target) return { ok: false, error: 'Branch not found.' };

    const guard = canDeleteTaxonomyRecord({
      entityLabel: 'branch',
      name: target.name,
      bookCount: target.book_count,
      copyCount: target.copy_count,
    });
    if (!guard.allowed) return { ok: false, error: guard.reason ?? 'Delete blocked.' };

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Deleted unused branch',
      entity_type: 'branch',
      entity_id: String(branchId),
      entity_label: `${target.name} (${target.code})`,
      details: 'Removed unreferenced campus branch.',
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      branches: prev.branches.filter((b) => b.branch_id !== branchId),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/branches/${branchId}`, 'DELETE');
    return { ok: true };
  };

  // Library settings mutation + sync
  const handleSaveSettings = (nextSettings: LibraryPolicySettings) => {
    const nowIso = new Date().toISOString();
    const auditEntry = createAuditLogEntry(actor, {
      action: 'Updated library policies & settings',
      entity_type: 'settings',
      entity_id: 'global',
      entity_label: nextSettings.general_settings.library_name,
      details: `Loan duration: ${nextSettings.loan_policy.default_loan_duration_days}d · Max loans: ${nextSettings.loan_policy.max_active_loans_per_student} · Pickup window: ${nextSettings.reservation_policy.pickup_window_hours}h · Fine policy: ${nextSettings.fine_policy.fine_policy_enabled ? 'Enabled' : 'Disabled'}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      librarySettings: {
        ...nextSettings,
        updated_at: nowIso,
        updated_by: actor.name,
      },
      circulationPolicy: {
        ...prev.circulationPolicy,
        default_loan_duration_days:
          nextSettings.loan_policy.default_loan_duration_days,
        reservation_pickup_window_hours:
          nextSettings.reservation_policy.pickup_window_hours,
        fine_policy_enabled: nextSettings.fine_policy.fine_policy_enabled,
        fine_per_day_amount: nextSettings.fine_policy.fine_per_day_amount,
        fine_currency_symbol: nextSettings.fine_policy.fine_currency_symbol,
        supports_email_notifications:
          nextSettings.reminder_policy.email_notifications_enabled,
      },
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation('/api/admin/settings', 'PUT', nextSettings);
  };

  // Role permission toggle + audit log
  const handleToggleRolePermission = (
    roleKey: 'admin' | 'librarian' | 'student',
    permissionKey: PermissionKey,
    nextValue: boolean
  ): { ok: boolean; error?: string } => {
    const guard = canUpdateRolePermission({
      roleKey,
      permissionKey,
      nextValue,
    });
    if (!guard.allowed) {
      return { ok: false, error: guard.reason ?? 'Permission guard triggered.' };
    }
    const nowIso = new Date().toISOString();
    const auditEntry = createAuditLogEntry(actor, {
      action: 'Updated role permission scope',
      entity_type: 'role',
      entity_id: roleKey,
      entity_label: `${roleKey.toUpperCase()} · ${permissionKey}`,
      details: `Permission "${permissionKey}" set to ${nextValue ? 'Granted' : 'Revoked'}`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      roles: prev.roles.map((r) =>
        r.role_key === roleKey
          ? {
              ...r,
              permissions: { ...r.permissions, [permissionKey]: nextValue },
              updated_at: nowIso,
            }
          : r
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation(`/api/admin/roles/${roleKey}`, 'PUT', {
      permissions: { [permissionKey]: nextValue },
    });
    return { ok: true };
  };

  // Admin own profile & password mutations
  const handleUpdateOwnProfile = (updates: {
    full_name: string;
    email: string;
    mobile_number: string;
    designation: string;
  }) => {
    const auditEntry = createAuditLogEntry(actor, {
      action: 'Updated own administrator profile',
      entity_type: 'profile',
      entity_id: String(store.adminProfile.admin_id),
      entity_label: updates.full_name,
      details: `Updated contact details and designation (${updates.designation})`,
      result: 'Success',
    });

    setStore((prev) => ({
      ...prev,
      adminProfile: {
        ...prev.adminProfile,
        ...updates,
      },
      staff: prev.staff.map((s) =>
        s.staff_id === prev.adminProfile.admin_id
          ? {
              ...s,
              full_name: updates.full_name,
              email: updates.email,
              mobile_number: updates.mobile_number,
              designation: updates.designation,
            }
          : s
      ),
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    void syncAdminMutation('/api/admin/profile', 'PUT', updates);
  };

  const handleOwnPasswordChanged = async (
    draft: ChangePasswordDraft
  ): Promise<{ ok: boolean; error?: string }> => {
    if (hasBackendApi) {
      try {
        const res = await fetch(
          `${apiBaseUrl.replace(/\/+$/, '')}/api/admin/change-password`,
          {
            method: 'PUT',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              current_password: draft.current_password,
              new_password: draft.new_password,
            }),
          }
        );
        const body = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        if (!res.ok) {
          return {
            ok: false,
            error: body?.message ?? body?.error ?? 'Current password is incorrect.',
          };
        }
        await refreshAdminWorkspace();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'Unable to reach server to update password.',
        };
      }
    }

    const auditEntry = createAuditLogEntry(actor, {
      action: 'Changed administrator password',
      entity_type: 'profile',
      entity_id: String(store.adminProfile.admin_id),
      entity_label: store.adminProfile.full_name,
      details: 'Password updated cleanly (credential value redacted).',
      result: 'Success',
    });
    setStore((prev) => ({
      ...prev,
      auditLogs: [auditEntry, ...prev.auditLogs],
    }));
    return { ok: true };
  };

  if (unauthorizedMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" aria-hidden="true" />
          <h1 className="font-display mt-3 text-lg font-bold text-[#142B4A]">
            Administrator Access Required
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
            {unauthorizedMessage}
          </p>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'admin-login' })}
            className="mt-5 rounded-lg bg-[#142B4A] px-4 py-2.5 text-xs font-semibold text-white cursor-pointer"
          >
            Return to Staff & Admin Sign In
          </button>
        </div>
      </div>
    );
  }

  const activeManagementSection: AdminManagementSection =
    routeState?.name === 'admin-management' ? (routeState.section ?? 'staff') : 'staff';

  const compatPermissions = deriveLibrarianCompatPermissions(
    store.adminProfile.permissions
  );

  return (
    <AdminShell
      activeRoute={activeRoute}
      activeManagementSection={activeManagementSection}
      admin={store.adminProfile}
      alerts={alerts}
      referenceDate={referenceDate}
      onNavigate={handleGuardedNavigate}
      onQuickSearch={handleQuickSearch}
      onLogout={handleLogout}
    >
      {syncError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          <span>{syncError}</span>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="font-semibold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {isCheckingSession ? (
        <div
          aria-label="Verifying administrator session"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-pulse"
        >
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="h-32 rounded-xl border border-slate-200 bg-white p-5" />
          ))}
        </div>
      ) : activeRoute === 'admin-dashboard' ? (
        <AdminOverviewView
          metrics={metrics}
          alerts={alerts}
          staff={store.staff}
          students={store.students}
          auditLogs={store.auditLogs}
          reportsDataset={store.reportsDataset}
          referenceDate={referenceDate}
          onNavigate={handleGuardedNavigate}
          onOpenCreateStaffModal={() => {
            setOpenCreateStaffRequested(true);
            handleGuardedNavigate({ name: 'admin-management', section: 'staff' });
          }}
        />
      ) : activeRoute === 'admin-management' ? (
        <AdminManagementPage
          activeSection={activeManagementSection}
          store={store}
          quickSearchQuery={quickSearchQuery}
          openCreateStaffRequested={openCreateStaffRequested}
          onConsumeOpenCreateStaff={() => setOpenCreateStaffRequested(false)}
          onNavigate={handleGuardedNavigate}
          onCreateStaff={handleCreateStaff}
          onEditStaff={handleEditStaff}
          onChangeStaffStatus={handleChangeStaffStatus}
          onResetStaffAccess={handleResetStaffAccess}
          onEditStudent={handleEditStudent}
          onChangeStudentStatus={handleChangeStudentStatus}
          onDeleteStudent={handleDeleteStudent}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          onSaveSubject={handleSaveSubject}
          onDeleteSubject={handleDeleteSubject}
          onSaveBranch={handleSaveBranch}
          onDeleteBranch={handleDeleteBranch}
          onSaveSettings={handleSaveSettings}
          onToggleRolePermission={handleToggleRolePermission}
        />
      ) : activeRoute === 'admin-inventory' ? (
        <LibrarianInventoryPage
          permissions={compatPermissions}
          onNavigate={(target) => {
            if (target.name === 'librarian-add-book') {
              handleGuardedNavigate({ name: 'admin-add-book' });
            } else if (target.name === 'librarian-dashboard') {
              handleGuardedNavigate({ name: 'admin-dashboard' });
            } else {
              handleGuardedNavigate(target);
            }
          }}
        />
      ) : activeRoute === 'admin-add-book' ? (
        <AddBookPage
          permissions={compatPermissions}
          onNavigate={(target) => {
            if (target.name === 'librarian-inventory') {
              handleGuardedNavigate({ name: 'admin-inventory' });
            } else if (target.name === 'librarian-dashboard') {
              handleGuardedNavigate({ name: 'admin-dashboard' });
            } else {
              handleGuardedNavigate(target);
            }
          }}
          onRegisterUnsavedGuard={(guard) => {
            unsavedLeaveGuardRef.current = guard;
          }}
        />
      ) : activeRoute === 'admin-reports' ? (
        <ReportsAnalyticsPage
          permissions={compatPermissions}
          onNavigate={handleGuardedNavigate}
        />
      ) : activeRoute === 'admin-audit-logs' ? (
        <AdminAuditLogsSection logs={store.auditLogs} />
      ) : (
        <AdminProfileSection
          admin={store.adminProfile}
          initialSection={
            routeState?.name === 'admin-profile' ? routeState.section : 'profile'
          }
          onUpdateProfile={handleUpdateOwnProfile}
          onChangePassword={handleOwnPasswordChanged}
        />
      )}
    </AdminShell>
  );
}

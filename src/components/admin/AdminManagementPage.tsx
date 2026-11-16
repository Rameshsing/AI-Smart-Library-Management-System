import React from 'react';
import {
  Building2,
  FolderTree,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
} from 'lucide-react';
import type { AdminManagementSection, AppRoute } from '../../data/libraryData';
import type {
  AdminWorkspaceStore,
  CreateStaffInput,
  EditStaffInput,
  LibraryPolicySettings,
  PermissionKey,
  StaffAccountStatus,
} from '../../utils/adminManagement';
import {
  AdminBranchManagementSection,
  AdminCategoryManagementSection,
  AdminLibrarySettingsSection,
  AdminSubjectManagementSection,
} from './AdminCatalogSettingsSections';
import { AdminRolePermissionSection } from './AdminRolesAuditProfileSections';
import {
  AdminStaffManagementSection,
  AdminUserManagementSection,
} from './AdminStaffUsersSections';

interface AdminManagementPageProps {
  activeSection: AdminManagementSection;
  store: AdminWorkspaceStore;
  quickSearchQuery: string;
  openCreateStaffRequested: boolean;
  onConsumeOpenCreateStaff: () => void;
  onNavigate: (route: AppRoute) => void;
  onCreateStaff: (input: CreateStaffInput) => { ok: boolean; error?: string };
  onEditStaff: (staffId: number, updates: EditStaffInput) => { ok: boolean; error?: string };
  onChangeStaffStatus: (
    staffId: number,
    nextStatus: StaffAccountStatus
  ) => { ok: boolean; error?: string };
  onResetStaffAccess: (staffId: number) => void;
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
  onSaveCategory: (input: {
    category_id?: number;
    name: string;
    description: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteCategory: (categoryId: number) => { ok: boolean; error?: string };
  onSaveSubject: (input: {
    subject_id?: number;
    name: string;
    code: string;
    description: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteSubject: (subjectId: number) => { ok: boolean; error?: string };
  onSaveBranch: (input: {
    branch_id?: number;
    name: string;
    code: string;
    address: string;
    contact_info: string;
    status: 'Active' | 'Inactive';
  }) => { ok: boolean; error?: string };
  onDeleteBranch: (branchId: number) => { ok: boolean; error?: string };
  onSaveSettings: (nextSettings: LibraryPolicySettings) => void;
  onToggleRolePermission: (
    roleKey: 'admin' | 'librarian' | 'student',
    permissionKey: PermissionKey,
    nextValue: boolean
  ) => { ok: boolean; error?: string };
}

const MANAGEMENT_TABS: Array<{
  section: AdminManagementSection;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    section: 'staff',
    label: 'Staff Management',
    icon: <UserCog className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'users',
    label: 'User Management',
    icon: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'categories',
    label: 'Categories',
    icon: <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'subjects',
    label: 'Subjects',
    icon: <Tags className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'branches',
    label: 'Branches',
    icon: <Building2 className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'settings',
    label: 'Library Settings',
    icon: <Settings className="h-3.5 w-3.5" aria-hidden="true" />,
  },
  {
    section: 'roles',
    label: 'Roles & Permissions',
    icon: <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />,
  },
];

export function AdminManagementPage({
  activeSection,
  store,
  quickSearchQuery,
  openCreateStaffRequested,
  onConsumeOpenCreateStaff,
  onNavigate,
  onCreateStaff,
  onEditStaff,
  onChangeStaffStatus,
  onResetStaffAccess,
  onEditStudent,
  onChangeStudentStatus,
  onDeleteStudent,
  onSaveCategory,
  onDeleteCategory,
  onSaveSubject,
  onDeleteSubject,
  onSaveBranch,
  onDeleteBranch,
  onSaveSettings,
  onToggleRolePermission,
}: AdminManagementPageProps) {
  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div
        role="tablist"
        aria-label="Admin management sections"
        className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xs"
      >
        {MANAGEMENT_TABS.map((tab) => {
          const isActive = activeSection === tab.section;
          return (
            <button
              key={tab.section}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() =>
                onNavigate({ name: 'admin-management', section: tab.section })
              }
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#142B4A] text-white shadow-xs'
                  : 'text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeSection === 'staff' && (
        <AdminStaffManagementSection
          staff={store.staff}
          branches={store.branches}
          currentAdminStaffId={store.adminProfile.admin_id}
          initialSearchQuery={quickSearchQuery}
          initialOpenCreateModal={openCreateStaffRequested}
          onConsumeOpenCreateModal={onConsumeOpenCreateStaff}
          onCreateStaff={onCreateStaff}
          onEditStaff={onEditStaff}
          onChangeStaffStatus={onChangeStaffStatus}
          onResetStaffAccess={onResetStaffAccess}
        />
      )}

      {activeSection === 'users' && (
        <AdminUserManagementSection
          students={store.students}
          activeBorrowings={store.activeBorrowings}
          reservations={store.reservations}
          initialSearchQuery={quickSearchQuery}
          onEditStudent={onEditStudent}
          onChangeStudentStatus={onChangeStudentStatus}
          onDeleteStudent={onDeleteStudent}
        />
      )}

      {activeSection === 'categories' && (
        <AdminCategoryManagementSection
          categories={store.categories}
          books={store.books}
          onSaveCategory={onSaveCategory}
          onDeleteCategory={onDeleteCategory}
        />
      )}

      {activeSection === 'subjects' && (
        <AdminSubjectManagementSection
          subjects={store.subjects}
          books={store.books}
          onSaveSubject={onSaveSubject}
          onDeleteSubject={onDeleteSubject}
        />
      )}

      {activeSection === 'branches' && (
        <AdminBranchManagementSection
          branches={store.branches}
          books={store.books}
          copies={store.copies}
          onSaveBranch={onSaveBranch}
          onDeleteBranch={onDeleteBranch}
        />
      )}

      {activeSection === 'settings' && (
        <AdminLibrarySettingsSection
          settings={store.librarySettings}
          onSaveSettings={onSaveSettings}
        />
      )}

      {activeSection === 'roles' && (
        <AdminRolePermissionSection
          roles={store.roles}
          onToggleRolePermission={onToggleRolePermission}
        />
      )}
    </div>
  );
}

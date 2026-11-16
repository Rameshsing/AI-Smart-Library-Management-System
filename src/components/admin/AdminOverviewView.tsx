import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookCopy,
  BookOpen,
  BookmarkCheck,
  Building2,
  FileClock,
  FolderTree,
  Info,
  Repeat,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tags,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import type {
  AdminDashboardMetrics,
  AdminSystemAlert,
} from '../../utils/adminDashboard';
import { formatStaffDateTime } from '../../utils/adminDashboard';
import type {
  AdminAuditLogEntry,
  StaffAccountRecord,
} from '../../utils/adminManagement';
import {
  computeReportsAnalyticsView,
  createDefaultReportsFilterState,
  type ReportsSourceDataset,
} from '../../utils/librarianReports';
import type { LibrarianStudentDirectoryItem } from '../../utils/librarianStudents';
import {
  DualSeriesTrendChart,
  HorizontalDistributionChart,
  StatusDoughnutChart,
} from '../librarian/ReportsCharts';

interface AdminOverviewViewProps {
  metrics: AdminDashboardMetrics;
  alerts: AdminSystemAlert[];
  staff: StaffAccountRecord[];
  students: LibrarianStudentDirectoryItem[];
  auditLogs: AdminAuditLogEntry[];
  reportsDataset: ReportsSourceDataset;
  referenceDate: Date;
  onNavigate: (route: AppRoute) => void;
  onOpenCreateStaffModal?: () => void;
}

export function AdminOverviewView({
  metrics,
  alerts,
  staff,
  students,
  auditLogs,
  reportsDataset,
  referenceDate,
  onNavigate,
  onOpenCreateStaffModal,
}: AdminOverviewViewProps) {
  const reportsPreview = useMemo(() => {
    const filters = createDefaultReportsFilterState(referenceDate);
    filters.datePreset = 'last_30_days';
    return computeReportsAnalyticsView(reportsDataset, filters, referenceDate);
  }, [reportsDataset, referenceDate]);

  const trendSeries = useMemo(
    () =>
      reportsPreview.charts.circulationTrends.slice(-8).map((point) => ({
        label: point.label,
        primary: point.issued,
        secondary: point.returned,
      })),
    [reportsPreview.charts.circulationTrends]
  );

  const categoryDistribution = useMemo(
    () =>
      reportsPreview.charts.popularCategories.slice(0, 5).map((cat) => ({
        label: cat.name,
        value: cat.borrow_count,
        hint: `${cat.share_percent}%`,
      })),
    [reportsPreview.charts.popularCategories]
  );

  const copyStatusSegments = useMemo(
    () => [
      {
        label: 'Available',
        value: reportsPreview.charts.inventoryStatus.available,
        color: '#059669',
      },
      {
        label: 'Issued',
        value: reportsPreview.charts.inventoryStatus.issued,
        color: '#2563EB',
      },
      {
        label: 'Reserved',
        value: reportsPreview.charts.inventoryStatus.reserved,
        color: '#D97706',
      },
      {
        label: 'Lost / Repair',
        value: reportsPreview.charts.inventoryStatus.lost_damaged_repair,
        color: '#DC2626',
      },
    ],
    [reportsPreview.charts.inventoryStatus]
  );

  const quickActions: Array<{
    id: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    onClick: () => void;
    primary?: boolean;
  }> = [
    {
      id: 'create-librarian',
      label: 'Create Librarian',
      sublabel: 'Provision staff account',
      icon: <UserPlus className="h-4 w-4" aria-hidden="true" />,
      onClick: () => {
        if (onOpenCreateStaffModal) {
          onOpenCreateStaffModal();
        } else {
          onNavigate({ name: 'admin-management', section: 'staff' });
        }
      },
      primary: true,
    },
    {
      id: 'manage-users',
      label: 'Manage Users',
      sublabel: `${metrics.users.totalStudents} student accounts`,
      icon: <Users className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-management', section: 'users' }),
    },
    {
      id: 'manage-categories',
      label: 'Categories',
      sublabel: `${metrics.library.activeCategoriesCount} active`,
      icon: <FolderTree className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-management', section: 'categories' }),
    },
    {
      id: 'manage-subjects',
      label: 'Subjects',
      sublabel: `${metrics.library.activeSubjectsCount} active`,
      icon: <Tags className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-management', section: 'subjects' }),
    },
    {
      id: 'library-settings',
      label: 'Library Settings',
      sublabel: 'Loan & hold rules',
      icon: <Settings className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-management', section: 'settings' }),
    },
    {
      id: 'branches',
      label: 'Branches',
      sublabel: `${metrics.library.activeBranchesCount} active sites`,
      icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-management', section: 'branches' }),
    },
    {
      id: 'system-reports',
      label: 'System Reports',
      sublabel: 'Analytics & CSV',
      icon: <BarChart3 className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-reports' }),
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      sublabel: `${metrics.system.auditEventsCount} recorded`,
      icon: <FileClock className="h-4 w-4" aria-hidden="true" />,
      onClick: () => onNavigate({ name: 'admin-audit-logs' }),
    },
  ];

  const renderSeverityStyle = (severity: AdminSystemAlert['severity']) => {
    if (severity === 'Critical') {
      return {
        badge: 'bg-red-100 text-red-700 border-red-200',
        border: 'border-red-200 bg-red-50/40',
        icon: <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />,
      };
    }
    if (severity === 'Warning') {
      return {
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        border: 'border-amber-200 bg-amber-50/40',
        icon: <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />,
      };
    }
    return {
      badge: 'bg-[#DBEAFE] text-[#142B4A] border-[#DBEAFE]',
      border: 'border-slate-200 bg-[#F5F8FC]/60',
      icon: <Info className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />,
    };
  };

  return (
    <div className="space-y-6">
      {/* KPI Overview Grid across all 6 domains */}
      <section aria-label="System KPI Summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Users KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Student Users
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.users.totalStudents}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#2563EB]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span className="font-medium text-emerald-700">
                Active: <strong className="font-mono-tabular">{metrics.users.activeStudents}</strong>
              </span>
              <span>
                Inactive / Restricted:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.users.inactiveOrSuspendedStudents}
                </strong>
              </span>
            </div>
          </article>

          {/* Staff KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Library Staff & Admins
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.staff.totalStaff}
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span>
                Librarians:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.staff.activeLibrarians}
                </strong>
              </span>
              <span>
                Admins:{' '}
                <strong className="font-mono-tabular text-[#2563EB]">
                  {metrics.staff.activeAdmins}
                </strong>
              </span>
              <span>
                Inactive:{' '}
                <strong className="font-mono-tabular text-slate-700">
                  {metrics.staff.inactiveStaff}
                </strong>
              </span>
            </div>
          </article>

          {/* Library Catalog KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Catalog & Physical Copies
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.library.totalBookTitles}{' '}
                  <span className="text-sm font-semibold text-[#64748B]">titles</span>
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#2563EB]">
                <BookCopy className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span>
                Copies:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.library.totalPhysicalCopies}
                </strong>
              </span>
              <span className="text-emerald-700 font-medium">
                Available:{' '}
                <strong className="font-mono-tabular">{metrics.library.availableCopies}</strong>
              </span>
              <span>
                Categories/Subjects:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.library.activeCategoriesCount}/{metrics.library.activeSubjectsCount}
                </strong>
              </span>
            </div>
          </article>

          {/* Borrowing KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Active Borrowing & Overdue
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.borrowing.currentlyIssuedCount}{' '}
                  <span className="text-sm font-semibold text-[#64748B]">issued</span>
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <Repeat className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span
                className={
                  metrics.borrowing.overdueCount > 0 ? 'font-semibold text-red-700' : ''
                }
              >
                Overdue:{' '}
                <strong className="font-mono-tabular">{metrics.borrowing.overdueCount}</strong>
              </span>
              <span>
                Returns Recorded:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.borrowing.returnsProcessedCount}
                </strong>
              </span>
            </div>
          </article>

          {/* Reservations KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  Reservation Queue
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.reservations.activeQueueCount}{' '}
                  <span className="text-sm font-semibold text-[#64748B]">active holds</span>
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <BookmarkCheck className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span className="font-medium text-emerald-700">
                Ready for Pickup:{' '}
                <strong className="font-mono-tabular">
                  {metrics.reservations.readyForPickupCount}
                </strong>
              </span>
              <span>
                Expiring Soon:{' '}
                <strong className="font-mono-tabular text-amber-700">
                  {metrics.reservations.expiringSoonCount}
                </strong>
              </span>
            </div>
          </article>

          {/* System Governance KPI */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  System Governance
                </p>
                <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-[#142B4A]">
                  {metrics.system.systemAlertsCount}{' '}
                  <span className="text-sm font-semibold text-[#64748B]">active alerts</span>
                </p>
              </div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#142B4A]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span>
                Published Notices:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.system.activeAnnouncementsCount}
                </strong>
              </span>
              <span>
                Audit Events:{' '}
                <strong className="font-mono-tabular text-[#142B4A]">
                  {metrics.system.auditEventsCount}
                </strong>
              </span>
            </div>
          </article>
        </div>
      </section>

      {/* Quick Administrative Actions */}
      <section
        aria-label="Quick Administrative Actions"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#142B4A]">
              Quick Administrative Actions
            </h2>
            <p className="text-xs text-[#64748B]">
              Direct shortcuts for staff provisioning, user administration, taxonomy, and policy configuration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'admin-management', section: 'roles' })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
          >
            <span>Role & Permission Matrix</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                action.primary
                  ? 'border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
                  : 'border-slate-200 bg-[#F5F8FC]/60 text-[#142B4A] hover:border-[#2563EB]/40 hover:bg-[#DBEAFE]/40'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    action.primary
                      ? 'bg-white/15 text-white'
                      : 'bg-white text-[#2563EB] border border-slate-200'
                  }`}
                >
                  {action.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{action.label}</p>
                  <p
                    className={`truncate text-[11px] ${
                      action.primary ? 'text-blue-100' : 'text-[#64748B]'
                    }`}
                  >
                    {action.sublabel}
                  </p>
                </div>
              </div>
              <ArrowRight
                className={`h-3.5 w-3.5 shrink-0 ${
                  action.primary ? 'text-white' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </section>

      {/* Library Overview Charts (Reusing ReportsCharts) */}
      <section aria-label="Library Overview Analytics" className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                Borrowing & Return Trend (30 Days)
              </h2>
              <p className="text-xs text-[#64748B]">
                Live checkout vs return volume across branches.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'admin-reports' })}
              className="shrink-0 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              Full Reports
            </button>
          </div>
          <DualSeriesTrendChart
            data={trendSeries}
            primaryLabel="Issued"
            secondaryLabel="Returned"
            mode="bar"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                Top Borrowed Categories
              </h2>
              <p className="text-xs text-[#64748B]">
                Distribution by subject classification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'admin-management', section: 'categories' })}
              className="shrink-0 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              Categories
            </button>
          </div>
          <HorizontalDistributionChart
            items={categoryDistribution}
            valueSuffix=" borrows"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                Copy Availability Split
              </h2>
              <p className="text-xs text-[#64748B]">
                Status across {metrics.library.totalPhysicalCopies} physical copies.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ name: 'admin-inventory' })}
              className="shrink-0 text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              Inventory
            </button>
          </div>
          <StatusDoughnutChart
            segments={copyStatusSegments}
            centerLabel="Total Copies"
            centerValue={metrics.library.totalPhysicalCopies}
          />
        </div>
      </section>

      {/* User & Staff Overview + System Alerts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* User & Staff Governance Overview */}
        <section
          aria-label="User and Staff Overview"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs xl:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#142B4A]">
                User & Staff Directory Snapshot
              </h2>
              <p className="text-xs text-[#64748B]">
                Live account distribution and active staff assignments across branches.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate({ name: 'admin-management', section: 'users' })}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                All Users
              </button>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'admin-management', section: 'staff' })}
                className="text-xs font-semibold text-[#142B4A] hover:text-[#2563EB] hover:underline cursor-pointer"
              >
                All Staff
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
              <p className="text-xs font-semibold text-[#64748B]">Student Account Breakdown</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#1E293B]">Active Student Accounts</span>
                  <span className="font-mono-tabular font-bold text-emerald-700">
                    {metrics.users.activeStudents}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1E293B]">Blocked / Suspended</span>
                  <span className="font-mono-tabular font-bold text-amber-700">
                    {metrics.users.inactiveOrSuspendedStudents}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-[#1E293B]">Students with Active Loans</span>
                  <span className="font-mono-tabular font-bold text-[#142B4A]">
                    {students.filter((s) => s.active_loans_count > 0).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-[#F5F8FC]/60 p-3.5">
              <p className="text-xs font-semibold text-[#64748B]">Staff Role Distribution</p>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#1E293B]">Active System Administrators</span>
                  <span className="font-mono-tabular font-bold text-[#2563EB]">
                    {metrics.staff.activeAdmins}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#1E293B]">Active Librarians</span>
                  <span className="font-mono-tabular font-bold text-emerald-700">
                    {metrics.staff.activeLibrarians}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-[#1E293B]">Inactive / Pending Staff</span>
                  <span className="font-mono-tabular font-bold text-slate-700">
                    {metrics.staff.inactiveStaff}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748B]">
                  <th className="py-2 pr-3 font-semibold">Staff Member</th>
                  <th className="py-2 pr-3 font-semibold">Role</th>
                  <th className="py-2 pr-3 font-semibold">Branch</th>
                  <th className="py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.slice(0, 5).map((member) => (
                  <tr key={member.staff_id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-[#142B4A]">{member.full_name}</p>
                      <p className="font-mono-tabular text-[11px] text-[#64748B]">
                        {member.staff_code} · {member.email}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 capitalize">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                          member.role === 'admin'
                            ? 'bg-[#142B4A] text-white'
                            : 'bg-[#DBEAFE] text-[#142B4A]'
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-[#64748B]">{member.branch}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${
                          member.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* System Alerts & Recent Administrative Activity */}
        <section
          aria-label="System Alerts and Administrative Activity"
          className="space-y-6 xl:col-span-5"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#142B4A]">
                  System Alerts ({alerts.length})
                </h2>
                <p className="text-xs text-[#64748B]">
                  Operational, overdue, and governance notices.
                </p>
              </div>
            </div>

            {alerts.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-[#F5F8FC]/60 p-4 text-center text-xs text-[#64748B]">
                No critical warnings or operational alerts require attention right now.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {alerts.slice(0, 4).map((alert) => {
                  const style = renderSeverityStyle(alert.severity);
                  return (
                    <li
                      key={alert.id}
                      className={`rounded-lg border p-3 ${style.border}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${style.badge}`}
                        >
                          {style.icon}
                          {alert.severity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate(alert.targetRoute)}
                          className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                        >
                          {alert.actionLabel}
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs font-bold text-[#142B4A]">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">
                        {alert.description}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#142B4A]">
                  Recent Administrative Activity
                </h2>
                <p className="text-xs text-[#64748B]">
                  Latest verified admin changes recorded in this session.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate({ name: 'admin-audit-logs' })}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Full Trail
              </button>
            </div>

            {auditLogs.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-[#F5F8FC]/60 p-4 text-center">
                <BookOpen className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                <p className="mt-1.5 text-xs font-semibold text-[#142B4A]">
                  No administrative changes logged yet
                </p>
                <p className="mt-0.5 text-[11px] text-[#64748B]">
                  Staff onboarding, student status updates, taxonomy additions, and policy saves will appear here automatically.
                </p>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {auditLogs.slice(0, 5).map((entry) => (
                  <li key={entry.log_id} className="py-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#142B4A]">{entry.action}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          entry.result === 'Success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {entry.result}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#64748B]">
                      {entry.entity_label} · by {entry.actor_name}
                    </p>
                    <p className="font-mono-tabular mt-0.5 text-[10px] text-slate-500">
                      {formatStaffDateTime(entry.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

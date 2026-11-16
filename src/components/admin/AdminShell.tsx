import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  FileClock,
  FolderTree,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  User,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { AdminManagementSection, AppRoute } from '../../data/libraryData';
import {
  formatLibrarianCurrentDate,
  getTimeGreeting,
  type AdminProfile,
  type AdminSectionRoute,
  type AdminSystemAlert,
} from '../../utils/adminDashboard';
import { BrandLogo } from '../BrandLogo';

interface AdminShellProps {
  activeRoute: AdminSectionRoute;
  activeManagementSection?: AdminManagementSection;
  admin: AdminProfile;
  alerts: AdminSystemAlert[];
  referenceDate: Date;
  onNavigate: (route: AppRoute) => void;
  onQuickSearch?: (query: string, target: 'users' | 'staff' | 'inventory') => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface AdminNavItem {
  id: string;
  label: string;
  route: AppRoute;
  icon: React.ReactNode;
  isActive: boolean;
  badgeCount?: number;
}

export function AdminShell({
  activeRoute,
  activeManagementSection,
  admin,
  alerts,
  referenceDate,
  onNavigate,
  onQuickSearch,
  onLogout,
  children,
}: AdminShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const alertsMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [admin.avatar_url]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileDrawerOpen(false);
        setProfileMenuOpen(false);
        setAlertsOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
      if (
        alertsMenuRef.current &&
        !alertsMenuRef.current.contains(event.target as Node)
      ) {
        setAlertsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navItems: AdminNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      route: { name: 'admin-dashboard' },
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-dashboard',
    },
    {
      id: 'users',
      label: 'User Management',
      route: { name: 'admin-management', section: 'users' },
      icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-management' && activeManagementSection === 'users',
    },
    {
      id: 'staff',
      label: 'Staff Management',
      route: { name: 'admin-management', section: 'staff' },
      icon: <UserCog className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive:
        activeRoute === 'admin-management' &&
        (activeManagementSection === 'staff' || !activeManagementSection),
    },
    {
      id: 'inventory',
      label: 'Books & Inventory',
      route: { name: 'admin-inventory' },
      icon: <Library className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-inventory' || activeRoute === 'admin-add-book',
    },
    {
      id: 'categories',
      label: 'Categories',
      route: { name: 'admin-management', section: 'categories' },
      icon: <FolderTree className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive:
        activeRoute === 'admin-management' && activeManagementSection === 'categories',
    },
    {
      id: 'subjects',
      label: 'Subjects',
      route: { name: 'admin-management', section: 'subjects' },
      icon: <Tags className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive:
        activeRoute === 'admin-management' && activeManagementSection === 'subjects',
    },
    {
      id: 'settings',
      label: 'Library Settings',
      route: { name: 'admin-management', section: 'settings' },
      icon: <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive:
        activeRoute === 'admin-management' &&
        (activeManagementSection === 'settings' ||
          activeManagementSection === 'branches' ||
          activeManagementSection === 'roles'),
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      route: { name: 'admin-reports' },
      icon: <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-reports',
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      route: { name: 'admin-audit-logs' },
      icon: <FileClock className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-audit-logs',
    },
    {
      id: 'profile',
      label: 'My Profile',
      route: { name: 'admin-profile', section: 'profile' },
      icon: <User className="h-4 w-4 shrink-0" aria-hidden="true" />,
      isActive: activeRoute === 'admin-profile',
    },
  ];

  const handleNavClick = (route: AppRoute) => {
    setMobileDrawerOpen(false);
    setProfileMenuOpen(false);
    setAlertsOpen(false);
    onNavigate(route);
  };

  const initials = admin.full_name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const resolvePageHeader = () => {
    if (activeRoute === 'admin-dashboard') {
      return {
        title: `${getTimeGreeting(referenceDate.getHours())}, ${admin.full_name}`,
        subtitle: 'System governance, user & staff administration, and policy overview.',
      };
    }
    if (activeRoute === 'admin-management') {
      const sectionLabels: Record<AdminManagementSection, string> = {
        staff: 'Staff & Librarian Management',
        users: 'Student & User Management',
        categories: 'Category Taxonomy Management',
        subjects: 'Subject Classification Management',
        branches: 'Library Branches & Locations',
        settings: 'Library Settings & Circulation Policies',
        roles: 'Role & Permission Governance',
      };
      return {
        title: sectionLabels[activeManagementSection ?? 'staff'],
        subtitle: `${admin.full_name} · ${admin.designation}`,
      };
    }
    if (activeRoute === 'admin-inventory') {
      return {
        title: 'Books & Inventory Governance',
        subtitle: 'Search, inspect, edit, and manage physical book copies.',
      };
    }
    if (activeRoute === 'admin-add-book') {
      return {
        title: 'Add New Book to Catalog',
        subtitle: 'Create bibliographic catalog records and physical copy records.',
      };
    }
    if (activeRoute === 'admin-reports') {
      return {
        title: 'System Reports & Analytics',
        subtitle: 'Circulation trends, overdue distribution, and catalog reports.',
      };
    }
    if (activeRoute === 'admin-audit-logs') {
      return {
        title: 'Administrative Audit Logs',
        subtitle: 'Compliance trail of staff, student, taxonomy, and policy updates.',
      };
    }
    return {
      title: 'Administrator Profile & Security',
      subtitle: `${admin.full_name} · ${admin.staff_code}`,
    };
  };

  const headerInfo = resolvePageHeader();
  const currentDateLabel = formatLibrarianCurrentDate(referenceDate);

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = headerSearch.trim();
    if (!q) return;
    if (onQuickSearch) {
      if (q.toUpperCase().startsWith('LIB-') || q.toUpperCase().startsWith('ADM-')) {
        onQuickSearch(q, 'staff');
      } else if (q.toUpperCase().startsWith('STU-') || q.includes('@')) {
        onQuickSearch(q, 'users');
      } else {
        onQuickSearch(q, 'users');
      }
    } else {
      onNavigate({ name: 'admin-management', section: 'users' });
    }
  };

  const renderSidebar = () => (
    <div className="flex h-full flex-col justify-between bg-white">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <BrandLogo
            onClick={(e) => {
              e.preventDefault();
              handleNavClick({ name: 'home' });
            }}
          />
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close admin navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Administrator sidebar navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.route)}
              aria-current={item.isActive ? 'page' : undefined}
              className={`flex min-h-[40px] w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                item.isActive
                  ? 'bg-[#142B4A] text-white shadow-xs'
                  : 'text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className={item.isActive ? 'text-[#DBEAFE]' : 'text-slate-500'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="mb-2 rounded-lg bg-[#F5F8FC] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-[#142B4A]">
              {admin.full_name}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#142B4A]">
              <ShieldCheck className="h-2.5 w-2.5 text-[#2563EB]" aria-hidden="true" />
              <span>Admin</span>
            </span>
          </div>
          <p className="font-mono-tabular mt-0.5 truncate text-[11px] text-[#64748B]">
            {admin.staff_code}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileDrawerOpen(false);
            onLogout();
          }}
          className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  const criticalCount = alerts.filter((a) => a.severity === 'Critical').length;

  return (
    <div className="flex min-h-screen bg-[#F5F8FC] text-[#1E293B]">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen">
        {renderSidebar()}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Administrator navigation menu"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          <div
            className="fixed inset-0 bg-[#142B4A]/45 backdrop-blur-[1px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
            {renderSidebar()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open admin navigation menu"
                aria-expanded={mobileDrawerOpen}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#142B4A] hover:bg-[#F5F8FC] lg:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <span className="font-display truncate text-sm font-bold text-[#142B4A] sm:hidden">
                Admin Console
              </span>

              <div className="hidden min-w-0 sm:block">
                <h1 className="font-display truncate text-lg font-bold tracking-tight text-[#142B4A] lg:text-xl">
                  {headerInfo.title}
                </h1>
                <p className="truncate text-xs text-[#64748B]">{headerInfo.subtitle}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Quick Search */}
              <form
                onSubmit={handleHeaderSearchSubmit}
                className="hidden items-center md:flex"
                role="search"
                aria-label="Quick admin search"
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={headerSearch}
                    onChange={(e) => setHeaderSearch(e.target.value)}
                    placeholder="Find user or staff..."
                    aria-label="Quick search user or staff"
                    className="h-9 w-44 rounded-lg border border-slate-200 bg-[#F5F8FC] pl-8 pr-3 text-xs text-[#1E293B] placeholder:text-[#64748B] focus:border-[#2563EB] focus:bg-white focus:outline-none lg:w-52"
                  />
                </div>
              </form>

              {/* Current Date */}
              <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2 text-xs font-medium text-[#142B4A] xl:inline-flex">
                <CalendarDays className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span className="font-mono-tabular whitespace-nowrap">{currentDateLabel}</span>
              </div>

              {/* Alerts Bell */}
              <div className="relative" ref={alertsMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setAlertsOpen((prev) => !prev);
                    setProfileMenuOpen(false);
                  }}
                  aria-label={`System alerts (${alerts.length})`}
                  aria-expanded={alertsOpen}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#142B4A] transition-colors hover:border-[#2563EB]/40 hover:bg-[#F5F8FC] cursor-pointer"
                >
                  <Bell className="h-4.5 w-4.5" aria-hidden="true" />
                  {alerts.length > 0 && (
                    <span
                      className={`font-mono-tabular absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] font-bold text-white ${
                        criticalCount > 0 ? 'bg-red-600' : 'bg-[#2563EB]'
                      }`}
                    >
                      {alerts.length > 9 ? '9+' : alerts.length}
                    </span>
                  )}
                </button>

                {alertsOpen && (
                  <div
                    role="region"
                    aria-label="System Alerts Summary"
                    className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-[#142B4A]">
                        System Alerts ({alerts.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleNavClick({ name: 'admin-dashboard' })}
                        className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                      >
                        View Dashboard
                      </button>
                    </div>
                    {alerts.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#64748B]">
                        No active operational or security alerts.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                        {alerts.slice(0, 5).map((alert) => (
                          <li
                            key={alert.id}
                            className="rounded-lg border border-slate-200 bg-[#F5F8FC]/60 p-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  alert.severity === 'Critical'
                                    ? 'bg-red-100 text-red-700'
                                    : alert.severity === 'Warning'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-[#DBEAFE] text-[#142B4A]'
                                }`}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                                {alert.severity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleNavClick(alert.targetRoute)}
                                className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
                              >
                                {alert.actionLabel}
                              </button>
                            </div>
                            <p className="mt-1 text-xs font-semibold text-[#142B4A]">
                              {alert.title}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Profile Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen((prev) => !prev);
                    setAlertsOpen(false);
                  }}
                  aria-expanded={profileMenuOpen}
                  aria-label="Open administrator profile menu"
                  className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-[#2563EB]/40 hover:bg-[#F5F8FC] cursor-pointer"
                >
                  {admin.avatar_url && !avatarError ? (
                    <img
                      src={admin.avatar_url}
                      alt={admin.full_name}
                      onError={() => setAvatarError(true)}
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#142B4A] text-xs font-bold text-white">
                      {initials || 'AD'}
                    </div>
                  )}
                  <div className="hidden text-left md:block">
                    <p className="max-w-[125px] truncate text-xs font-semibold text-[#142B4A]">
                      {admin.full_name}
                    </p>
                    <p className="max-w-[125px] truncate text-[10px] text-[#64748B]">
                      System Administrator
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Administrator profile options"
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg"
                  >
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <p className="truncate text-xs font-bold text-[#142B4A]">
                        {admin.full_name}
                      </p>
                      <p className="truncate text-[11px] text-[#64748B]">{admin.email}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleNavClick({ name: 'admin-profile', section: 'profile' })
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleNavClick({ name: 'admin-profile', section: 'password' })
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Change Password</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleNavClick({ name: 'admin-management', section: 'roles' })
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Roles & Permissions</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        handleNavClick({ name: 'admin-management', section: 'settings' })
                      }
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Library Policies</span>
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

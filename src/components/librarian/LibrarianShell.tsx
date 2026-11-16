import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookmarkCheck,
  BookOpenCheck,
  BookPlus,
  CalendarDays,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Megaphone,
  Menu,
  Repeat,
  RotateCcw,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  formatLibrarianCurrentDate,
  getTimeGreeting,
  type LibrarianProfile,
  type LibrarianSectionRoute,
} from '../../utils/librarianDashboard';
import { BrandLogo } from '../BrandLogo';

interface LibrarianShellProps {
  activeRoute: LibrarianSectionRoute;
  librarian: LibrarianProfile;
  unreadAlertsCount: number;
  referenceDate: Date;
  onNavigate: (route: AppRoute) => void;
  onAlertsClick: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface SidebarItem {
  route: LibrarianSectionRoute;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

export function LibrarianShell({
  activeRoute,
  librarian,
  unreadAlertsCount,
  referenceDate,
  onNavigate,
  onAlertsClick,
  onLogout,
  children,
}: LibrarianShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [librarian.avatar_url]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileDrawerOpen(false);
        setProfileMenuOpen(false);
      }
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navItems: SidebarItem[] = [
    {
      route: 'librarian-dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-inventory',
      label: 'Book Inventory',
      icon: <Library className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-add-book',
      label: 'Add New Book',
      icon: <BookPlus className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-issue-books',
      label: 'Issue Books',
      icon: <Repeat className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-return-books',
      label: 'Return Books',
      icon: <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-reservations',
      label: 'Reservations',
      icon: <BookmarkCheck className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-students',
      label: 'Student Records',
      icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-overdue',
      label: 'Overdue Books',
      icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
      badgeCount: unreadAlertsCount > 0 ? unreadAlertsCount : undefined,
    },
    {
      route: 'librarian-announcements',
      label: 'Library Announcements',
      icon: <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-reports',
      label: 'Reports & Analytics',
      icon: <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'librarian-profile',
      label: 'My Profile',
      icon: <User className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleNavClick = (route: AppRoute) => {
    setMobileDrawerOpen(false);
    setProfileMenuOpen(false);
    onNavigate(route);
  };

  const initials = librarian.full_name
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const isUnifiedSubworkspace =
    activeRoute === 'librarian-inventory' ||
    activeRoute === 'librarian-add-book' ||
    activeRoute === 'librarian-issue-books' ||
    activeRoute === 'librarian-return-books' ||
    activeRoute === 'librarian-reservations' ||
    activeRoute === 'librarian-students' ||
    activeRoute === 'librarian-overdue' ||
    activeRoute === 'librarian-announcements' ||
    activeRoute === 'librarian-reports' ||
    activeRoute === 'librarian-profile';

  const greetingTitle =
    activeRoute === 'librarian-dashboard'
      ? `${getTimeGreeting(referenceDate.getHours())}, ${librarian.full_name}`
      : isUnifiedSubworkspace
        ? 'Librarian Operations Workspace'
        : (navItems.find((i) => i.route === activeRoute)?.label ?? 'Librarian Workspace');

  const subtitleText = isUnifiedSubworkspace
    ? `${librarian.full_name} · ${librarian.department_title}`
    : 'Manage your library operations, borrowing activity, book inventory, and student services from one place.';

  const currentDateLabel = formatLibrarianCurrentDate(referenceDate);

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
            aria-label="Close librarian navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav
          aria-label="Librarian sidebar navigation"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavClick({ name: item.route })}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[40px] w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                  isActive
                    ? 'bg-[#142B4A] text-white shadow-xs'
                    : 'text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={isActive ? 'text-[#DBEAFE]' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    className={`font-mono-tabular inline-flex min-w-[20px] shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      isActive ? 'bg-[#2563EB] text-white' : 'bg-[#DBEAFE] text-[#142B4A]'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className="mb-2 rounded-lg bg-[#F5F8FC] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-[#142B4A]">
              {librarian.full_name}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[#DBEAFE] px-1.5 py-0.5 text-[10px] font-semibold text-[#142B4A]">
              <BookOpenCheck className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Staff</span>
            </span>
          </div>
          <p className="font-mono-tabular mt-0.5 truncate text-[11px] text-[#64748B]">
            {librarian.staff_code}
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
          aria-label="Librarian navigation menu"
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

      {/* Main Operations Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open librarian navigation menu"
                aria-expanded={mobileDrawerOpen}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#142B4A] hover:bg-[#F5F8FC] lg:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <span className="font-display truncate text-sm font-bold text-[#142B4A] sm:hidden">
                AI Smart Library · Staff
              </span>

              <div className="hidden min-w-0 sm:block">
                <h1 className="font-display truncate text-xl font-bold tracking-tight text-[#142B4A] lg:text-2xl">
                  {greetingTitle}
                </h1>
                <p className="truncate text-xs text-[#64748B] lg:text-sm">{subtitleText}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Current Date */}
              <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-3 py-2 text-xs font-medium text-[#142B4A] md:inline-flex">
                <CalendarDays className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                <span className="font-mono-tabular whitespace-nowrap">{currentDateLabel}</span>
              </div>

              {/* Alerts Bell */}
              <button
                type="button"
                onClick={onAlertsClick}
                aria-label={
                  unreadAlertsCount > 0
                    ? `Operational alerts (${unreadAlertsCount} active)`
                    : 'Operational alerts'
                }
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadAlertsCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="font-mono-tabular absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-[#2563EB] px-1 text-[10px] font-bold text-white"
                  >
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* Librarian Profile Menu (No Student Links) */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Librarian account menu"
                  className="inline-flex min-h-[40px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white py-1 pr-2.5 pl-1.5 text-left transition-colors hover:border-[#2563EB] cursor-pointer"
                >
                  {!avatarError && librarian.avatar_url ? (
                    <img
                      src={librarian.avatar_url}
                      alt={librarian.full_name}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#142B4A] text-xs font-semibold text-white">
                      {initials || 'LB'}
                    </span>
                  )}
                  <span className="hidden max-w-[140px] truncate text-sm font-medium text-[#142B4A] sm:inline">
                    {librarian.full_name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Librarian account options"
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[#142B4A]">
                        {librarian.full_name}
                      </p>
                      <p className="truncate text-xs text-[#64748B]">{librarian.email}</p>
                      <p className="mt-1 truncate text-[11px] font-medium text-[#2563EB]">
                        {librarian.department_title}
                      </p>
                    </div>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() =>
                        handleNavClick({ name: 'librarian-profile', section: 'profile' })
                      }
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>My Profile</span>
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() =>
                        handleNavClick({ name: 'librarian-profile', section: 'settings' })
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      <span>Account Settings</span>
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() =>
                        handleNavClick({ name: 'librarian-profile', section: 'password' })
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      <span>Change Password</span>
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mb-5 sm:hidden">
            <h1 className="font-display text-xl font-bold tracking-tight text-[#142B4A]">
              {greetingTitle}
            </h1>
            <p className="mt-1 text-xs text-[#64748B]">{subtitleText}</p>
            <p className="font-mono-tabular mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#142B4A]">
              <CalendarDays className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>{currentDateLabel}</span>
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

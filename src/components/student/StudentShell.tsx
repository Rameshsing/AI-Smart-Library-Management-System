import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bookmark,
  BookOpen,
  ChevronDown,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import type { StudentProfile, StudentSectionRoute } from '../../utils/studentDashboard';
import { BrandLogo } from '../BrandLogo';

interface StudentShellProps {
  activeRoute: StudentSectionRoute;
  student: StudentProfile;
  greetingTitle: string;
  subtitle: string;
  unreadNotificationsCount: number;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
  onLogout: () => void;
  onQuickSearchSubmit?: (query: string) => void;
  children: React.ReactNode;
}

interface SidebarNavItem {
  route: StudentSectionRoute;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

export function StudentShell({
  activeRoute,
  student,
  greetingTitle,
  subtitle,
  unreadNotificationsCount,
  onNavigate,
  onLogout,
  onQuickSearchSubmit,
  children,
}: StudentShellProps) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setProfileMenuOpen(false);
        setSearchOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
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

  const navItems: SidebarNavItem[] = [
    {
      route: 'student-dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-search',
      label: 'Search Books',
      icon: <Search className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-recommendations',
      label: 'Recommended for You',
      icon: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-my-books',
      label: 'My Books',
      icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-history',
      label: 'Reading History',
      icon: <History className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-reservations',
      label: 'Reservations',
      icon: <Bookmark className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      route: 'student-notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />,
      badgeCount: unreadNotificationsCount,
    },
    {
      route: 'student-profile',
      label: 'My Profile',
      icon: <User className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleNavSelect = (routeName: StudentSectionRoute) => {
    setMobileDrawerOpen(false);
    setProfileMenuOpen(false);
    onNavigate({ name: routeName });
  };

  const handleHeaderSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onQuickSearchSubmit) {
      onQuickSearchSubmit(searchInput);
    } else {
      onNavigate({ name: 'student-search' });
    }
    setSearchOpen(false);
  };

  const studentInitials = student.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <BrandLogo
            onClick={(e) => {
              e.preventDefault();
              setMobileDrawerOpen(false);
              onNavigate({ name: 'home' });
            }}
          />
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label="Close student navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] lg:hidden cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Student sidebar navigation" className="space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavSelect(item.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[42px] w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                  isActive
                    ? 'bg-[#142B4A] text-white shadow-xs'
                    : 'text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB]'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <span className={isActive ? 'text-[#DBEAFE]' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    className={`font-mono-tabular inline-flex min-w-[20px] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${
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

      <div className="border-t border-slate-200 p-3">
        <div className="mb-2 rounded-lg bg-[#F5F8FC] px-3 py-2.5">
          <p className="truncate text-xs font-semibold text-[#142B4A]">{student.name}</p>
          <p className="font-mono-tabular truncate text-[11px] text-[#64748B]">
            {student.student_code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMobileDrawerOpen(false);
            onLogout();
          }}
          className="flex min-h-[42px] w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
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
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Student navigation menu"
          className="fixed inset-0 z-50 flex lg:hidden"
        >
          <div
            className="fixed inset-0 bg-[#142B4A]/45 backdrop-blur-[1px]"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-slate-200 bg-white shadow-xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                aria-label="Open student navigation menu"
                aria-expanded={mobileDrawerOpen}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[#142B4A] hover:bg-[#F5F8FC] lg:hidden cursor-pointer"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <span className="font-display truncate text-sm font-bold text-[#142B4A] sm:hidden">
                AI Smart Library
              </span>

              <div className="hidden min-w-0 sm:block">
                <h1 className="font-display truncate text-xl font-bold tracking-tight text-[#142B4A] lg:text-2xl">
                  {greetingTitle}
                </h1>
                <p className="truncate text-sm text-[#64748B]">{subtitle}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Quick Search Toggle */}
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                aria-label="Search library books"
                aria-expanded={searchOpen}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>

              {/* Notification Bell with Unread Indicator */}
              <button
                type="button"
                onClick={() => handleNavSelect('student-notifications')}
                aria-label={
                  unreadNotificationsCount > 0
                    ? `Notifications (${unreadNotificationsCount} unread)`
                    : 'Notifications'
                }
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="font-mono-tabular absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded bg-[#2563EB] px-1 text-[10px] font-bold text-white"
                  >
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Student Profile Trigger + Dropdown */}
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Student account menu"
                  className="inline-flex min-h-[40px] items-center gap-2.5 rounded-lg border border-slate-200 bg-white py-1 pr-2.5 pl-1.5 text-left transition-colors hover:border-[#2563EB] cursor-pointer"
                >
                  {!avatarError && student.avatar_url ? (
                    <img
                      src={student.avatar_url}
                      alt={student.name}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#142B4A] text-xs font-semibold text-white">
                      {studentInitials || 'ST'}
                    </span>
                  )}
                  <span className="hidden max-w-[140px] truncate text-sm font-medium text-[#142B4A] sm:inline">
                    {student.name}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Student account options"
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-[#142B4A]">
                        {student.name}
                      </p>
                      <p className="truncate text-xs text-[#64748B]">{student.email}</p>
                    </div>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => handleNavSelect('student-profile')}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>My Profile &amp; Interests</span>
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => handleNavSelect('student-notifications')}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F5F8FC] hover:text-[#2563EB] cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Bell className="h-4 w-4" aria-hidden="true" />
                        <span>Notifications</span>
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <span className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
                          {unreadNotificationsCount}
                        </span>
                      )}
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

          {/* Expandable Top Quick Search Bar */}
          {searchOpen && (
            <div className="border-t border-slate-200 bg-[#F5F8FC] px-4 py-3 sm:px-6 lg:px-8">
              <form
                onSubmit={handleHeaderSearch}
                role="search"
                className="mx-auto flex max-w-3xl items-center gap-2"
              >
                <label htmlFor="student-header-search" className="sr-only">
                  Search library books
                </label>
                <input
                  id="student-header-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search catalog by title, author, or subject..."
                  autoFocus
                  className="min-h-[42px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <div className="mb-5 sm:hidden">
            <h1 className="font-display text-xl font-bold tracking-tight text-[#142B4A]">
              {greetingTitle}
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

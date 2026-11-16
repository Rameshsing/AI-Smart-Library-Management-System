import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { AppRoute } from '../data/libraryData';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

const NAV_ITEMS: Array<{ label: string; sectionId: string }> = [
  { label: 'Home', sectionId: 'home' },
  { label: 'Explore Books', sectionId: 'explore-books' },
  { label: 'Features', sectionId: 'features' },
  { label: 'How It Works', sectionId: 'how-it-works' },
  { label: 'About Us', sectionId: 'about-us' },
];

export function Navbar({ currentRoute, onNavigate }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate({ name: 'home' }, sectionId);
  };

  const handleRouteClick = (route: AppRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <BrandLogo
          onClick={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
            onNavigate({ name: 'home' }, 'home');
          }}
        />

        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#1E293B]"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.sectionId}
              href={`#${item.sectionId}`}
              onClick={(e) => handleLinkClick(e, item.sectionId)}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB] rounded-sm ${
                currentRoute.name === 'books' && item.sectionId === 'explore-books'
                  ? 'text-[#2563EB] font-semibold'
                  : 'text-[#1E293B]'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleRouteClick({ name: 'login' })}
            className="px-3.5 py-2 text-sm font-medium text-[#142B4A] hover:text-[#2563EB] transition-colors duration-150 whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => handleRouteClick({ name: 'signup' })}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.98] transition-all duration-150 whitespace-nowrap shrink-0 rounded-lg shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
          >
            Sign Up
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-[#142B4A] hover:bg-[#F5F8FC] lg:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          id="mobile-navigation-drawer"
          className="border-t border-slate-200 bg-white lg:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6"
          >
            {NAV_ITEMS.map((item) => (
              <a
                key={item.sectionId}
                href={`#${item.sectionId}`}
                onClick={(e) => handleLinkClick(e, item.sectionId)}
                className="flex min-h-[44px] items-center border-b border-slate-100 py-2.5 text-sm font-medium text-[#1E293B] hover:text-[#2563EB]"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={() => handleRouteClick({ name: 'login' })}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-[#142B4A] hover:bg-[#F5F8FC] cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => handleRouteClick({ name: 'signup' })}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

import React from 'react';
import { BrandLogo } from './BrandLogo';
import type { AppRoute } from '../data/libraryData';

interface FooterProps {
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 bg-[#F5F8FC] text-[#1E293B]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-4">
            <BrandLogo
              onClick={(e) => {
                e.preventDefault();
                onNavigate({ name: 'home' }, 'home');
              }}
            />
            <p className="mt-3 text-xs font-semibold tracking-wide text-[#2563EB]">
              Discover. Learn. Grow.
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              An AI-powered smart library management platform helping students discover relevant
              books and assisting librarians with modern catalog and borrowing workflows.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-sm font-semibold text-[#142B4A]">Quick Links</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <a
                  href="#home"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'home' }, 'home');
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="#explore-books"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'home' }, 'explore-books');
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Explore Books
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'home' }, 'features');
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#about-us"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'home' }, 'about-us');
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'contact' });
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Account Links */}
          <div className="lg:col-span-2">
            <h3 className="font-display text-sm font-semibold text-[#142B4A]">Account</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'login' });
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Student Login
                </a>
              </li>
              <li>
                <a
                  href="/signup"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'signup' });
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Student Registration
                </a>
              </li>
              <li>
                <a
                  href="/admin-login"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate({ name: 'admin-login' });
                  }}
                  className="hover:text-[#2563EB] transition-colors"
                >
                  Admin / Librarian Login
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Contact Placeholders */}
          <div className="lg:col-span-4">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#142B4A]">Legal</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <a
                      href="/privacy"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate({ name: 'privacy' });
                      }}
                      className="hover:text-[#2563EB] transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/terms"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate({ name: 'terms' });
                      }}
                      className="hover:text-[#2563EB] transition-colors"
                    >
                      Terms and Conditions
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-display text-sm font-semibold text-[#142B4A]">Contact</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  <li>
                    <span className="block text-xs font-medium text-slate-500">Support Email</span>
                    <span>library-support@smartlibrary.edu</span>
                  </li>
                  <li>
                    <span className="block text-xs font-medium text-slate-500">
                      Main Campus Library
                    </span>
                    <span>National Institute of Digital Engineering</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-8 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>&copy; 2026 AI Smart Library. All Rights Reserved.</p>
          <p>Intelligent Library Management &amp; Personalized Recommendation Platform</p>
        </div>
      </div>
    </footer>
  );
}

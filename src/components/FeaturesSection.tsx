import React from 'react';
import {
  Bell,
  Bookmark,
  BrainCircuit,
  CheckCircle2,
  History,
  LayoutDashboard,
  Repeat,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { PLATFORM_FEATURES, type PlatformFeature } from '../data/libraryData';

function renderFeatureIcon(iconName: PlatformFeature['iconName']) {
  const iconClass = 'h-5 w-5 text-[#2563EB]';
  switch (iconName) {
    case 'search':
      return <Search className={iconClass} aria-hidden="true" />;
    case 'brain':
      return <BrainCircuit className={iconClass} aria-hidden="true" />;
    case 'check-circle':
      return <CheckCircle2 className={iconClass} aria-hidden="true" />;
    case 'bookmark':
      return <Bookmark className={iconClass} aria-hidden="true" />;
    case 'repeat':
      return <Repeat className={iconClass} aria-hidden="true" />;
    case 'bell':
      return <Bell className={iconClass} aria-hidden="true" />;
    case 'history':
      return <History className={iconClass} aria-hidden="true" />;
    case 'layout-dashboard':
      return <LayoutDashboard className={iconClass} aria-hidden="true" />;
    case 'shield-check':
      return <ShieldCheck className={iconClass} aria-hidden="true" />;
  }
}

export function FeaturesSection() {
  return (
    <section
      id="features"
      aria-labelledby="platform-features-heading"
      className="scroll-mt-16 border-y border-slate-200 bg-[#F5F8FC] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
            Built for Students &amp; Librarians
          </p>
          <h2
            id="platform-features-heading"
            className="font-display mt-2 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
          >
            Platform Features
          </h2>
          <p className="mt-2 text-base text-slate-600">
            A unified library management system connecting intelligent search, borrowing workflows,
            and administrative catalog operations.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORM_FEATURES.map((feature) => (
            <div
              key={feature.id}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:shadow-sm"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                {renderFeatureIcon(feature.iconName)}
              </div>
              <h3 className="font-display mt-4 text-base font-semibold text-[#142B4A]">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

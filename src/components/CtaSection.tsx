import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { AppRoute } from '../data/libraryData';

interface CtaSectionProps {
  onNavigate: (route: AppRoute) => void;
}

export function CtaSection({ onNavigate }: CtaSectionProps) {
  return (
    <section aria-labelledby="cta-heading" className="bg-[#142B4A] py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-wide text-[#DBEAFE]">
          Discover. Learn. Grow.
        </p>
        <h2
          id="cta-heading"
          className="font-display mx-auto mt-3 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-4xl [text-wrap:balance]"
        >
          Your Next Learning Journey Starts Here
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-300">
          Join AI Smart Library and discover books selected around your interests.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate({ name: 'signup' })}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            <span>Create Student Account</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'books' })}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-[#DBEAFE]" aria-hidden="true" />
            <span>Explore Library</span>
          </button>
        </div>
      </div>
    </section>
  );
}

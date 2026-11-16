import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Search, Sparkles } from 'lucide-react';
import { HERO_LIBRARY_IMAGE, type AppRoute } from '../data/libraryData';

interface HeroSectionProps {
  searchQuery: string;
  onSearchSubmit: (query: string) => void;
  onNavigate: (route: AppRoute, sectionId?: string) => void;
}

export function HeroSection({
  searchQuery,
  onSearchSubmit,
  onNavigate,
}: HeroSectionProps) {
  const [localInput, setLocalInput] = useState(searchQuery);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setLocalInput(searchQuery);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearchSubmit(localInput);
  };

  return (
    <section
      id="home"
      className="relative overflow-hidden bg-white pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Value Proposition, Search & Primary Actions */}
          <div className="flex flex-col justify-center lg:col-span-6">
            <div className="mb-5 inline-flex items-center gap-2 self-start rounded-md border border-[#DBEAFE] bg-[#F5F8FC] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#142B4A]">
              <Sparkles className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
              <span>AI-Powered Smart Library</span>
            </div>

            <h1
              className="font-display font-bold tracking-tight text-[#142B4A] [text-wrap:balance]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.35rem)', lineHeight: 1.12 }}
            >
              Discover Your Next Favourite Book with AI
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Explore thousands of learning resources, discover books tailored to your interests,
              and enjoy a smarter library experience. Your next great read is just one search away.
            </p>

            {/* Prominent Book Search Field */}
            <form
              onSubmit={handleSubmit}
              role="search"
              aria-label="Search library books"
              className="mt-8"
            >
              <label htmlFor="hero-book-search" className="sr-only">
                Search by book title, author or category
              </label>
              <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition-shadow focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-[#DBEAFE] sm:flex-row sm:items-center">
                <div className="relative flex flex-1 items-center">
                  <Search
                    className="pointer-events-none ml-2.5 h-5 w-5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-book-search"
                    type="search"
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    placeholder="Search by book title, author or category..."
                    className="min-h-[44px] w-full bg-transparent px-3 py-2 text-sm text-[#1E293B] placeholder:text-slate-400 focus:outline-none sm:text-base"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#142B4A] px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#1E3A63] active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
                >
                  Search
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Try searching demo titles such as &ldquo;Algorithms&rdquo;, &ldquo;Data Science&rdquo;, or &ldquo;Vance&rdquo;.
              </p>
            </form>

            {/* Primary & Secondary CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => onNavigate({ name: 'signup' })}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate({ name: 'books' })}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#142B4A] transition-colors duration-150 hover:border-[#2563EB] hover:bg-[#F5F8FC] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                <span>Explore Books</span>
              </button>
            </div>
          </div>

          {/* Right Column: Editorial Library Visual */}
          <div className="flex flex-col lg:col-span-6">
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#F5F8FC] shadow-sm">
              <div className="relative flex-1 min-h-[280px] overflow-hidden lg:min-h-[380px]">
                {!imgError ? (
                  <img
                    src={HERO_LIBRARY_IMAGE}
                    alt="Modern university smart library interior with students using digital discovery kiosks and oak bookshelves"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-[#F5F8FC] p-8 text-center">
                    <BookOpen className="h-12 w-12 text-[#2563EB]" aria-hidden="true" />
                    <p className="mt-3 font-display text-lg font-semibold text-[#142B4A]">
                      AI Smart Library
                    </p>
                    <p className="mt-1 text-sm text-slate-500">Discover. Learn. Grow.</p>
                  </div>
                )}
              </div>

              {/* Grounded caption bar inside visual frame */}
              <div className="shrink-0 border-t border-slate-200/80 bg-white px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-[#142B4A]">
                    Discover. Learn. Grow.
                  </span>
                  <span>Catalog search · Real-time availability · Personalized discovery</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { useState } from 'react';
import { BookOpen, GraduationCap, Library } from 'lucide-react';
import { ABOUT_LIBRARY_IMAGE } from '../data/libraryData';

export function AboutSection() {
  const [imgError, setImgError] = useState(false);

  return (
    <section
      id="about-us"
      aria-labelledby="about-us-heading"
      className="scroll-mt-16 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Supporting Image */}
          <div className="order-2 flex flex-col lg:order-1 lg:col-span-6">
            <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-[#F5F8FC] shadow-sm">
              {!imgError ? (
                <img
                  src={ABOUT_LIBRARY_IMAGE}
                  alt="Students studying with books and laptops while a librarian assists at a modern academic library desk"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full min-h-[280px] w-full object-cover lg:min-h-[380px]"
                />
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-[#F5F8FC] p-8 text-center">
                  <Library className="h-10 w-10 text-[#2563EB]" aria-hidden="true" />
                  <p className="mt-3 font-display text-base font-semibold text-[#142B4A]">
                    Modern Academic Library Operations
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: About Narrative */}
          <div className="order-1 flex flex-col justify-center lg:order-2 lg:col-span-6">
            <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
              About AI Smart Library
            </p>
            <h2
              id="about-us-heading"
              className="font-display mt-2 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
            >
              A Smarter Way to Experience Your Library
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              AI Smart Library combines modern library management with intelligent book discovery.
              Our goal is to make learning resources easier to discover while helping librarians
              manage library operations efficiently.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                  <GraduationCap className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold text-[#142B4A]">
                    Student-Centered Discovery
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Helps learners locate course textbooks, research references, and interdisciplinary
                    titles faster.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                  <BookOpen className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold text-[#142B4A]">
                    Organized Library Workflows
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Supports inventory visibility, reservation tracking, and structured MySQL catalog
                    administration.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

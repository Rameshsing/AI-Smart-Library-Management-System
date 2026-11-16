import React from 'react';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { RECOMMENDATION_ELEMENTS, type AppRoute } from '../data/libraryData';

interface RecommendationsSectionProps {
  onNavigate: (route: AppRoute) => void;
}

export function RecommendationsSection({ onNavigate }: RecommendationsSectionProps) {
  return (
    <section
      aria-labelledby="recommendations-heading"
      className="border-y border-slate-200 bg-[#F5F8FC] py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
          {/* Left Explanatory Column */}
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
              Intelligent Book Discovery
            </p>
            <h2
              id="recommendations-heading"
              className="font-display mt-2 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
            >
              Books That Match Your Interests
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Our intelligent recommendation engine understands your reading interests, learning
              preferences, reading history and feedback to help you discover relevant books.
            </p>

            {/* Student Account Requirement Notice */}
            <div className="mt-6 rounded-xl border border-[#DBEAFE] bg-white p-4">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" aria-hidden="true" />
                <div className="text-sm text-slate-700">
                  <p className="font-semibold text-[#142B4A]">Student Account Required</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Personalized AI recommendations require a registered student account so the
                    content-based and hybrid filtering engine can tailor picks to your profile.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7">
              <button
                type="button"
                onClick={() => onNavigate({ name: 'recommendations' })}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-xs transition-all duration-150 hover:bg-[#1D4ED8] active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#142B4A] cursor-pointer"
              >
                <span>Explore Smart Recommendations</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right Four Recommendation Pillars */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
            {RECOMMENDATION_ELEMENTS.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs transition-colors duration-150 hover:border-[#2563EB]/40"
              >
                <div>
                  <span className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
                    {item.number}.
                  </span>
                  <h3 className="font-display mt-2 text-lg font-semibold text-[#142B4A]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <Info className="h-3.5 w-3.5 text-[#2563EB]" aria-hidden="true" />
                  <span>Powered by Python &amp; Pandas filtering</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

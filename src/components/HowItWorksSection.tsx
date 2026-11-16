import React from 'react';
import { BookOpen, Search, Sparkles, UserPlus } from 'lucide-react';
import { HOW_IT_WORKS_STEPS, type WorkflowStep } from '../data/libraryData';

function renderStepIcon(iconName: WorkflowStep['iconName']) {
  const iconClass = 'h-5 w-5 text-[#2563EB]';
  switch (iconName) {
    case 'user-plus':
      return <UserPlus className={iconClass} aria-hidden="true" />;
    case 'search':
      return <Search className={iconClass} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className={iconClass} aria-hidden="true" />;
    case 'book-open':
      return <BookOpen className={iconClass} aria-hidden="true" />;
  }
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="scroll-mt-16 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-[#2563EB]">
            Simple Academic Workflow
          </p>
          <h2
            id="how-it-works-heading"
            className="font-display mt-2 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
          >
            How It Works
          </h2>
          <p className="mt-2 text-base text-slate-600">
            Four clear steps from creating your student reading profile to borrowing books on campus.
          </p>
        </div>

        <div className="relative mt-12">
          {/* Desktop horizontal connector line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-11 right-12 left-12 hidden h-px bg-slate-200 lg:block"
          />

          <ol className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((step) => (
              <li
                key={step.stepNumber}
                className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC]">
                    {renderStepIcon(step.iconName)}
                  </span>
                  <span className="font-mono-tabular text-xs font-semibold text-slate-500">
                    Step {step.stepNumber}
                  </span>
                </div>

                <h3 className="font-display mt-5 text-lg font-semibold text-[#142B4A]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

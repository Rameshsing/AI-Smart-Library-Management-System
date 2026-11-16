import React from 'react';
import { DEMO_LIBRARY_METRICS } from '../data/libraryData';

export function LibraryStatsSection() {
  return (
    <section
      aria-labelledby="library-stats-heading"
      className="border-y border-slate-200 bg-[#F5F8FC] py-10 sm:py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2
              id="library-stats-heading"
              className="font-display text-lg font-semibold text-[#142B4A]"
            >
              Library Overview
            </h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              Demo placeholder metrics shown below — live statistics will populate directly from the MySQL library database.
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-medium text-slate-500">
            Sample Preview Data
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_LIBRARY_METRICS.map((metric) => (
            <div
              key={metric.id}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-600">{metric.label}</span>
                <span className="text-[11px] font-medium text-[#2563EB]">Demo</span>
              </div>
              <p className="font-mono-tabular mt-2 text-3xl font-bold tracking-tight text-[#142B4A]">
                {metric.demoValue}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">{metric.placeholderNote}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

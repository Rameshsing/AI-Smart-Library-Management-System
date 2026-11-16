import React from 'react';
import { ArrowRight, BarChart3, BookOpen, Clock, Sparkles, TrendingUp } from 'lucide-react';
import type { AppRoute } from '../../data/libraryData';
import {
  buildChartAccessibleSummary,
  type ReadingActivityChartPoint,
  type ReadingInsightsData,
} from '../../utils/readingHistory';

interface ReadingHistoryInsightsProps {
  insights: ReadingInsightsData;
  monthlyActivity: ReadingActivityChartPoint[];
  onNavigate: (route: AppRoute) => void;
}

export function ReadingHistoryInsights({
  insights,
  monthlyActivity,
  onNavigate,
}: ReadingHistoryInsightsProps) {
  const maxChartCount = Math.max(1, ...monthlyActivity.map((pt) => pt.count));
  const accessibleChartSummary = buildChartAccessibleSummary(monthlyActivity);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Your Reading Insights */}
        <section
          data-testid="reading-insights-section"
          aria-labelledby="reading-insights-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2
                id="reading-insights-heading"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                Your Reading Insights
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Patterns derived directly from your completed borrowing records.
              </p>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          {!insights.has_sufficient_data ? (
            <div className="mt-5 rounded-xl border border-slate-200 bg-[#F5F8FC] p-6 text-center">
              <BookOpen className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="mt-2.5 text-sm font-semibold text-[#142B4A]">
                Insufficient history for insights yet
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Borrow and return at least two books to calculate favourite subjects, authors, and
                average loan duration reliably.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {/* Key Reading Metrics */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-3.5">
                  <p className="text-[11px] font-semibold text-[#64748B]">Reading Frequency</p>
                  <p className="font-mono-tabular mt-1 text-xl font-bold text-[#142B4A]">
                    {insights.total_completed}{' '}
                    <span className="text-xs font-medium text-[#64748B]">books</span>
                  </p>
                </div>

                {insights.average_loan_duration_days !== null && (
                  <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-3.5">
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64748B]">
                      <Clock className="h-3 w-3 text-[#2563EB]" aria-hidden="true" />
                      <span>Avg Loan Duration</span>
                    </p>
                    <p className="font-mono-tabular mt-1 text-xl font-bold text-[#142B4A]">
                      {insights.average_loan_duration_days}{' '}
                      <span className="text-xs font-medium text-[#64748B]">days</span>
                    </p>
                  </div>
                )}

                {insights.most_active_period && (
                  <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-3.5">
                    <p className="text-[11px] font-semibold text-[#64748B]">Most Active Period</p>
                    <p className="font-display mt-1 text-base font-bold text-[#142B4A]">
                      {insights.most_active_period.label}
                    </p>
                    <p className="font-mono-tabular text-[11px] text-[#64748B]">
                      {insights.most_active_period.count}{' '}
                      {insights.most_active_period.count === 1 ? 'book' : 'books'}
                    </p>
                  </div>
                )}
              </div>

              {/* Ranked Subjects / Categories / Authors */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <InsightRankList title="Favourite Subjects" items={insights.favourite_subjects} />
                <InsightRankList title="Favourite Categories" items={insights.favourite_categories} />
                <InsightRankList title="Favourite Authors" items={insights.favourite_authors} />
              </div>
            </div>
          )}
        </section>

        {/* Books Borrowed Over Time Chart */}
        <section
          data-testid="reading-activity-chart"
          aria-labelledby="reading-activity-chart-heading"
          className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2
                id="reading-activity-chart-heading"
                className="font-display text-lg font-bold text-[#142B4A]"
              >
                Books Borrowed Over Time
              </h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Monthly completed and returned borrowing volume.
              </p>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] text-[#2563EB]">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>

          {monthlyActivity.length === 0 ? (
            <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] p-8 text-center">
              <p className="text-sm font-semibold text-[#142B4A]">No monthly chart data yet</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Your monthly reading timeline will populate once books are borrowed and returned.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
              <div
                role="img"
                aria-label={accessibleChartSummary}
                className="rounded-xl border border-slate-200 bg-[#F5F8FC]/60 p-4 sm:p-5"
              >
                <div className="grid grid-cols-6 items-end gap-2.5 sm:gap-4 pt-3">
                  {monthlyActivity.map((point) => {
                    const heightPct =
                      point.count === 0 ? 0 : Math.max(14, Math.round((point.count / maxChartCount) * 100));
                    return (
                      <div key={point.key} className="flex flex-col items-center gap-2">
                        <span className="font-mono-tabular text-xs font-semibold text-[#142B4A]">
                          {point.count}
                        </span>
                        <div className="flex h-32 w-full max-w-[44px] items-end rounded-md bg-slate-200/75 p-1">
                          {point.count > 0 ? (
                            <div
                              className="w-full rounded bg-[#2563EB] transition-all duration-200"
                              style={{ height: `${heightPct}%` }}
                              title={`${point.month}: ${point.count} ${point.count === 1 ? 'book' : 'books'}`}
                            />
                          ) : (
                            <div className="h-1 w-full rounded bg-slate-300" />
                          )}
                        </div>
                        <span className="text-xs font-medium text-[#64748B]">{point.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-[#64748B]">
                <strong className="font-semibold text-[#142B4A]">Activity summary:</strong>{' '}
                {accessibleChartSummary}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Recommendation Engine Connection */}
      <section
        data-testid="history-recommendation-connection"
        aria-labelledby="rec-connection-heading"
        className="rounded-xl border border-[#DBEAFE] bg-white p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>AI Recommendation Feedback Loop</span>
            </div>

            <h2
              id="rec-connection-heading"
              className="font-display text-lg font-bold text-[#142B4A]"
            >
              Your reading history improves your recommendations
            </h2>

            <p className="text-xs leading-relaxed text-[#1E293B]">
              Completed borrowing records help the library recommender recognise books you have
              already read, preferred subjects, categories, frequent authors, reading cadence, and
              rating behaviour. These signals combine with your saved interests, anonymised
              aggregated preferences of similar students, book metadata, and live copy availability—while
              lowering priority for completed books unless you revisit them or a strong reference
              match applies.
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate({ name: 'student-recommendations' })}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
            >
              <span>View Recommended Books</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function InsightRankList({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-[#F5F8FC]/50 p-3.5">
      <h3 className="text-xs font-semibold text-[#142B4A]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[#64748B]">Not enough data</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {items.map((item) => (
            <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-[#1E293B]" title={item.name}>
                {item.name}
              </span>
              <span className="font-mono-tabular shrink-0 font-semibold text-[#2563EB]">
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import {
  getRecommendationSourceLabel,
  type RecommendationItem,
} from '../../utils/recommendationsPage';

interface RecommendationExplainModalProps {
  item: RecommendationItem | null;
  onClose: () => void;
  onViewDetails: (bookId: number) => void;
}

export function RecommendationExplainModal({
  item,
  onClose,
  onViewDetails,
}: RecommendationExplainModalProps) {
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const sourceLabel = getRecommendationSourceLabel(item.recommendation_source);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-[#142B4A]/50 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#142B4A]">
              <Sparkles className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
            </span>
            <h2 id="explain-modal-title" className="font-display text-lg font-bold text-[#142B4A]">
              Why We Recommended This
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recommendation explanation modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-slate-200 bg-[#F5F8FC] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-md border border-[#DBEAFE] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-[#142B4A]">
                {sourceLabel}
              </span>
              {item.recommendation_score !== null && (
                <span className="font-mono-tabular text-xs font-semibold text-[#2563EB]">
                  {Math.round(item.recommendation_score * 100)}% relevance match
                </span>
              )}
            </div>
            <h3 className="font-display mt-2.5 text-base font-bold text-[#142B4A]">
              {item.title}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-[#64748B]">
              by {item.author} · {item.category}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Matching factors from your library profile
            </p>
            <ul className="mt-2.5 space-y-2">
              {item.explanation_factors.map((factor, idx) => (
                <li
                  key={`${item.book_id}-factor-${idx}`}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm text-[#1E293B]"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
                    aria-hidden="true"
                  />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-[#64748B]">
            Your feedback on this card helps the library recommendation service adjust future book
            suggestions for your subjects and reading pace.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-[#F5F8FC] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              const bookId = item.book_id;
              onClose();
              onViewDetails(bookId);
            }}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  HelpCircle,
  Star,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type {
  RecommendationFeedbackValue,
  RecommendationItem,
} from '../../utils/recommendationsPage';

interface RecommendationCardProps {
  item: RecommendationItem;
  sectionId: string;
  onViewDetails: (bookId: number) => void;
  onOpenExplain: (item: RecommendationItem) => void;
  onFeedback: (bookId: number, feedback: RecommendationFeedbackValue) => void;
}

export function RecommendationCard({
  item,
  sectionId,
  onViewDetails,
  onOpenExplain,
  onFeedback,
}: RecommendationCardProps) {
  const [imageError, setImageError] = useState(false);

  const availabilityBadge = item.is_available
    ? {
        className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
        label: item.availability_detail || 'Available',
      }
    : item.total_copies > 0
      ? {
          className: 'border-amber-200 bg-amber-50 text-amber-800',
          icon: <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
          label: 'Currently Issued · Reserve',
        }
      : {
          className: 'border-slate-200 bg-slate-100 text-slate-700',
          icon: <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
          label: 'Unavailable',
        };

  return (
    <article
      data-testid={`rec-card-${sectionId}-${item.book_id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-150 hover:border-[#2563EB]/50 hover:shadow-sm"
    >
      {/* Book Cover */}
      <button
        type="button"
        onClick={() => onViewDetails(item.book_id)}
        aria-label={`View details for ${item.title}`}
        className="relative flex h-48 w-full items-center justify-center border-b border-slate-100 bg-[#F5F8FC] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563EB] cursor-pointer"
      >
        {!imageError ? (
          <img
            src={item.cover_image}
            alt={`Cover of ${item.title}`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-auto max-w-full rounded object-contain shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-36 w-26 flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-3 text-center text-white shadow-xs">
            <BookOpen className="h-6 w-6 text-[#DBEAFE]" aria-hidden="true" />
            <span className="mt-2 line-clamp-3 text-[11px] font-semibold leading-tight">
              {item.title}
            </span>
          </div>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${availabilityBadge.className}`}
          >
            {availabilityBadge.icon}
            <span>{availabilityBadge.label}</span>
          </span>
          {item.recommendation_score !== null ? (
            <span className="font-mono-tabular text-[11px] font-semibold text-[#2563EB]">
              {Math.round(item.recommendation_score * 100)}% match
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#64748B]">{item.format}</span>
          )}
        </div>

        <p className="mt-2.5 truncate text-xs font-medium text-[#2563EB]">
          {item.category}
          {item.subject && item.subject !== item.category ? ` · ${item.subject}` : ''}
        </p>

        <h3 className="font-display mt-1">
          <button
            type="button"
            onClick={() => onViewDetails(item.book_id)}
            className="line-clamp-2 text-left text-base font-bold leading-snug text-[#142B4A] transition-colors hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            {item.title}
          </button>
        </h3>

        <p className="mt-1 truncate text-xs font-medium text-[#64748B]">{item.author}</p>

        {/* Community Rating + Optional Student Rating */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {item.rating_count > 0 ? (
            <>
              <span className="font-mono-tabular inline-flex items-center gap-1 font-semibold text-[#142B4A]">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                {item.rating.toFixed(1)}
              </span>
              <span className="text-[#64748B]">
                ({item.rating_count} {item.rating_count === 1 ? 'rating' : 'ratings'})
              </span>
            </>
          ) : (
            <span className="text-[#64748B]">No ratings yet</span>
          )}

          {typeof item.student_user_rating === 'number' && item.student_user_rating > 0 && (
            <span className="font-mono-tabular inline-flex items-center gap-1 rounded border border-[#DBEAFE] bg-[#F5F8FC] px-1.5 py-0.5 text-[11px] font-semibold text-[#142B4A]">
              Your rating: {'★'.repeat(Math.round(item.student_user_rating))}
            </span>
          )}
        </div>

        {/* Recommendation Reason + Explain Trigger */}
        <div className="mt-3 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-3 py-2.5">
          <p className="line-clamp-2 text-xs leading-relaxed text-[#142B4A]">
            {item.recommendation_reason}
          </p>
          <button
            type="button"
            onClick={() => onOpenExplain(item)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Why this book?</span>
          </button>
        </div>

        {/* Lightweight Feedback + View Details */}
        <div className="mt-auto pt-3.5">
          <div className="mb-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
            <span className="text-[11px] text-[#64748B]">Useful pick?</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onFeedback(item.book_id, 'useful')}
                aria-label={`Mark ${item.title} useful`}
                aria-pressed={item.feedback === 'useful'}
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors cursor-pointer ${
                  item.feedback === 'useful'
                    ? 'border-[#2563EB] bg-[#DBEAFE]/70 text-[#142B4A]'
                    : 'border-slate-200 bg-white text-[#64748B] hover:border-[#2563EB] hover:text-[#142B4A]'
                }`}
              >
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(item.book_id, 'not_useful')}
                aria-label={`Mark ${item.title} not useful`}
                aria-pressed={item.feedback === 'not_useful'}
                className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors cursor-pointer ${
                  item.feedback === 'not_useful'
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-[#64748B] hover:border-slate-300 hover:text-[#142B4A]'
                }`}
              >
                <ThumbsDown className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(item.book_id, 'not_interested')}
                aria-label={`Not interested in ${item.title}`}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-[#64748B] transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 cursor-pointer"
              >
                <XCircle className="h-3 w-3" aria-hidden="true" />
                <span>Hide</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onViewDetails(item.book_id)}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-4 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:bg-[#2563EB] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function RecommendationsSkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div
      aria-label="Finding books for you"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white animate-pulse"
        >
          <div className="h-48 bg-slate-100" />
          <div className="space-y-3 p-4">
            <div className="flex justify-between">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="h-4 w-14 rounded bg-slate-100" />
            </div>
            <div className="h-3 w-32 rounded bg-slate-100" />
            <div className="h-5 w-full rounded bg-slate-200" />
            <div className="h-10 w-full rounded bg-slate-100" />
            <div className="h-9 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Star,
} from 'lucide-react';
import {
  validateReviewInput,
  type BookReviewRecord,
  type RatingBreakdownItem,
  type StudentBookEligibility,
} from '../../utils/bookDetails';

interface BookRatingsSectionProps {
  ratingAverage: number;
  ratingCount: number;
  distribution: RatingBreakdownItem[];
  reviews: BookReviewRecord[];
  eligibility: StudentBookEligibility;
  isSubmittingReview: boolean;
  reviewError: string | null;
  onSubmitReview: (rating: number, reviewText: string) => void;
}

export function BookRatingsSection({
  ratingAverage,
  ratingCount,
  distribution,
  reviews,
  eligibility,
  isSubmittingReview,
  reviewError,
  onSubmitReview,
}: BookRatingsSectionProps) {
  const [selectedRating, setSelectedRating] = useState<number>(
    eligibility.existing_review?.rating ?? 0
  );
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>(
    eligibility.existing_review?.review ?? ''
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(2);

  const handleReviewSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = validateReviewInput(selectedRating, reviewText, false);
    if (!result.valid) {
      setValidationError(result.error ?? 'Please select a valid star rating.');
      return;
    }
    setValidationError(null);
    onSubmitReview(selectedRating, reviewText.trim());
  };

  const displayedRating = hoverRating || selectedRating;
  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMoreReviews = visibleCount < reviews.length;

  return (
    <section
      aria-labelledby="student-ratings-heading"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="border-b border-slate-100 pb-4">
        <h2 id="student-ratings-heading" className="font-display text-lg font-bold text-[#142B4A]">
          Student Ratings &amp; Reviews
        </h2>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Ratings come from student borrowing history and help refine AI book recommendations.
        </p>
      </div>

      {/* Summary + Distribution + Rate Form */}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Rating Summary & Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-[#F5F8FC]/70 p-5 lg:col-span-5">
          <p className="text-xs font-semibold text-[#64748B]">Student Ratings</p>
          {ratingCount > 0 ? (
            <>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono-tabular text-3xl font-bold text-[#142B4A]">
                  {ratingAverage.toFixed(1)}
                </span>
                <span className="font-mono-tabular text-sm font-medium text-[#64748B]">/ 5</span>
              </div>

              <div className="mt-2 flex items-center gap-1" aria-label={`Rated ${ratingAverage.toFixed(1)} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(ratingAverage)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-300'
                    }`}
                    aria-hidden="true"
                  />
                ))}
                <span className="ml-2 text-xs font-medium text-[#64748B]">
                  {ratingCount.toLocaleString()} {ratingCount === 1 ? 'rating' : 'ratings'}
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {distribution.map((row) => (
                  <div key={row.stars} className="flex items-center gap-2.5 text-xs">
                    <span className="font-mono-tabular flex w-9 shrink-0 items-center gap-1 font-semibold text-[#142B4A]">
                      {row.stars}
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500" aria-hidden="true" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#2563EB]"
                        style={{ width: `${row.percentage}%` }}
                      />
                    </div>
                    <span className="font-mono-tabular w-9 text-right text-[11px] text-[#64748B]">
                      {row.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 py-4">
              <p className="text-sm font-semibold text-[#142B4A]">No ratings yet</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Be the first student borrower to rate and review this title after returning it.
              </p>
            </div>
          )}
        </div>

        {/* Submit / Edit Review Box */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7">
          <h3 className="font-display text-sm font-bold text-[#142B4A]">
            {eligibility.existing_review ? 'Update Your Review' : 'Rate This Book'}
          </h3>

          {eligibility.can_review ? (
            <form onSubmit={handleReviewSubmit} className="mt-3 space-y-4">
              <div>
                <span className="block text-xs font-medium text-[#64748B]">
                  Your Star Rating <span className="text-red-600">*</span>
                </span>
                <div
                  role="radiogroup"
                  aria-label="Rate this book from 1 to 5 stars"
                  className="mt-1.5 flex items-center gap-1.5"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={selectedRating === star}
                      aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => {
                        setSelectedRating(star);
                        setValidationError(null);
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F8FC] transition-colors hover:border-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= displayedRating
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-slate-300'
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                  {selectedRating > 0 && (
                    <span className="font-mono-tabular ml-2 text-xs font-semibold text-[#142B4A]">
                      {selectedRating} / 5
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="book-review-textarea"
                  className="block text-xs font-medium text-[#64748B]"
                >
                  Review (optional)
                </label>
                <textarea
                  id="book-review-textarea"
                  rows={3}
                  maxLength={1000}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write your review..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
                />
              </div>

              {(validationError || reviewError) && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                  <span>{validationError ?? reviewError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60 cursor-pointer"
              >
                {isSubmittingReview && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>
                  {eligibility.existing_review ? 'Save Review Changes' : 'Submit Review'}
                </span>
              </button>
            </form>
          ) : (
            <div className="mt-3 rounded-lg border border-slate-200 bg-[#F5F8FC] p-4 text-xs leading-relaxed text-[#64748B]">
              {eligibility.review_ineligible_reason ??
                'Ratings and reviews are available once you have borrowed and returned this book.'}
            </div>
          )}
        </div>
      </div>

      {/* Student Reviews List */}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold text-[#142B4A]">
            Recent Student Reviews
          </h3>
          <span className="font-mono-tabular text-xs text-[#64748B]">
            {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </span>
        </div>

        {reviews.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] px-6 py-8 text-center">
            <MessageSquare className="h-7 w-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-[#142B4A]">No written reviews yet</p>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Student borrower reviews will appear here as readers share feedback.
            </p>
          </div>
        ) : (
          <>
            <ul className="mt-4 divide-y divide-slate-100">
              {visibleReviews.map((item) => (
                <li key={item.review_id} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-semibold text-[#142B4A]">
                        {item.reviewer_display}
                      </span>
                      {item.verified_borrower && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Verified Borrower</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#64748B]">{item.relative_date}</span>
                  </div>

                  <div
                    className="mt-1.5 flex items-center gap-0.5"
                    aria-label={`Rated ${item.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= item.rating
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-slate-300'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-[#1E293B]">
                    &ldquo;{item.review}&rdquo;
                  </p>
                </li>
              ))}
            </ul>

            {hasMoreReviews && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 4)}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
                >
                  Load More Reviews
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

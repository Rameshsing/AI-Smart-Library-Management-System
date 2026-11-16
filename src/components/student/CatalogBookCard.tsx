import React, { useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Star,
} from 'lucide-react';
import { getBookAvailabilityInfo, type CatalogBook } from '../../utils/bookCatalog';

interface CatalogBookCardProps {
  book: CatalogBook;
  onOpenDetails: (bookId: number) => void;
}

export function CatalogBookCard({ book, onOpenDetails }: CatalogBookCardProps) {
  const [imageError, setImageError] = useState(false);
  const availability = getBookAvailabilityInfo(book);

  const availabilityConfig =
    availability.status === 'available'
      ? {
          badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
        }
      : availability.status === 'reserved'
        ? {
            badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
            icon: <Bookmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
          }
        : {
            badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
            icon: <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
          };

  return (
    <article
      data-testid={`catalog-book-card-${book.book_id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-150 hover:border-[#2563EB]/50 hover:shadow-sm"
    >
      {/* Clickable Cover Area */}
      <button
        type="button"
        onClick={() => onOpenDetails(book.book_id)}
        aria-label={`View details for ${book.title}`}
        className="relative flex h-52 w-full items-center justify-center border-b border-slate-100 bg-[#F5F8FC] p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2563EB] cursor-pointer"
      >
        {!imageError ? (
          <img
            src={book.cover_image}
            alt={`Cover of ${book.title}`}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-auto max-w-full rounded object-contain shadow-xs transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-40 w-28 flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-3 text-center text-white shadow-xs">
            <BookOpen className="h-7 w-7 text-[#DBEAFE]" aria-hidden="true" />
            <span className="mt-2 line-clamp-3 text-[11px] font-semibold leading-tight">
              {book.title}
            </span>
          </div>
        )}
      </button>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Availability + Format */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${availabilityConfig.badgeClass}`}
          >
            {availabilityConfig.icon}
            <span>{availability.label}</span>
          </span>
          <span className="text-[11px] font-medium text-[#64748B]">{book.format}</span>
        </div>

        {/* Category & Subject */}
        <p className="mt-3 truncate text-xs font-medium text-[#2563EB]">
          {book.category}
          {book.subject && book.subject !== book.category ? ` · ${book.subject}` : ''}
        </p>

        {/* Clickable Title */}
        <h3 className="font-display mt-1">
          <button
            type="button"
            onClick={() => onOpenDetails(book.book_id)}
            className="line-clamp-2 text-left text-base font-bold leading-snug text-[#142B4A] transition-colors hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            {book.title}
          </button>
        </h3>

        <p className="mt-1 truncate text-xs font-medium text-[#64748B]">{book.author}</p>

        {/* Rating & Review Count */}
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {book.rating_count > 0 ? (
            <>
              <span className="font-mono-tabular inline-flex items-center gap-1 font-semibold text-[#142B4A]">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                {book.rating_average.toFixed(1)}
              </span>
              <span className="text-[#64748B]">
                ({book.rating_count} {book.rating_count === 1 ? 'rating' : 'ratings'}
                {book.review_count > 0 ? ` · ${book.review_count} reviews` : ''})
              </span>
            </>
          ) : (
            <span className="text-[#64748B]">No ratings yet</span>
          )}
        </div>

        {/* Description */}
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-[#64748B]">
          {book.description}
        </p>

        {/* Metadata + View Details */}
        <div className="mt-auto pt-4">
          <div className="mb-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-[#64748B]">
            <span>{book.language}</span>
            <span className="font-mono-tabular">Published {book.publication_year}</span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetails(book.book_id)}
            className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[#F5F8FC] px-4 py-2 text-xs font-semibold text-[#142B4A] transition-colors hover:border-[#2563EB] hover:bg-[#2563EB] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function CatalogSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-label="Loading library books"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white animate-pulse"
        >
          <div className="h-52 bg-slate-100" />
          <div className="space-y-3 p-4">
            <div className="flex justify-between">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
            <div className="h-3 w-28 rounded bg-slate-100" />
            <div className="h-5 w-full rounded bg-slate-200" />
            <div className="h-3.5 w-3/4 rounded bg-slate-100" />
            <div className="h-10 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

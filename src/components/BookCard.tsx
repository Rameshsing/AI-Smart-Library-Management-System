import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { DemoBook } from '../data/libraryData';

interface BookCardProps {
  book: DemoBook;
  onViewDetails: (slug: string) => void;
}

export function BookCard({ book, onViewDetails }: BookCardProps) {
  const [imgError, setImgError] = useState(false);

  const availabilityMeta = (() => {
    switch (book.status) {
      case 'Available':
        return {
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />,
          textClass: 'text-emerald-800',
          label: `Available (${book.availableCopies} of ${book.totalCopies} copies)`,
        };
      case 'Limited':
        return {
          icon: <AlertCircle className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />,
          textClass: 'text-amber-800',
          label: `Limited (${book.availableCopies} copy left)`,
        };
      case 'Checked Out':
        return {
          icon: <Clock className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />,
          textClass: 'text-slate-700',
          label: 'Checked Out (Waitlist)',
        };
    }
  })();

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-[#2563EB]/40 hover:shadow-md">
      {/* Book Cover Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-slate-100 bg-[#F5F8FC] p-4 flex items-center justify-center">
        {!imgError ? (
          <img
            src={book.coverImage}
            alt={`Cover of ${book.title} by ${book.author}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-auto max-w-full rounded-md object-contain shadow-sm transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-gradient-to-br from-[#142B4A] to-[#2563EB] p-4 text-center text-white">
            <BookOpen className="h-8 w-8 text-[#DBEAFE]" aria-hidden="true" />
            <p className="mt-2 line-clamp-2 text-xs font-semibold">{book.title}</p>
          </div>
        )}
      </div>

      {/* Book Metadata & CTA */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
          <span className="text-[#2563EB]">{book.category}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{book.shelfCode}</span>
          <span aria-hidden="true">·</span>
          <span>Demo Record</span>
        </div>

        <h3 className="font-display mt-2 line-clamp-2 text-lg font-semibold leading-snug text-[#142B4A]">
          {book.title}
        </h3>

        <p className="mt-1 text-sm text-slate-600">{book.author}</p>

        <div className="mt-auto pt-4">
          <div
            className={`mb-4 flex items-center gap-1.5 text-xs font-semibold ${availabilityMeta.textClass}`}
          >
            {availabilityMeta.icon}
            <span>{availabilityMeta.label}</span>
          </div>

          <button
            type="button"
            onClick={() => onViewDetails(book.slug)}
            aria-label={`View details for ${book.title}`}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-[#F5F8FC] px-4 py-2 text-sm font-semibold text-[#142B4A] transition-colors duration-150 hover:border-[#2563EB] hover:bg-[#DBEAFE]/50 hover:text-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <span>View Details</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}

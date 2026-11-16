import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type {
  AvailabilityFilter,
  CatalogFilterOptions,
  CatalogQueryState,
} from '../../utils/bookCatalog';

interface CatalogFiltersPanelProps {
  draftFilters: CatalogQueryState;
  facets: CatalogFilterOptions;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onDraftChange: (patch: Partial<CatalogQueryState>) => void;
  onApply: () => void;
  onClearAll: () => void;
  onCloseMobile: () => void;
}

export function CatalogFiltersPanel({
  draftFilters,
  facets,
  desktopOpen,
  mobileOpen,
  onDraftChange,
  onApply,
  onClearAll,
  onCloseMobile,
}: CatalogFiltersPanelProps) {
  const renderFormFields = (idPrefix: string) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Category */}
      <div>
        <label
          htmlFor={`${idPrefix}-category`}
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Category
        </label>
        <select
          id={`${idPrefix}-category`}
          value={draftFilters.category}
          onChange={(e) => onDraftChange({ category: e.target.value })}
          className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="">All Categories</option>
          {facets.categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor={`${idPrefix}-subject`}
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Subject
        </label>
        <select
          id={`${idPrefix}-subject`}
          value={draftFilters.subject}
          onChange={(e) => onDraftChange({ subject: e.target.value })}
          className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="">All Subjects</option>
          {facets.subjects.map((subj) => (
            <option key={subj} value={subj}>
              {subj}
            </option>
          ))}
        </select>
      </div>

      {/* Author (search or pick from known authors) */}
      <div>
        <label
          htmlFor={`${idPrefix}-author`}
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Author
        </label>
        <input
          id={`${idPrefix}-author`}
          type="text"
          list={`${idPrefix}-authors-datalist`}
          value={draftFilters.author}
          onChange={(e) => onDraftChange({ author: e.target.value })}
          placeholder="Filter or select author..."
          className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        />
        <datalist id={`${idPrefix}-authors-datalist`}>
          {facets.authors.map((author) => (
            <option key={author} value={author} />
          ))}
        </datalist>
      </div>

      {/* Availability */}
      <div>
        <label
          htmlFor={`${idPrefix}-availability`}
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Availability
        </label>
        <select
          id={`${idPrefix}-availability`}
          value={draftFilters.availability}
          onChange={(e) =>
            onDraftChange({ availability: e.target.value as AvailabilityFilter })
          }
          className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="all">All</option>
          <option value="available">Available now</option>
          <option value="issued">Currently issued</option>
          <option value="reserved">Reserved</option>
        </select>
      </div>

      {/* Publication Year Range */}
      <div>
        <span className="block text-xs font-semibold text-[#142B4A]">
          Publication Year
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={`${idPrefix}-year-from`} className="sr-only">
              From year
            </label>
            <input
              id={`${idPrefix}-year-from`}
              type="number"
              min={facets.minYear}
              max={facets.maxYear}
              value={draftFilters.yearFrom}
              onChange={(e) => onDraftChange({ yearFrom: e.target.value })}
              placeholder={`From (${facets.minYear})`}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-year-to`} className="sr-only">
              To year
            </label>
            <input
              id={`${idPrefix}-year-to`}
              type="number"
              min={facets.minYear}
              max={facets.maxYear}
              value={draftFilters.yearTo}
              onChange={(e) => onDraftChange({ yearTo: e.target.value })}
              placeholder={`To (${facets.maxYear})`}
              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>
        </div>
      </div>

      {/* Rating */}
      <div>
        <label
          htmlFor={`${idPrefix}-rating`}
          className="block text-xs font-semibold text-[#142B4A]"
        >
          Rating
        </label>
        <select
          id={`${idPrefix}-rating`}
          value={draftFilters.minRating}
          onChange={(e) => onDraftChange({ minRating: e.target.value })}
          className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="">Any rating</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
          <option value="2">2+ stars</option>
        </select>
      </div>

      {/* Language (only when database supports multiple languages) */}
      {facets.languages.length > 0 && (
        <div>
          <label
            htmlFor={`${idPrefix}-language`}
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Language
          </label>
          <select
            id={`${idPrefix}-language`}
            value={draftFilters.language}
            onChange={(e) => onDraftChange({ language: e.target.value })}
            className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          >
            <option value="">All Languages</option>
            {facets.languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Format (only when database supports formats) */}
      {facets.formats.length > 0 && (
        <div>
          <label
            htmlFor={`${idPrefix}-format`}
            className="block text-xs font-semibold text-[#142B4A]"
          >
            Format
          </label>
          <select
            id={`${idPrefix}-format`}
            value={draftFilters.format}
            onChange={(e) => onDraftChange({ format: e.target.value })}
            className="mt-1.5 min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-[#1E293B] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          >
            <option value="">All Formats</option>
            {facets.formats.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop / Tablet Collapsible Filter Panel */}
      {desktopOpen && (
        <section
          id="desktop-catalog-filters"
          aria-label="Advanced catalogue filters"
          className="hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:block"
        >
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              <h2 className="font-display text-sm font-bold text-[#142B4A]">
                Filter Books
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearAll}
                className="min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F5F8FC] hover:text-[#142B4A] cursor-pointer"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={onApply}
                className="min-h-[36px] rounded-lg bg-[#2563EB] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {renderFormFields('desktop-filter')}
        </section>
      )}

      {/* Mobile / Small Screen Slide-Over Filter Modal */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter library catalogue"
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center lg:hidden"
        >
          <div
            className="fixed inset-0 bg-[#142B4A]/45 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                <h2 className="font-display text-base font-bold text-[#142B4A]">
                  Filter Books
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close filter drawer"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">{renderFormFields('mobile-filter')}</div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-[#F5F8FC] px-5 py-3.5">
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  onCloseMobile();
                }}
                className="min-h-[42px] flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] cursor-pointer"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply();
                  onCloseMobile();
                }}
                className="min-h-[42px] flex-1 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

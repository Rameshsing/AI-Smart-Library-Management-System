import React, { useEffect, useState } from 'react';
import { Filter, RotateCcw, X } from 'lucide-react';
import type {
  CopyStatus,
  InventoryCapabilities,
  InventoryFacets,
  InventoryFilterState,
  TitleAvailabilityStatus,
} from '../../utils/librarianInventory';

interface InventoryFiltersDrawerProps {
  isOpen: boolean;
  filters: InventoryFilterState;
  facets: InventoryFacets;
  capabilities: InventoryCapabilities;
  onClose: () => void;
  onApply: (next: InventoryFilterState) => void;
  onClearAll: () => void;
}

const AVAILABILITY_OPTIONS: TitleAvailabilityStatus[] = [
  'Available',
  'Partially Available',
  'Fully Issued',
  'Reserved/Held',
  'Unavailable',
];

export function InventoryFiltersDrawer({
  isOpen,
  filters,
  facets,
  capabilities,
  onClose,
  onApply,
  onClearAll,
}: InventoryFiltersDrawerProps) {
  const [draft, setDraft] = useState<InventoryFilterState>(filters);

  useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [filters, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onApply({ ...draft, page: 1 });
    onClose();
  };

  return (
    <section
      aria-label="Advanced inventory filters"
      className="rounded-xl border border-[#DBEAFE] bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
          <h2 className="font-display text-sm font-bold text-[#142B4A]">
            Advanced Catalogue &amp; Copy Filters
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close advanced filters"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#142B4A] cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="inv-filter-category"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Category
            </label>
            <select
              id="inv-filter-category"
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Categories</option>
              {facets.categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-subject"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Subject
            </label>
            <select
              id="inv-filter-subject"
              value={draft.subject}
              onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Subjects</option>
              {facets.subjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-author"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Author
            </label>
            <select
              id="inv-filter-author"
              value={draft.author}
              onChange={(e) => setDraft((prev) => ({ ...prev, author: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Authors</option>
              {facets.authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-publisher"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Publisher
            </label>
            <select
              id="inv-filter-publisher"
              value={draft.publisher}
              onChange={(e) => setDraft((prev) => ({ ...prev, publisher: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Publishers</option>
              {facets.publishers.map((pub) => (
                <option key={pub} value={pub}>
                  {pub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-year"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Publication Year
            </label>
            <input
              id="inv-filter-year"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2025"
              value={draft.publication_year}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, publication_year: e.target.value }))
              }
              className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="inv-filter-language"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Language
            </label>
            <select
              id="inv-filter-language"
              value={draft.language}
              onChange={(e) => setDraft((prev) => ({ ...prev, language: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Languages</option>
              {facets.languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-format"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Format
            </label>
            <select
              id="inv-filter-format"
              value={draft.format}
              onChange={(e) => setDraft((prev) => ({ ...prev, format: e.target.value }))}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Formats</option>
              {capabilities.supported_formats.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-availability"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Title Availability
            </label>
            <select
              id="inv-filter-availability"
              value={draft.availability}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  availability: e.target.value as '' | TitleAvailabilityStatus,
                }))
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">All Availability States</option>
              {AVAILABILITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="inv-filter-copy-status"
              className="block text-xs font-semibold text-[#142B4A]"
            >
              Physical Copy Status
            </label>
            <select
              id="inv-filter-copy-status"
              value={draft.copy_status}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  copy_status: e.target.value as '' | CopyStatus,
                }))
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="">Any Copy Status</option>
              {capabilities.supported_copy_statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {capabilities.supports_locations && (
            <>
              <div>
                <label
                  htmlFor="inv-filter-branch"
                  className="block text-xs font-semibold text-[#142B4A]"
                >
                  Library Branch
                </label>
                <select
                  id="inv-filter-branch"
                  value={draft.branch}
                  onChange={(e) => setDraft((prev) => ({ ...prev, branch: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="">All Branches</option>
                  {facets.branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="inv-filter-floor"
                  className="block text-xs font-semibold text-[#142B4A]"
                >
                  Floor
                </label>
                <select
                  id="inv-filter-floor"
                  value={draft.floor}
                  onChange={(e) => setDraft((prev) => ({ ...prev, floor: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="">All Floors</option>
                  {facets.floors.map((floor) => (
                    <option key={floor} value={floor}>
                      {floor}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="inv-filter-section"
                  className="block text-xs font-semibold text-[#142B4A]"
                >
                  Section
                </label>
                <select
                  id="inv-filter-section"
                  value={draft.section}
                  onChange={(e) => setDraft((prev) => ({ ...prev, section: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="">All Sections</option>
                  {facets.sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="inv-filter-shelf"
                  className="block text-xs font-semibold text-[#142B4A]"
                >
                  Shelf Code
                </label>
                <select
                  id="inv-filter-shelf"
                  value={draft.shelf}
                  onChange={(e) => setDraft((prev) => ({ ...prev, shelf: e.target.value }))}
                  className="font-mono-tabular mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-[#1E293B] focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="">All Shelves</option>
                  {facets.shelves.map((shelf) => (
                    <option key={shelf} value={shelf}>
                      {shelf}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => {
              onClearAll();
              onClose();
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-[#142B4A] hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear Filters</span>
          </button>
          <button
            type="submit"
            className="inline-flex min-h-[38px] items-center rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] whitespace-nowrap cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </section>
  );
}

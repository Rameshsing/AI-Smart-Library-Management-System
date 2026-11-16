import React from 'react';
import { ArrowRight, BookX, Search } from 'lucide-react';
import { DEMO_BOOKS, type AppRoute } from '../data/libraryData';
import { filterDemoBooks, getBookCategories } from '../utils/catalogSearch';
import { BookCard } from './BookCard';

interface FeaturedBooksSectionProps {
  searchQuery: string;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (query: string) => void;
  onClearFilters: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function FeaturedBooksSection({
  searchQuery,
  selectedCategory,
  onCategoryChange,
  onSearchChange,
  onClearFilters,
  onNavigate,
}: FeaturedBooksSectionProps) {
  const categories = getBookCategories(DEMO_BOOKS);
  const filteredBooks = filterDemoBooks(DEMO_BOOKS, searchQuery, selectedCategory);
  const hasActiveFilter = searchQuery.trim().length > 0 || selectedCategory !== 'All';

  return (
    <section
      id="explore-books"
      aria-labelledby="featured-books-heading"
      className="scroll-mt-16 bg-white py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2
              id="featured-books-heading"
              className="font-display text-2xl font-bold tracking-tight text-[#142B4A] sm:text-3xl [text-wrap:balance]"
            >
              Explore Our Library
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Discover popular books and learning resources across different subjects.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sample catalogue preview — all titles below represent demo records ready for database connection.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate({ name: 'books' })}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#142B4A] transition-colors duration-150 hover:border-[#2563EB] hover:text-[#2563EB] whitespace-nowrap shrink-0 md:self-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
          >
            <span>View All Books</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Category Tabs & Inline Quick Filter */}
        <div className="mt-8 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter demo books by subject"
            className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[#F5F8FC] p-1"
          >
            {categories.map((category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  onClick={() => onCategoryChange(category)}
                  className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer ${
                    isSelected
                      ? 'bg-[#142B4A] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-[#142B4A]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72">
            <label htmlFor="catalog-inline-search" className="sr-only">
              Filter demo books
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="catalog-inline-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter displayed demo books..."
              className="min-h-[42px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-[#1E293B] placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </div>
        </div>

        {/* Active Search Status Summary */}
        {hasActiveFilter && (
          <div
            aria-live="polite"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DBEAFE] bg-[#F5F8FC] px-4 py-3 text-sm text-[#142B4A]"
          >
            <span>
              Showing <strong className="font-mono-tabular">{filteredBooks.length}</strong> demo{' '}
              {filteredBooks.length === 1 ? 'book' : 'books'}
              {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
              {selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}.
            </span>
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-semibold text-[#2563EB] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Responsive Book Cards Grid or Empty State */}
        {filteredBooks.length > 0 ? (
          <div
            data-testid="featured-books-grid"
            className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onViewDetails={(slug) => onNavigate({ name: 'book-detail', slug })}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-[#F5F8FC] px-6 py-14 text-center">
            <BookX className="h-10 w-10 text-slate-400" aria-hidden="true" />
            <h3 className="font-display mt-3 text-lg font-semibold text-[#142B4A]">
              No matching demo books found
            </h3>
            <p className="mt-1 max-w-md text-sm text-slate-600">
              We could not find any sample titles matching your current search or subject filter.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] cursor-pointer"
            >
              Reset Search &amp; Show All Books
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogApiParams,
  buildPaginationTokens,
  countActiveCatalogFilters,
  DEFAULT_CATALOG_QUERY_STATE,
  extractCatalogFilterOptions,
  findCatalogBookByIdentifier,
  getBasedOnInterestsBooks,
  getBookAvailabilityInfo,
  parseCatalogQueryFromSearch,
  querySampleCatalog,
  SAMPLE_LIBRARY_CATALOG,
  serializeCatalogQueryToSearch,
} from './bookCatalog.ts';

test('getBookAvailabilityInfo computes copy counts, issued, and reserved states accurately', () => {
  assert.deepEqual(
    getBookAvailabilityInfo({
      available_copies: 3,
      total_copies: 5,
      reserved_copies: 0,
      format: 'Physical Book',
    }),
    { status: 'available', label: '3 of 5 available', shortLabel: 'Available' }
  );

  assert.deepEqual(
    getBookAvailabilityInfo({
      available_copies: 1,
      total_copies: 1,
      reserved_copies: 0,
      format: 'E-Book',
    }),
    { status: 'available', label: 'Available', shortLabel: 'Available' }
  );

  assert.deepEqual(
    getBookAvailabilityInfo({
      available_copies: 0,
      total_copies: 2,
      reserved_copies: 1,
      format: 'Physical Book',
    }),
    { status: 'reserved', label: 'Reserved', shortLabel: 'Reserved' }
  );

  assert.deepEqual(
    getBookAvailabilityInfo({
      available_copies: 0,
      total_copies: 3,
      reserved_copies: 0,
      format: 'Physical Book',
    }),
    { status: 'issued', label: 'Currently Issued', shortLabel: 'Currently Issued' }
  );
});

test('querySampleCatalog performs case-insensitive partial search across title, author, ISBN, and keywords', () => {
  const pythonResults = querySampleCatalog(SAMPLE_LIBRARY_CATALOG, {
    ...DEFAULT_CATALOG_QUERY_STATE,
    search: 'python',
  });
  assert.ok(pythonResults.total >= 5);
  assert.ok(pythonResults.items.some((b) => b.title.includes('Python Programming')));
  assert.ok(pythonResults.items.some((b) => b.title.includes('Python for Data Analysis')));

  const isbnResults = querySampleCatalog(SAMPLE_LIBRARY_CATALOG, {
    ...DEFAULT_CATALOG_QUERY_STATE,
    search: '978-0-262-04482-1',
  });
  assert.equal(isbnResults.total, 1);
  assert.equal(isbnResults.items[0]?.book_id, 105);
});

test('querySampleCatalog applies category, availability, year range, rating, language, and format filters together', () => {
  const result = querySampleCatalog(SAMPLE_LIBRARY_CATALOG, {
    ...DEFAULT_CATALOG_QUERY_STATE,
    category: 'Programming',
    availability: 'available',
    yearFrom: '2024',
    minRating: '4',
    format: 'Physical Book',
  });

  assert.ok(result.total >= 1);
  for (const book of result.items) {
    assert.equal(book.category, 'Programming');
    assert.ok(book.available_copies > 0);
    assert.ok(book.publication_year >= 2024);
    assert.ok(book.rating_average >= 4);
    assert.equal(book.format, 'Physical Book');
  }
});

test('querySampleCatalog supports all sort modes and clean server-style pagination', () => {
  const titleAsc = querySampleCatalog(SAMPLE_LIBRARY_CATALOG, {
    ...DEFAULT_CATALOG_QUERY_STATE,
    sort: 'title_asc',
    limit: 12,
    page: 1,
  });
  assert.equal(titleAsc.items.length, 12);
  assert.equal(titleAsc.total, SAMPLE_LIBRARY_CATALOG.length);
  assert.equal(titleAsc.totalPages, 3);
  assert.ok(titleAsc.items[0]!.title.localeCompare(titleAsc.items[1]!.title) <= 0);

  const page3 = querySampleCatalog(SAMPLE_LIBRARY_CATALOG, {
    ...DEFAULT_CATALOG_QUERY_STATE,
    sort: 'most_borrowed',
    limit: 12,
    page: 3,
  });
  assert.equal(page3.page, 3);
  assert.equal(page3.items.length, SAMPLE_LIBRARY_CATALOG.length - 24);
});

test('URL search parameter parsing and serialization preserve filter and pagination state', () => {
  const parsed = parseCatalogQueryFromSearch(
    '?search=python&category=Data+Science&availability=available&min_rating=4&sort=highest_rated&page=2'
  );
  assert.equal(parsed.search, 'python');
  assert.equal(parsed.category, 'Data Science');
  assert.equal(parsed.availability, 'available');
  assert.equal(parsed.minRating, '4');
  assert.equal(parsed.sort, 'highest_rated');
  assert.equal(parsed.page, 2);

  const apiParams = buildCatalogApiParams(parsed);
  assert.equal(apiParams.get('min_rating'), '4');
  assert.equal(apiParams.get('page'), '2');

  const serialized = serializeCatalogQueryToSearch(parsed);
  const reparsed = parseCatalogQueryFromSearch(serialized);
  assert.deepEqual(reparsed, parsed);

  assert.equal(countActiveCatalogFilters(DEFAULT_CATALOG_QUERY_STATE), 0);
  assert.equal(countActiveCatalogFilters(parsed), 3);
});

test('getBasedOnInterestsBooks and extractCatalogFilterOptions derive valid database-backed results', () => {
  const facets = extractCatalogFilterOptions(SAMPLE_LIBRARY_CATALOG);
  assert.ok(facets.categories.includes('Artificial Intelligence'));
  assert.ok(facets.formats.includes('E-Book'));
  assert.ok(facets.languages.includes('Hindi'));

  const picks = getBasedOnInterestsBooks(
    SAMPLE_LIBRARY_CATALOG,
    ['Python Programming', 'Artificial Intelligence'],
    ['Data Science'],
    4
  );
  assert.equal(picks.length, 4);
  for (const book of picks) {
    assert.ok(book.available_copies > 0);
  }

  assert.equal(findCatalogBookByIdentifier('105')?.book_id, 105);
  assert.equal(
    findCatalogBookByIdentifier('interconnected-knowledge-systems-data-modern-education')?.book_id,
    105
  );
});

test('buildPaginationTokens renders compact numbered tokens with ellipsis for large catalogues', () => {
  assert.deepEqual(buildPaginationTokens(1, 3), [1, 2, 3]);
  assert.deepEqual(buildPaginationTokens(6, 123), [1, 'ellipsis', 5, 6, 7, 'ellipsis', 123]);
});

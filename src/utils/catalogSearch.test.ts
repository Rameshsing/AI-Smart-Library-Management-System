import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_BOOKS } from '../data/libraryData';
import {
  filterDemoBooks,
  findDemoBookBySlug,
  getBookCategories,
  parseRouteFromPathname,
  routeToPathname,
} from './catalogSearch';

test('filterDemoBooks returns all books when query is empty and category is All', () => {
  const results = filterDemoBooks(DEMO_BOOKS, '', 'All');
  assert.equal(results.length, DEMO_BOOKS.length);
});

test('filterDemoBooks matches by title, author, category, and keywords case-insensitively', () => {
  const byTitle = filterDemoBooks(DEMO_BOOKS, 'algorithms');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, 'demo-book-2');

  const byAuthor = filterDemoBooks(DEMO_BOOKS, 'Eleanor Vance');
  assert.equal(byAuthor.length, 2);

  const byKeyword = filterDemoBooks(DEMO_BOOKS, 'pandas');
  assert.equal(byKeyword.length, 1);
  assert.equal(byKeyword[0].id, 'demo-book-3');
});

test('filterDemoBooks combines category filter and search query accurately', () => {
  const matching = filterDemoBooks(DEMO_BOOKS, 'Vance', 'Humanities');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].id, 'demo-book-6');

  const empty = filterDemoBooks(DEMO_BOOKS, 'nonexistent-xyz');
  assert.equal(empty.length, 0);
});

test('getBookCategories returns All followed by unique demo categories', () => {
  const categories = getBookCategories(DEMO_BOOKS);
  assert.equal(categories[0], 'All');
  assert.ok(categories.includes('Artificial Intelligence'));
  assert.ok(categories.includes('Computer Science'));
});

test('route parsing and serialization round-trip cleanly', () => {
  assert.deepEqual(parseRouteFromPathname('/'), { name: 'home' });
  assert.deepEqual(parseRouteFromPathname('/signup/'), { name: 'signup' });
  assert.deepEqual(parseRouteFromPathname('/books/algorithms-and-data-structures'), {
    name: 'book-detail',
    slug: 'algorithms-and-data-structures',
  });
  assert.deepEqual(parseRouteFromPathname('/student-dashboard'), { name: 'student-dashboard' });
  assert.deepEqual(parseRouteFromPathname('/student/search'), { name: 'student-search' });
  assert.deepEqual(parseRouteFromPathname('/student/recommendations'), {
    name: 'student-recommendations',
  });
  assert.deepEqual(parseRouteFromPathname('/student/reservations'), {
    name: 'student-reservations',
  });
  assert.equal(routeToPathname({ name: 'student-reservations' }), '/student/reservations');
  assert.deepEqual(parseRouteFromPathname('/librarian-dashboard'), {
    name: 'librarian-dashboard',
  });
  assert.deepEqual(parseRouteFromPathname('/librarian/inventory'), {
    name: 'librarian-inventory',
  });
  assert.deepEqual(parseRouteFromPathname('/librarian/books/new'), {
    name: 'librarian-add-book',
  });
  assert.deepEqual(parseRouteFromPathname('/librarian/profile'), {
    name: 'librarian-profile',
  });
  assert.equal(
    routeToPathname({ name: 'librarian-profile', section: 'password' }),
    '/librarian/profile/password'
  );
  assert.deepEqual(parseRouteFromPathname('/librarian/profile/password'), {
    name: 'librarian-profile',
    section: 'password',
  });
  assert.deepEqual(parseRouteFromPathname('/admin-dashboard'), { name: 'admin-dashboard' });
  assert.equal(
    routeToPathname({ name: 'book-detail', slug: 'algorithms-and-data-structures' }),
    '/books/algorithms-and-data-structures'
  );
  assert.ok(findDemoBookBySlug('algorithms-and-data-structures'));
  assert.equal(findDemoBookBySlug('missing-slug'), undefined);
});

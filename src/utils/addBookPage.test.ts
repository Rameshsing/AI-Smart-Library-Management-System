import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addKeywordTag,
  buildAddBookTransactionPayload,
  createBulkPhysicalCopyDrafts,
  createInitialAddBookFormState,
  createSampleAddBookMetadata,
  detectDuplicateBook,
  hasUnsavedAddBookChanges,
  isValidIsbn10,
  isValidIsbn13,
  mapAddBookApiError,
  normalizeIsbn,
  removeKeywordTag,
  validateAddBookForm,
  validateIsbnInput,
} from './addBookPage';

test('normalizeIsbn strips spaces and hyphens cleanly', () => {
  assert.equal(normalizeIsbn(' 978-0-13-468599-1 '), '9780134685991');
  assert.equal(normalizeIsbn('0-201-61622-x'), '020161622X');
});

test('validateIsbnInput validates real ISBN-10 and ISBN-13 checksums', () => {
  assert.equal(isValidIsbn13('9780134685991'), true); // Effective Java 3rd Ed
  assert.equal(isValidIsbn13('9780134685992'), false);
  assert.equal(isValidIsbn10('020161622X'), true); // The Pragmatic Programmer
  assert.equal(isValidIsbn10('0201616229'), false);

  const invalid = validateIsbnInput('12345');
  assert.equal(invalid.valid, false);
  assert.equal(invalid.error, 'Enter a valid ISBN.');

  const valid = validateIsbnInput('978-0-13-468599-1');
  assert.equal(valid.valid, true);
  assert.equal(valid.normalized, '9780134685991');
});

test('detectDuplicateBook detects exact normalized ISBN and matching Title+Author', () => {
  const metadata = createSampleAddBookMetadata();
  const sampleBook = metadata.existingBooks[0];

  const byIsbn = detectDuplicateBook(
    { isbn: sampleBook.isbn.toLowerCase(), title: 'Different Title', authors: ['Someone'] },
    metadata.existingBooks
  );
  assert.ok(byIsbn);
  assert.equal(byIsbn.reason, 'isbn');
  assert.equal(byIsbn.existingBook.book_id, sampleBook.book_id);

  const byTitleAuthor = detectDuplicateBook(
    {
      isbn: '9780134685991',
      title: `  ${sampleBook.title} `,
      authors: ['Eleanor Vance'],
    },
    metadata.existingBooks
  );
  assert.ok(byTitleAuthor);
  assert.equal(byTitleAuthor.reason, 'title_author');

  const clean = detectDuplicateBook(
    {
      isbn: '9780134685991',
      title: 'Distributed Consensus Engineering',
      authors: ['Aarav Mehta'],
    },
    metadata.existingBooks
  );
  assert.equal(clean, null);
});

test('validateAddBookForm blocks future publication years, missing fields, and invalid initial copy statuses', () => {
  const metadata = createSampleAddBookMetadata();
  const form = createInitialAddBookFormState(
    metadata.accession_prefix_format,
    metadata.existingAccessionNumbers
  );
  form.title = 'Designing Distributed Systems';
  form.authors = ['Brendan Burns'];
  form.isbn = '978-0-13-468599-1';
  form.publicationYear = String(new Date().getFullYear() + 2);
  form.category = 'Computer Science';
  form.subject = 'Systems Design';
  form.shelf = 'CS-310';
  form.copies[0].status = 'Issued';

  const result = validateAddBookForm(form, metadata, { currentYear: 2026 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.publicationYear);
  assert.ok(result.errors.copyRowErrors[form.copies[0].localId]?.includes('Issued'));
});

test('validateAddBookForm rejects copy accession equal to ISBN or duplicate across rows', () => {
  const metadata = createSampleAddBookMetadata();
  const form = createInitialAddBookFormState(
    metadata.accession_prefix_format,
    metadata.existingAccessionNumbers
  );
  form.title = 'Clean Systems';
  form.authors = ['Jane Doe'];
  form.isbn = '978-0-13-468599-1';
  form.publicationYear = '2024';
  form.category = 'Computer Science';
  form.subject = 'Systems Design';
  form.shelf = 'CS-401';
  form.copies = [
    {
      localId: 'c1',
      accessionNumber: '978-0-13-468599-1',
      barcode: 'BC-101',
      condition: 'New',
      status: 'Available',
      locationOverride: '',
    },
    {
      localId: 'c2',
      accessionNumber: 'LIB-2026-9901',
      barcode: 'BC-9901',
      condition: 'New',
      status: 'Available',
      locationOverride: '',
    },
    {
      localId: 'c3',
      accessionNumber: 'LIB-2026-9901',
      barcode: 'BC-9902',
      condition: 'Good',
      status: 'Available',
      locationOverride: '',
    },
  ];

  const result = validateAddBookForm(form, metadata, { currentYear: 2026 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.copyRowErrors.c1?.includes('ISBN'));
  assert.ok(result.errors.copyRowErrors.c3?.includes('Duplicate'));
});

test('createBulkPhysicalCopyDrafts generates unique non-colliding accession numbers', () => {
  const metadata = createSampleAddBookMetadata();
  const drafts = createBulkPhysicalCopyDrafts({
    count: 4,
    accessionPrefixFormat: metadata.accession_prefix_format,
    existingAccessionNumbers: metadata.existingAccessionNumbers,
    currentCopies: [],
    defaultLocationCode: 'Central Library · CS-210',
  });

  assert.equal(drafts.length, 4);
  const existingUpper = new Set(metadata.existingAccessionNumbers.map((x) => x.toUpperCase()));
  const generatedSet = new Set(drafts.map((d) => d.accessionNumber.toUpperCase()));
  assert.equal(generatedSet.size, 4);
  for (const code of generatedSet) {
    assert.equal(existingUpper.has(code), false);
  }
});

test('addKeywordTag & removeKeywordTag update tags without case-insensitive duplicates', () => {
  let tags = addKeywordTag([], 'Machine Learning, AI');
  tags = addKeywordTag(tags, 'ai');
  tags = addKeywordTag(tags, 'Deep Learning');
  assert.deepEqual(tags, ['Machine Learning', 'AI', 'Deep Learning']);
  tags = removeKeywordTag(tags, 'ai');
  assert.deepEqual(tags, ['Machine Learning', 'Deep Learning']);
});

test('buildAddBookTransactionPayload & hasUnsavedAddBookChanges work accurately', () => {
  const metadata = createSampleAddBookMetadata();
  const initial = createInitialAddBookFormState(
    metadata.accession_prefix_format,
    metadata.existingAccessionNumbers
  );
  assert.equal(hasUnsavedAddBookChanges(initial, initial), false);

  const edited = {
    ...initial,
    title: 'Modern Information Retrieval',
    authors: ['Christopher Manning', 'Prabhakar Raghavan'],
    isbn: '978-0-13-468599-1',
    publicationYear: '2025',
    pages: '480',
    category: 'Artificial Intelligence',
    subject: 'Knowledge Systems',
    keywords: ['IR', 'search'],
    shelf: 'AI-205',
  };
  assert.equal(hasUnsavedAddBookChanges(edited, initial), true);

  const payload = buildAddBookTransactionPayload(edited);
  assert.equal(payload.isbn, '9780134685991');
  assert.deepEqual(payload.authors, ['Christopher Manning', 'Prabhakar Raghavan']);
  assert.equal(payload.authors_display, 'Christopher Manning, Prabhakar Raghavan');
  assert.equal(payload.publication_year, 2025);
  assert.equal(payload.pages, 480);
  assert.equal(payload.physical_copies.length, 1);
  assert.equal(payload.physical_copies[0].status, 'Available');
});

test('mapAddBookApiError formats conflict, validation, auth, and server errors clearly', () => {
  assert.ok(mapAddBookApiError(401).toLowerCase().includes('session'));
  assert.ok(mapAddBookApiError(403).toLowerCase().includes('authorized'));
  assert.ok(mapAddBookApiError(409).toLowerCase().includes('duplicate'));
  assert.ok(mapAddBookApiError(500).toLowerCase().includes('no partial record'));
});

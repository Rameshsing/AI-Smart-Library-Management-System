import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventoryApiParams,
  canDeleteOrRequireArchive,
  createSampleInventoryStore,
  DEFAULT_INVENTORY_FILTERS,
  deriveTitleAvailabilityCounts,
  generateAccessionNumbers,
  querySampleInventory,
  validateBookFormInput,
  validateCopyStatusTransition,
  validateCoverImageFile,
  validateNewCopyInput,
  type BookFormDraft,
  type InventoryPhysicalCopy,
} from './librarianInventory';

function makeCopy(overrides: Partial<InventoryPhysicalCopy> = {}): InventoryPhysicalCopy {
  return {
    copy_id: 1,
    book_id: 1,
    accession_number: 'LIB-2026-0001',
    barcode: 'BC-01-0001',
    status: 'Available',
    condition: 'Good',
    branch: 'Central Library',
    floor: 'Floor 2',
    section: 'Computer & AI Wing',
    shelf: 'AI-104',
    current_borrower_name: null,
    current_borrower_code: null,
    due_date: null,
    has_active_borrowing: false,
    has_historical_transactions: false,
    added_at: '2026-10-12',
    updated_at: '2026-11-12',
    ...overrides,
  };
}

describe('librarianInventory utilities', () => {
  it('derives title availability counts strictly from physical copy states without contradictions', () => {
    const copies = [
      makeCopy({ copy_id: 1, status: 'Available' }),
      makeCopy({ copy_id: 2, accession_number: 'LIB-2026-0002', status: 'Available' }),
      makeCopy({ copy_id: 3, accession_number: 'LIB-2026-0003', status: 'Issued' }),
      makeCopy({ copy_id: 4, accession_number: 'LIB-2026-0004', status: 'Reserved' }),
      makeCopy({ copy_id: 5, accession_number: 'LIB-2026-0005', status: 'Damaged' }),
    ];

    const derived = deriveTitleAvailabilityCounts(copies, 'Active');
    assert.equal(derived.total_copies, 5);
    assert.equal(derived.available_copies, 2);
    assert.equal(derived.issued_copies, 1);
    assert.equal(derived.reserved_copies, 1);
    assert.equal(derived.unavailable_copies, 1);
    assert.equal(derived.availability_status, 'Partially Available');

    const archived = deriveTitleAvailabilityCounts(copies, 'Archived');
    assert.equal(archived.availability_status, 'Archived');

    const fullyIssued = deriveTitleAvailabilityCounts(
      [makeCopy({ status: 'Issued' })],
      'Active'
    );
    assert.equal(fullyIssued.availability_status, 'Fully Issued');
  });

  it('prevents manually marking an issued copy with active borrowing as Available', () => {
    const issuedCopy = makeCopy({
      accession_number: 'DSC-002',
      status: 'Issued',
      has_active_borrowing: true,
    });
    const blocked = validateCopyStatusTransition(issuedCopy, 'Available');
    assert.equal(blocked.valid, false);
    assert.match(blocked.reason ?? '', /Return Books/i);

    const allowedLost = validateCopyStatusTransition(issuedCopy, 'Lost');
    assert.equal(allowedLost.valid, true);

    const reservedCopy = makeCopy({
      accession_number: 'DSC-003',
      status: 'Reserved',
    });
    const blockedReserved = validateCopyStatusTransition(reservedCopy, 'Available');
    assert.equal(blockedReserved.valid, false);
  });

  it('generates unique non-ISBN accession numbers and rejects duplicate or ISBN copy IDs', () => {
    const existing = ['LIB-2026-0001', 'LIB-2026-0002', 'LIB-2026-0005'];
    const generated = generateAccessionNumbers('LIB-2026-0001', existing, 3);
    assert.deepEqual(generated, ['LIB-2026-0006', 'LIB-2026-0007', 'LIB-2026-0008']);

    const isbnCheck = validateNewCopyInput('9781234567890', 'BC-99', '9781234567890', [
      makeCopy({ accession_number: 'LIB-2026-0001', barcode: 'BC-01' }),
    ]);
    assert.equal(isbnCheck.valid, false);
    assert.match(isbnCheck.error ?? '', /ISBN/i);

    const dupCheck = validateNewCopyInput('lib-2026-0001', 'BC-02', '9781234567890', [
      makeCopy({ accession_number: 'LIB-2026-0001', barcode: 'BC-01' }),
    ]);
    assert.equal(dupCheck.valid, false);
  });

  it('validates book form inputs, unique ISBN, year bounds, and safe cover upload files', () => {
    const store = createSampleInventoryStore();
    const validDraft: BookFormDraft = {
      title: 'Designing Data-Intensive Applications',
      subtitle: 'The Big Ideas Behind Reliable Systems',
      authors: 'Martin Kleppmann',
      isbn: '9781449373320',
      publisher: "O'Reilly Media",
      publication_year: '2017',
      edition: '1st Edition',
      language: 'English',
      pages: '616',
      category: 'Software Engineering',
      subject: 'Distributed Systems',
      keywords: 'distributed systems, databases, scalability',
      description: 'Comprehensive guide to building reliable, scalable, and maintainable data systems.',
      format: 'Hardcover',
      cover_image: '',
      initial_copies: '3',
      branch: 'Central Library',
      floor: 'Floor 2',
      section: 'Systems Wing',
      shelf: 'SE-420',
      acquisition_note: 'Fall semester requisition',
    };

    const ok = validateBookFormInput(validDraft, store.books, 'create');
    assert.equal(ok.valid, true);

    const dupIsbn = validateBookFormInput(
      { ...validDraft, isbn: store.books[0].isbn, publication_year: '1200' },
      store.books,
      'create'
    );
    assert.equal(dupIsbn.valid, false);
    assert.ok(dupIsbn.fieldErrors.isbn);
    assert.ok(dupIsbn.fieldErrors.publication_year);

    assert.equal(
      validateCoverImageFile({ name: 'script.exe', size: 1024 }).valid,
      false
    );
    assert.equal(
      validateCoverImageFile({ name: 'cover.webp', size: 500_000 }).valid,
      true
    );
  });

  it('blocks unsafe deletion when active borrowings, reservations, or history exist', () => {
    const store = createSampleInventoryStore();
    const bookWithBorrowing = store.books[0];
    const check = canDeleteOrRequireArchive(bookWithBorrowing);
    assert.equal(check.allowDestructiveDelete, false);
    assert.equal(check.requiresArchive, true);
    assert.match(check.reason, /borrowing|history/i);
  });

  it('keeps total unique titles separate from total physical copies and filters/sorts accurately', () => {
    const store = createSampleInventoryStore();
    const res = querySampleInventory(store, DEFAULT_INVENTORY_FILTERS);
    assert.equal(res.summary.total_titles, 6);
    assert.equal(res.summary.total_copies, 21);
    assert.equal(
      res.summary.available_copies +
        res.summary.issued_copies +
        res.summary.reserved_copies +
        res.summary.unavailable_copies,
      res.summary.total_copies
    );

    const byAccession = querySampleInventory(store, {
      ...DEFAULT_INVENTORY_FILTERS,
      search: 'LIB-2026-0010',
    });
    assert.equal(byAccession.items.length, 1);

    const params = buildInventoryApiParams({
      ...DEFAULT_INVENTORY_FILTERS,
      search: 'Clean Code',
      copy_status: 'Damaged',
      sort: 'title_asc',
      page: 2,
    });
    assert.equal(params.get('search'), 'Clean Code');
    assert.equal(params.get('copy_status'), 'Damaged');
    assert.equal(params.get('sort'), 'title_asc');
    assert.equal(params.get('page'), '2');
  });
});

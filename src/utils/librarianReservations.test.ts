import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReservationsApiQueryParams,
  canMarkReservationReady,
  computePeopleAhead,
  computeReservationSummary,
  createSampleReservationsStore,
  filterAndPaginateReservations,
  formatPickupDeadlineStatus,
  formatQueuePositionLabel,
  isReservationExpiringSoon,
  normalizeBackendReservationStatus,
} from './librarianReservations';

test('reservation statuses map strictly to backend states and derive real summary counts', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleReservationsStore(ref);
  const summary = computeReservationSummary(store.items, store.policy, ref);

  assert.equal(normalizeBackendReservationStatus('Fulfilled'), 'Completed');
  assert.equal(normalizeBackendReservationStatus('Ready for Pickup'), 'Ready for Pickup');
  assert.equal(summary.waiting, 2);
  assert.equal(summary.readyForPickup, 2);
  assert.equal(summary.activeReservations, 4);
  assert.equal(summary.expiringSoon, 1);
  assert.equal(summary.expired, 1);
});

test('queue position and people ahead follow backend position values without guessing', () => {
  assert.equal(computePeopleAhead(1), 0);
  assert.equal(computePeopleAhead(2), 1);
  assert.equal(computePeopleAhead(null), null);

  const label1 = formatQueuePositionLabel(1, 3);
  assert.equal(label1.primary, 'Position 1 of 3');
  assert.equal(label1.aheadText, 'Next in queue');

  const label2 = formatQueuePositionLabel(2, 5);
  assert.equal(label2.primary, 'Position 2 of 5');
  assert.equal(label2.aheadText, '1 student ahead');
});

test('pickup deadline checks obey backend expiring warning threshold', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const policy = { pickup_window_hours: 48, expiring_warning_hours: 24 };

  const expiring = formatPickupDeadlineStatus('2026-11-15T20:00:00Z', policy, ref);
  assert.equal(expiring.isExpiringSoon, true);
  assert.equal(expiring.isPastDeadline, false);
  assert.equal(expiring.label, 'Expires in 8 hours');

  const plentyTime = formatPickupDeadlineStatus('2026-11-17T12:00:00Z', policy, ref);
  assert.equal(plentyTime.isExpiringSoon, false);
  assert.equal(plentyTime.label, 'Expires in 2 days');

  const lapsed = formatPickupDeadlineStatus('2026-11-14T12:00:00Z', policy, ref);
  assert.equal(lapsed.isPastDeadline, true);
});

test('canMarkReservationReady prevents ready promotion without an actual available copy or active account', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleReservationsStore(ref);

  const blockedStudentRes = store.items.find((r) => r.reservation_code === 'RES-2026-6203');
  assert.ok(blockedStudentRes);
  const blockedCheck = canMarkReservationReady(blockedStudentRes, store.copies);
  assert.equal(blockedCheck.allowed, false);
  assert.match(blockedCheck.reason ?? '', /Blocked/i);

  const eligibleRes = store.items.find((r) => r.reservation_code === 'RES-2026-6205');
  assert.ok(eligibleRes);
  const eligibleCheck = canMarkReservationReady(eligibleRes, store.copies);
  assert.equal(eligibleCheck.allowed, true);
  assert.ok(eligibleCheck.availableCopies.length > 0);

  // If zero copies are available on shelf, marking Ready must be blocked
  const zeroAvailableCopies = store.copies.map((c) =>
    c.book_id === eligibleRes.book_id ? { ...c, status: 'Issued' as const } : c
  );
  const noCopyCheck = canMarkReservationReady(eligibleRes, zeroAvailableCopies);
  assert.equal(noCopyCheck.allowed, false);
  assert.match(noCopyCheck.reason ?? '', /No available physical copy/i);
});

test('filterAndPaginateReservations and API query serializer filter accurately by tab, search, and pickup status', () => {
  const ref = new Date('2026-11-15T12:00:00Z');
  const store = createSampleReservationsStore(ref);

  const expiringFilter = filterAndPaginateReservations(
    store.items,
    {
      tab: 'all',
      query: '',
      category: 'All',
      subject: 'All',
      branch: 'All',
      department: 'All',
      pickupStatus: 'expiring_soon',
      dateFrom: '',
      dateTo: '',
    },
    store.policy,
    ref,
    1,
    10
  );
  assert.equal(expiringFilter.totalCount, 1);
  assert.equal(expiringFilter.items[0].student_name, 'Neha Deshmukh');
  assert.equal(isReservationExpiringSoon(expiringFilter.items[0], store.policy, ref), true);

  const params = buildReservationsApiQueryParams(
    {
      tab: 'ready_for_pickup',
      query: 'Arjun',
      category: 'Data Science',
      subject: 'All',
      branch: 'All',
      department: 'All',
      pickupStatus: 'all',
      dateFrom: '2026-11-01',
      dateTo: '',
    },
    2,
    10
  );
  assert.equal(params.get('status_tab'), 'ready_for_pickup');
  assert.equal(params.get('q'), 'Arjun');
  assert.equal(params.get('category'), 'Data Science');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('date_from'), '2026-11-01');
});

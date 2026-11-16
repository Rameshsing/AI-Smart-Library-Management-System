import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReservationsApiParams,
  computeReservationsSummary,
  createReservationEventNotification,
  createSampleReservationsPayload,
  filterReservations,
  formatPeopleAheadLabel,
  formatPickupCountdownLabel,
  getAvailableReservationTabs,
  getPeopleAhead,
  getPickupDaysRemaining,
  isReservationExpiringSoon,
  paginateReservations,
} from './reservationsPage';

const FIXED_DATE = new Date('2026-04-10T10:00:00Z');

describe('reservationsPage utilities', () => {
  it('computes dynamic reservation summary counts from actual records', () => {
    const payload = createSampleReservationsPayload(FIXED_DATE);
    const summary = computeReservationsSummary(payload.items, FIXED_DATE);

    assert.equal(summary.active_reservations, 4);
    assert.equal(summary.ready_for_pickup, 2);
    assert.equal(summary.waiting, 2);
    assert.equal(summary.expiring_soon, 1);
  });

  it('computes zero summary counts cleanly for empty reservations list', () => {
    const summary = computeReservationsSummary([], FIXED_DATE);
    assert.deepEqual(summary, {
      active_reservations: 0,
      ready_for_pickup: 0,
      waiting: 0,
      expiring_soon: 0,
    });
  });

  it('calculates people ahead from queue position accurately', () => {
    assert.equal(getPeopleAhead(1), 0);
    assert.equal(getPeopleAhead(2), 1);
    assert.equal(getPeopleAhead(4), 3);
    assert.equal(getPeopleAhead(null), null);

    assert.equal(formatPeopleAheadLabel(1), 'Next in line (0 students ahead of you)');
    assert.equal(formatPeopleAheadLabel(2), '1 student ahead of you');
    assert.equal(formatPeopleAheadLabel(4), '3 students ahead of you');
    assert.equal(formatPeopleAheadLabel(null), null);
  });

  it('identifies Ready for Pickup reservations expiring soon accurately', () => {
    assert.equal(getPickupDaysRemaining('2026-04-10', FIXED_DATE), 0);
    assert.equal(getPickupDaysRemaining('2026-04-11', FIXED_DATE), 1);
    assert.equal(getPickupDaysRemaining('2026-04-13', FIXED_DATE), 3);

    assert.equal(
      isReservationExpiringSoon({ status: 'Ready for Pickup', pickup_deadline: '2026-04-11' }, FIXED_DATE),
      true
    );
    assert.equal(
      isReservationExpiringSoon({ status: 'Ready for Pickup', pickup_deadline: '2026-04-13' }, FIXED_DATE),
      false
    );
    assert.equal(
      isReservationExpiringSoon({ status: 'Waiting', pickup_deadline: '2026-04-10' }, FIXED_DATE),
      false
    );

    assert.equal(formatPickupCountdownLabel('2026-04-10', FIXED_DATE), 'Expires today');
    assert.equal(formatPickupCountdownLabel('2026-04-11', FIXED_DATE), 'Expires in 1 day');
    assert.equal(formatPickupCountdownLabel('2026-04-13', FIXED_DATE), 'Expires in 3 days');
  });

  it('filters reservations across tabs and search queries', () => {
    const payload = createSampleReservationsPayload(FIXED_DATE);

    assert.equal(filterReservations(payload.items, 'all').length, 7);
    assert.equal(filterReservations(payload.items, 'active').length, 4);
    assert.equal(filterReservations(payload.items, 'ready_for_pickup').length, 2);
    assert.equal(filterReservations(payload.items, 'completed').length, 1);
    assert.equal(filterReservations(payload.items, 'cancelled_expired').length, 2);

    const flaskSearch = filterReservations(payload.items, 'all', 'Flask');
    assert.equal(flaskSearch.length, 1);
    assert.equal(flaskSearch[0].book_id, 111);
  });

  it('builds only tabs backed by supported statuses', () => {
    const payload = createSampleReservationsPayload(FIXED_DATE);
    const tabs = getAvailableReservationTabs(payload.items, ['Waiting', 'Ready for Pickup']);
    assert.deepEqual(
      tabs.map((t) => t.key),
      ['all', 'active', 'ready_for_pickup']
    );
  });

  it('paginates reservations consistently', () => {
    const payload = createSampleReservationsPayload(FIXED_DATE);
    const page1 = paginateReservations(payload.items, 1, 6);
    const page2 = paginateReservations(payload.items, 2, 6);

    assert.equal(page1.items.length, 6);
    assert.equal(page1.totalPages, 2);
    assert.equal(page2.items.length, 1);
    assert.equal(page2.page, 2);
  });

  it('never passes student_id in API query params', () => {
    const params = buildReservationsApiParams('ready_for_pickup', 'python', 2, 6);
    assert.equal(params.has('student_id'), false);
    assert.equal(params.get('status_group'), 'ready_for_pickup');
    assert.equal(params.get('q'), 'python');
    assert.equal(params.get('page'), '2');
    assert.equal(params.get('limit'), '6');
  });

  it('creates reservation notifications without duplicates', () => {
    const first = createReservationEventNotification(
      [],
      42,
      'cancelled',
      'Automating with Python: Practical Lab Workflows',
      '2026-04-10'
    );
    assert.equal(first.length, 1);
    assert.equal(first[0].type, 'reservation_ready');

    const duplicate = createReservationEventNotification(
      first,
      42,
      'cancelled',
      'Automating with Python: Practical Lab Workflows',
      '2026-04-10'
    );
    assert.equal(duplicate.length, 1);
  });
});

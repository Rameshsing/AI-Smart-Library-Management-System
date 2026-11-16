import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnnouncementApiPayload,
  buildAnnouncementsApiQueryParams,
  computeAnnouncementsSummary,
  createSampleAnnouncementsStore,
  filterAndPaginateAnnouncements,
  isAnnouncementExpired,
  sanitizeAnnouncementText,
  validateAnnouncementDraft,
  type AnnouncementDraftForm,
} from './librarianAnnouncements';

const FIXED_NOW = new Date('2026-11-15T10:00:00Z');

test('sanitizeAnnouncementText removes scripts and HTML tags to prevent stored XSS', () => {
  const dirty = '<script>alert(1)</script><b>Library</b> closes at <i>20:00</i> today.';
  assert.equal(sanitizeAnnouncementText(dirty), 'Library closes at 20:00 today.');
});

test('computeAnnouncementsSummary counts published, scheduled, draft, and archived items dynamically', () => {
  const store = createSampleAnnouncementsStore(FIXED_NOW);
  const summary = computeAnnouncementsSummary(store.items);

  assert.equal(summary.total, 5);
  assert.equal(summary.published, 2);
  assert.equal(summary.scheduled, 1);
  assert.equal(summary.drafts, 1);
  assert.equal(summary.archived, 1);
});

test('validateAnnouncementDraft enforces title/content length, target value, and future schedule rules', () => {
  const store = createSampleAnnouncementsStore(FIXED_NOW);
  const invalidDraft: AnnouncementDraftForm = {
    title: 'Hi',
    content: 'Too short',
    category: 'General Notice',
    priority: 'Normal',
    target_type: 'department',
    target_value: '',
    publish_mode: 'schedule',
    publish_at: '2026-11-14T09:00',
    expires_at: '2026-11-13T09:00',
    notify_on_published_edit: false,
  };

  const invalidResult = validateAnnouncementDraft(invalidDraft, store.policy, FIXED_NOW);
  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.title);
  assert.ok(invalidResult.errors.content);
  assert.ok(invalidResult.errors.target_value);
  assert.ok(invalidResult.errors.publish_at);
  assert.ok(invalidResult.errors.expires_at);

  const validDraft: AnnouncementDraftForm = {
    title: 'Weekend Digital Archive Maintenance',
    content: 'Online catalog search remains active while shelf request queues undergo indexing.',
    category: 'Maintenance',
    priority: 'Important',
    target_type: 'all_students',
    target_value: '',
    publish_mode: 'schedule',
    publish_at: '2026-11-16T09:00',
    expires_at: '2026-11-18T18:00',
    notify_on_published_edit: false,
  };
  const validResult = validateAnnouncementDraft(validDraft, store.policy, FIXED_NOW);
  assert.equal(validResult.valid, true);

  const payload = buildAnnouncementApiPayload(validDraft, false);
  assert.equal(payload.target_value, null);
  assert.equal(payload.publish_mode, 'schedule');
});

test('filterAndPaginateAnnouncements and buildAnnouncementsApiQueryParams filter tabs and search accurately', () => {
  const store = createSampleAnnouncementsStore(FIXED_NOW);
  const result = filterAndPaginateAnnouncements(
    store.items,
    {
      tab: 'Published',
      query: 'Reading Hall',
      category: 'All',
      targetType: 'All',
      publishDate: '',
    },
    1,
    10
  );
  assert.equal(result.totalCount, 1);
  assert.equal(result.items[0].announcement_id, 301);

  const params = buildAnnouncementsApiQueryParams(
    {
      tab: 'Drafts',
      query: 'clearance',
      category: 'Book Return Reminder',
      targetType: 'academic_year',
      publishDate: '',
    },
    1,
    10
  );
  assert.equal(params.get('status'), 'Draft');
  assert.equal(params.get('target_type'), 'academic_year');
});

test('isAnnouncementExpired detects past expiry timestamps reliably', () => {
  const store = createSampleAnnouncementsStore(FIXED_NOW);
  const archived = store.items.find((a) => a.announcement_id === 305)!;
  const activePub = store.items.find((a) => a.announcement_id === 301)!;

  assert.equal(isAnnouncementExpired(archived, FIXED_NOW), true);
  assert.equal(isAnnouncementExpired(activePub, FIXED_NOW), false);
});

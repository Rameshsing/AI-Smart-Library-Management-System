import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildValidatedUserPrivatePayload,
  buildValidatedUserProfilePayload,
  isValidFirestoreId,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_LIST_ITEMS,
} from './firestoreValidation.ts';

test('firestoreValidation enforces firebase-blueprint.json regex, maxLength, and bounded list rules', () => {
  assert.equal(isValidFirestoreId('user_123-abc'), true);
  assert.equal(isValidFirestoreId('bad id with spaces'), false);
  assert.equal(isValidFirestoreId('x'.repeat(129)), false);

  const profile = buildValidatedUserProfilePayload({
    uid: 'uid_abc_123',
    displayName: 'A'.repeat(200),
    interests: Array.from({ length: 25 }, (_, i) => `Topic ${i}`),
    preferredSubjects: ['AI', 'ai', 'Systems'],
  });
  assert.equal(profile.displayName.length, MAX_DISPLAY_NAME_LENGTH);
  assert.equal(profile.interests.length, MAX_LIST_ITEMS);
  assert.deepEqual(profile.preferredSubjects, ['AI', 'Systems']);

  const priv = buildValidatedUserPrivatePayload({
    uid: 'uid_abc_123',
    email: 'ananya.verma@university.edu',
    studentCode: 'STU-2026-042',
  });
  assert.equal(priv.email, 'ananya.verma@university.edu');
});

test('firestore.rules covers every collection in firebase-blueprint.json and enforces Eight Pillars', () => {
  const rootDir = process.cwd();
  const blueprint = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'firebase-blueprint.json'), 'utf8')
  ) as { firestore: Record<string, unknown> };
  const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');

  assert.ok(blueprint.firestore['/users/{userId}']);
  assert.ok(blueprint.firestore['/users/{userId}/private/{docId}']);
  assert.ok(blueprint.firestore['/admins/{adminUid}']);
  assert.equal(blueprint.firestore['/driveResources/{resourceId}'], undefined);

  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('match /{document=**}'));
  assert.ok(rulesText.includes('match /users/{userId}'));
  assert.ok(rulesText.includes('match /private/{docId}'));
  assert.ok(rulesText.includes('match /admins/{adminUid}'));
  assert.equal(rulesText.includes('driveResources'), false);
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes('ramesh.s812758@gmail.com'));
  assert.ok(rulesText.includes('isValidUserProfile('));
});

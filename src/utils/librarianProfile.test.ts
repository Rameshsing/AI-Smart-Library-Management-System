import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLibrarianNotificationPrefsPayload,
  buildLibrarianProfileUpdatePayload,
  createSampleLibrarianFullProfilePayload,
  getLibrarianInitials,
  getStaffRolePermissionEntries,
  isLibrarianNotificationsDirty,
  isLibrarianPersonalDraftDirty,
  mapLibrarianProfileApiError,
  sanitizeLibrarianNotificationPreferences,
  validateLibrarianPasswordChange,
  validateLibrarianPersonalDraft,
  validateLibrarianPhotoFile,
} from './librarianProfile';

test('getLibrarianInitials strips academic honorifics cleanly', () => {
  assert.equal(getLibrarianInitials('Dr. Priya Nair'), 'PN');
  assert.equal(getLibrarianInitials('Anil Kumar'), 'AK');
  assert.equal(getLibrarianInitials(''), 'LB');
});

test('validateLibrarianPhotoFile enforces MIME whitelist and 2MB size limit', () => {
  assert.equal(
    validateLibrarianPhotoFile({
      name: 'avatar.jpg',
      type: 'image/jpeg',
      size: 512_000,
    }).isValid,
    true
  );

  assert.equal(
    validateLibrarianPhotoFile({
      name: 'xss.svg',
      type: 'image/svg+xml',
      size: 4096,
    }).isValid,
    false
  );

  assert.equal(
    validateLibrarianPhotoFile({
      name: 'huge.png',
      type: 'image/png',
      size: 3 * 1024 * 1024,
    }).isValid,
    false
  );
});

test('validateLibrarianPersonalDraft detects email change and invalid fields', () => {
  const valid = validateLibrarianPersonalDraft(
    {
      full_name: 'Dr. Priya Nair',
      email: 'priya.updated@library.university.edu',
      mobile_number: '+91 98204 51120',
      avatar_url: null,
    },
    'priya.nair@library.university.edu'
  );
  assert.equal(valid.isValid, true);
  assert.equal(valid.emailChanged, true);

  const invalid = validateLibrarianPersonalDraft({
    full_name: 'A',
    email: 'invalid-email',
    mobile_number: 'abc',
    avatar_url: 'javascript:alert(1)',
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.full_name);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.mobile_number);
  assert.ok(invalid.errors.avatar_url);
});

test('buildLibrarianProfileUpdatePayload never leaks privileged or read-only staff fields', () => {
  const draftWithExtra = {
    full_name: '  Dr. Priya Nair  ',
    email: ' PRIYA.NAIR@LIBRARY.UNIVERSITY.EDU ',
    mobile_number: '  +91 98204 51120 ',
    avatar_url: null,
    staff_code: 'ADMIN-HACK',
    role: 'admin',
    permissions: { can_manage_inventory: true },
    account_status: 'Suspended',
  };

  const payload = buildLibrarianProfileUpdatePayload(draftWithExtra);
  assert.deepEqual(Object.keys(payload).sort(), [
    'avatar_url',
    'email',
    'full_name',
    'mobile_number',
  ]);
  assert.equal(payload.full_name, 'Dr. Priya Nair');
  assert.equal(payload.email, 'priya.nair@library.university.edu');
});

test('mandatory account_security_alerts notification cannot be disabled', () => {
  const sample = createSampleLibrarianFullProfilePayload();
  const attemptedDisable = sample.notification_preferences.map((item) =>
    item.category === 'account_security_alerts'
      ? { ...item, in_app_enabled: false }
      : { ...item, in_app_enabled: false }
  );

  const sanitized = sanitizeLibrarianNotificationPreferences(attemptedDisable);
  const secItem = sanitized.find((i) => i.category === 'account_security_alerts');
  const overdueItem = sanitized.find((i) => i.category === 'overdue_alerts');

  assert.equal(secItem?.in_app_enabled, true);
  assert.equal(overdueItem?.in_app_enabled, false);

  const apiPayload = buildLibrarianNotificationPrefsPayload(attemptedDisable);
  assert.equal(
    apiPayload.preferences.find((p) => p.category === 'account_security_alerts')?.in_app_enabled,
    true
  );
});

test('validateLibrarianPasswordChange enforces current password, mismatch, and reuse', () => {
  const mismatch = validateLibrarianPasswordChange({
    current_password: 'OldPassword#12',
    new_password: 'NewStrongPassword#99',
    confirm_new_password: 'DifferentPassword#99',
  });
  assert.equal(mismatch.isValid, false);
  assert.ok(mismatch.errors.confirm_new_password);

  const sameAsOld = validateLibrarianPasswordChange({
    current_password: 'OldPassword#12',
    new_password: 'OldPassword#12',
    confirm_new_password: 'OldPassword#12',
  });
  assert.equal(sameAsOld.isValid, false);
  assert.ok(sameAsOld.errors.new_password);

  const valid = validateLibrarianPasswordChange({
    current_password: 'OldPassword#12',
    new_password: 'NewStrongPassword#99',
    confirm_new_password: 'NewStrongPassword#99',
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.strength.label, 'Strong');
});

test('dirty state helpers and permission list mapper behave accurately', () => {
  const sample = createSampleLibrarianFullProfilePayload();
  const saved = {
    full_name: sample.librarian.full_name,
    email: sample.librarian.email,
    mobile_number: sample.librarian.mobile_number,
    avatar_url: sample.librarian.avatar_url,
  };
  assert.equal(isLibrarianPersonalDraftDirty(saved, saved), false);
  assert.equal(
    isLibrarianPersonalDraftDirty({ ...saved, full_name: 'Dr. Priya Nair-Rao' }, saved),
    true
  );
  assert.equal(
    isLibrarianNotificationsDirty(sample.notification_preferences, sample.notification_preferences),
    false
  );

  const perms = getStaffRolePermissionEntries(sample.librarian.permissions);
  assert.equal(perms.length, 8);
  assert.match(mapLibrarianProfileApiError(403), /Library Administrators/);
});

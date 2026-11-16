import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOGIN_ROLE_CONFIGS,
  resolveVerifiedDashboardRoute,
  validateForgotPasswordEmail,
  validateLoginCredentials,
} from './authLogin';

test('validateLoginCredentials rejects empty fields and malformed emails while accepting valid IDs and emails', () => {
  const empty = validateLoginCredentials({
    role: 'student',
    identifier: '',
    password: '',
  });
  assert.equal(empty.isValid, false);
  assert.ok(empty.errors.identifier);
  assert.ok(empty.errors.password);

  const badEmail = validateLoginCredentials({
    role: 'librarian',
    identifier: 'staff@invalid',
    password: 'Secret123!',
  });
  assert.equal(badEmail.isValid, false);
  assert.ok(badEmail.errors.identifier);

  const badId = validateLoginCredentials({
    role: 'student',
    identifier: 'ab',
    password: 'Secret123!',
  });
  assert.equal(badId.isValid, false);
  assert.ok(badId.errors.identifier);

  const validStudentId = validateLoginCredentials({
    role: 'student',
    identifier: 'STU-2026-042',
    password: 'Secret123!',
  });
  assert.equal(validStudentId.isValid, true);

  const validAdminEmail = validateLoginCredentials({
    role: 'admin',
    identifier: 'admin@university.edu',
    password: 'Secret123!',
  });
  assert.equal(validAdminEmail.isValid, true);
});

test('LOGIN_ROLE_CONFIGS restricts student signup link strictly to student role', () => {
  assert.equal(LOGIN_ROLE_CONFIGS.student.showStudentSignupLink, true);
  assert.equal(LOGIN_ROLE_CONFIGS.librarian.showStudentSignupLink, false);
  assert.equal(LOGIN_ROLE_CONFIGS.admin.showStudentSignupLink, false);
  assert.equal(LOGIN_ROLE_CONFIGS.admin.showRememberMe, false);
});

test('validateForgotPasswordEmail enforces valid email formatting', () => {
  assert.equal(validateForgotPasswordEmail('').isValid, false);
  assert.equal(validateForgotPasswordEmail('not-valid').isValid, false);
  assert.equal(validateForgotPasswordEmail('student@university.edu').isValid, true);
});

test('resolveVerifiedDashboardRoute enforces server-verified role matching and rejects unauthenticated or mismatched roles', () => {
  const unauth = resolveVerifiedDashboardRoute('student', {
    authenticated: false,
  });
  assert.equal(unauth.allowed, false);

  const roleMismatch = resolveVerifiedDashboardRoute('admin', {
    authenticated: true,
    verified_role: 'student',
  });
  assert.equal(roleMismatch.allowed, false);
  assert.ok(roleMismatch.error?.includes('role'));

  const studentOk = resolveVerifiedDashboardRoute('student', {
    authenticated: true,
    verified_role: 'student',
  });
  assert.equal(studentOk.allowed, true);
  assert.deepEqual(studentOk.targetRoute, { name: 'student-dashboard' });

  const librarianOk = resolveVerifiedDashboardRoute('librarian', {
    authenticated: true,
    verified_role: 'librarian',
  });
  assert.equal(librarianOk.allowed, true);
  assert.deepEqual(librarianOk.targetRoute, { name: 'librarian-dashboard' });

  const adminOk = resolveVerifiedDashboardRoute('admin', {
    authenticated: true,
    verified_role: 'admin',
  });
  assert.equal(adminOk.allowed, true);
  assert.deepEqual(adminOk.targetRoute, { name: 'admin-dashboard' });
});

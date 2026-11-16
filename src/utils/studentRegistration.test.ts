import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCustomInterestItem,
  buildFlaskRegistrationPayload,
  createInitialRegistrationForm,
  evaluatePasswordStrength,
  INITIAL_READING_INTERESTS,
  toggleSelectionItem,
  validateStudentRegistration,
} from './studentRegistration';

test('evaluatePasswordStrength enforces minimum length and scores character variety', () => {
  const short = evaluatePasswordStrength('Ab1!');
  assert.equal(short.meetsMinLength, false);
  assert.equal(short.label, 'Too Short');

  const weak = evaluatePasswordStrength('abcdefgh');
  assert.equal(weak.meetsMinLength, true);
  assert.equal(weak.label, 'Weak');

  const fair = evaluatePasswordStrength('abcdefg1');
  assert.equal(fair.label, 'Fair');

  const good = evaluatePasswordStrength('Abcdefg1');
  assert.equal(good.label, 'Good');

  const strong = evaluatePasswordStrength('Abcdef1!');
  assert.equal(strong.label, 'Strong');
  assert.equal(strong.score, 4);
});

test('validateStudentRegistration catches all missing fields, invalid email, mismatching password, and missing selections', () => {
  const emptyForm = createInitialRegistrationForm();
  const emptyResult = validateStudentRegistration(emptyForm);
  assert.equal(emptyResult.isValid, false);
  assert.ok(emptyResult.errors.fullName);
  assert.ok(emptyResult.errors.studentId);
  assert.ok(emptyResult.errors.email);
  assert.ok(emptyResult.errors.institutionName);
  assert.ok(emptyResult.errors.courseDepartment);
  assert.ok(emptyResult.errors.academicYear);
  assert.ok(emptyResult.errors.password);
  assert.ok(emptyResult.errors.confirmPassword);
  assert.ok(emptyResult.errors.interests);
  assert.ok(emptyResult.errors.preferredSubjects);
  assert.ok(emptyResult.errors.acceptedTerms);

  const mismatched = {
    ...emptyForm,
    fullName: 'Aarav Sharma',
    studentId: 'STU-2026-014',
    email: 'not-an-email',
    institutionName: 'National Institute',
    courseDepartment: 'Computer Science & Engineering',
    academicYear: '2nd Year / Semester 3–4',
    password: 'Password1!',
    confirmPassword: 'Password2!',
    interests: ['Programming'],
    preferredSubjects: ['Python Programming'],
    acceptedTerms: true,
  };
  const mismatchResult = validateStudentRegistration(mismatched);
  assert.equal(mismatchResult.isValid, false);
  assert.ok(mismatchResult.errors.email);
  assert.ok(mismatchResult.errors.confirmPassword);
});

test('validateStudentRegistration passes with valid complete inputs and optional blank mobile', () => {
  const validForm = {
    ...createInitialRegistrationForm(),
    fullName: 'Aarav Sharma',
    studentId: 'STU-2026-014',
    email: 'aarav.sharma@university.edu',
    mobileNumber: '',
    institutionName: 'State University of Technology',
    courseDepartment: 'Computer Science & Engineering',
    academicYear: '2nd Year / Semester 3–4',
    password: 'LibraryPass1!',
    confirmPassword: 'LibraryPass1!',
    interests: ['Programming', 'Artificial Intelligence'],
    preferredSubjects: ['Python Programming', 'Artificial Intelligence'],
    acceptedTerms: true,
  };

  const result = validateStudentRegistration(validForm);
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test('addCustomInterestItem adds trimmed custom interest and prevents duplicates', () => {
  const base = [...INITIAL_READING_INTERESTS];
  const added = addCustomInterestItem(['Programming'], base, '  Quantum   Computing  ');
  assert.equal(added.error, undefined);
  assert.ok(added.nextSelected.includes('Quantum Computing'));
  assert.ok(added.nextAvailable.includes('Quantum Computing'));

  const duplicate = addCustomInterestItem(added.nextSelected, added.nextAvailable, 'programming');
  assert.equal(duplicate.nextSelected.filter((i) => i.toLowerCase() === 'programming').length, 1);

  const empty = addCustomInterestItem([], base, '   ');
  assert.ok(empty.error);
});

test('toggleSelectionItem and buildFlaskRegistrationPayload map cleanly to MySQL entity structure without plain password', () => {
  const toggled = toggleSelectionItem(['Programming'], 'Artificial Intelligence');
  assert.deepEqual(toggled, ['Programming', 'Artificial Intelligence']);
  const removed = toggleSelectionItem(toggled, 'programming');
  assert.deepEqual(removed, ['Artificial Intelligence']);

  const payload = buildFlaskRegistrationPayload({
    ...createInitialRegistrationForm(),
    fullName: '  Maya Lin ',
    studentId: ' STU-901 ',
    email: ' Maya.Lin@College.EDU ',
    mobileNumber: '',
    institutionName: 'Pacific Institute',
    courseDepartment: 'Data Science & Artificial Intelligence',
    academicYear: '3rd Year / Semester 5–6',
    password: 'SuperSecretPassword1!',
    confirmPassword: 'SuperSecretPassword1!',
    interests: ['Data Science'],
    preferredSubjects: ['Python Programming'],
    acceptedTerms: true,
  });

  assert.equal(payload.user.email, 'maya.lin@college.edu');
  assert.equal(payload.user.role, 'student');
  assert.equal(payload.user.password_hash_required, true);
  assert.equal('password' in payload.user, false);
  assert.equal(payload.student.full_name, 'Maya Lin');
  assert.equal(payload.student.student_code, 'STU-901');
  assert.equal(payload.student.mobile_number, null);
  assert.deepEqual(payload.student_interests, ['Data Science']);
  assert.deepEqual(payload.student_subjects, ['Python Programming']);
});

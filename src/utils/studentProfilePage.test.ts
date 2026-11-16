import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAcademicUpdatePayload,
  buildPersonalInfoUpdatePayload,
  createSampleStudentProfilePayload,
  filterTopicOptions,
  getStudentInitials,
  isAcademicInfoDirty,
  isNotificationPreferencesDirty,
  isPersonalInfoDirty,
  isRecommendationPreferencesDirty,
  isStringListDirty,
  PROFILE_READING_INTERESTS,
  validateAcademicInfo,
  validateChangePassword,
  validatePersonalInfo,
} from './studentProfilePage';
import { addCustomInterestItem, toggleSelectionItem } from './studentRegistration';
import { updatePreferenceCategoryToggle } from './notificationsPage';

describe('studentProfilePage utilities', () => {
  it('computes deterministic initials fallback from full names', () => {
    assert.equal(getStudentInitials('Ananya Verma'), 'AV');
    assert.equal(getStudentInitials('  Rahul   Kumar  Sharma '), 'RS');
    assert.equal(getStudentInitials('Ananya'), 'AN');
    assert.equal(getStudentInitials(''), 'ST');
  });

  it('validates personal information and detects email changes', () => {
    const valid = validatePersonalInfo(
      {
        full_name: 'Ananya Verma',
        email: 'ananya.new@university.edu',
        mobile_number: '+91 98765 43210',
        avatar_url: '/src/assets/images/student_avatar_profile_1794589807361.jpg',
      },
      'ananya.verma@university.edu'
    );
    assert.equal(valid.isValid, true);
    assert.equal(valid.emailChanged, true);
    assert.deepEqual(valid.errors, {});

    const invalid = validatePersonalInfo(
      {
        full_name: 'A',
        email: 'not-an-email',
        mobile_number: '12',
        avatar_url: 'javascript:alert(1)',
      },
      'ananya.verma@university.edu'
    );
    assert.equal(invalid.isValid, false);
    assert.ok(invalid.errors.full_name);
    assert.ok(invalid.errors.email);
    assert.ok(invalid.errors.mobile_number);
    assert.ok(invalid.errors.avatar_url);
  });

  it('excludes privileged/read-only fields from profile update payloads', () => {
    const payload = buildPersonalInfoUpdatePayload({
      full_name: '  Ananya Verma  ',
      email: ' Ananya.Verma@University.EDU ',
      mobile_number: '  ',
      avatar_url: '',
    });

    assert.deepEqual(payload, {
      full_name: 'Ananya Verma',
      email: 'ananya.verma@university.edu',
      mobile_number: null,
      avatar_url: null,
    });
    assert.equal('student_id' in payload, false);
    assert.equal('student_code' in payload, false);
    assert.equal('account_status' in payload, false);
    assert.equal('role' in payload, false);
  });

  it('validates and builds academic update payloads without institution or student_code overrides', () => {
    const valid = validateAcademicInfo({
      student_code: 'STU-2026-042',
      institution_name: 'National Institute of Technology & Sciences',
      course_department: 'Computer Science & Engineering',
      academic_year: '3rd Year / Semester 5–6',
      semester: 'Semester 5',
    });
    assert.equal(valid.isValid, true);

    const payload = buildAcademicUpdatePayload({
      student_code: 'TAMPERED-ID',
      institution_name: 'Tampered College',
      course_department: 'Data Science & Artificial Intelligence',
      academic_year: '4th Year / Semester 7–8',
      semester: 'Semester 7',
    });
    assert.deepEqual(payload, {
      course_department: 'Data Science & Artificial Intelligence',
      academic_year: '4th Year / Semester 7–8',
      semester: 'Semester 7',
    });
    assert.equal('student_code' in payload, false);
    assert.equal('institution_name' in payload, false);
  });

  it('supports curated topic filtering, toggling, and duplicate-free custom topic additions', () => {
    assert.equal(PROFILE_READING_INTERESTS.length >= 20, true);
    const filtered = filterTopicOptions([...PROFILE_READING_INTERESTS], 'cyber');
    assert.deepEqual(filtered, ['Cybersecurity']);

    const toggledOff = toggleSelectionItem(['Artificial Intelligence', 'Cybersecurity'], 'cybersecurity');
    assert.deepEqual(toggledOff, ['Artificial Intelligence']);

    const customAdd = addCustomInterestItem(
      ['Artificial Intelligence'],
      [...PROFILE_READING_INTERESTS],
      'Distributed Systems'
    );
    assert.equal(customAdd.error, undefined);
    assert.ok(customAdd.nextSelected.includes('Distributed Systems'));
    assert.ok(customAdd.nextAvailable.includes('Distributed Systems'));

    const duplicateCase = addCustomInterestItem(
      ['Artificial Intelligence'],
      [...PROFILE_READING_INTERESTS],
      'artificial intelligence'
    );
    assert.equal(duplicateCase.nextSelected.length, 1);
  });

  it('validates change-password rules and strength checks securely', () => {
    const missingCurrent = validateChangePassword({
      current_password: '',
      new_password: 'NewStrong!Password9',
      confirm_new_password: 'NewStrong!Password9',
    });
    assert.equal(missingCurrent.isValid, false);
    assert.ok(missingCurrent.errors.current_password);

    const reusedPassword = validateChangePassword({
      current_password: 'SamePassword!123',
      new_password: 'SamePassword!123',
      confirm_new_password: 'SamePassword!123',
    });
    assert.equal(reusedPassword.isValid, false);
    assert.ok(reusedPassword.errors.new_password);

    const validChange = validateChangePassword({
      current_password: 'OldPassword!123',
      new_password: 'NewStrong!Password9',
      confirm_new_password: 'NewStrong!Password9',
    });
    assert.equal(validChange.isValid, true);
    assert.equal(validChange.strength.score, 4);
  });

  it('tracks dirty state accurately across profile sections', () => {
    const sample = createSampleStudentProfilePayload(undefined, new Date('2026-04-10T10:00:00'));

    assert.equal(isPersonalInfoDirty({ ...sample.personal }, sample.personal), false);
    assert.equal(
      isPersonalInfoDirty({ ...sample.personal, full_name: 'Ananya V.' }, sample.personal),
      true
    );

    assert.equal(isAcademicInfoDirty({ ...sample.academic }, sample.academic), false);
    assert.equal(
      isAcademicInfoDirty({ ...sample.academic, semester: 'Semester 6' }, sample.academic),
      true
    );

    assert.equal(
      isStringListDirty(['Data Science', 'Artificial Intelligence'], ['artificial intelligence', 'data science']),
      false
    );
    assert.equal(
      isStringListDirty(['Data Science', 'Robotics'], ['Artificial Intelligence', 'Data Science']),
      true
    );

    assert.equal(
      isRecommendationPreferencesDirty(
        { ...sample.recommendation_preferences },
        sample.recommendation_preferences
      ),
      false
    );
    assert.equal(
      isRecommendationPreferencesDirty(
        { ...sample.recommendation_preferences, discovery_preference: 'explore_new' },
        sample.recommendation_preferences
      ),
      true
    );

    const toggledNotif = updatePreferenceCategoryToggle(
      sample.notification_preferences,
      'Recommendations',
      'email_enabled',
      true
    );
    assert.equal(
      isNotificationPreferencesDirty(toggledNotif, sample.notification_preferences),
      true
    );
  });
});

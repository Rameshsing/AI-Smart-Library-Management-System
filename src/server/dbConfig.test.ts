import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  formatAuthDbDebugLog,
  REQUIRED_DATABASE_MODELS,
  resolveDatabaseConnectionConfig,
  sanitizeConnectionString,
  verifyDatabaseModels,
} from './dbConfig.ts';
import { LibraryService } from './libraryService.ts';
import { createSeedDatabaseState } from './seedData.ts';

test('resolveDatabaseConnectionConfig resolves default sqlite, custom JSON/DB paths, and masks DATABASE_URL secrets', () => {
  const cwd = '/app/applet';
  const def = resolveDatabaseConnectionConfig({}, cwd);
  assert.equal(def.engine, 'sqlite');
  assert.equal(def.resolvedFilePath, path.resolve(cwd, '.data/library.db'));
  assert.equal(def.connectionSource, 'default (.data/library.db)');
  assert.equal(def.externalDatabaseUrlConfigured, false);

  const customJson = resolveDatabaseConnectionConfig(
    {
      LIBRARY_DB_PATH: './custom/db.json',
      DATABASE_URL: 'postgresql://appuser:SuperSecret99@db.internal:5432/library',
    },
    cwd
  );
  assert.equal(customJson.engine, 'local-json-store');
  assert.equal(customJson.connectionSource, 'LIBRARY_DB_PATH');
  assert.equal(customJson.resolvedFilePath, path.resolve(cwd, './custom/db.json'));
  assert.equal(customJson.externalDatabaseUrlConfigured, true);
  assert.ok(!customJson.sanitizedDatabaseUrl?.includes('SuperSecret99'));
  assert.ok(customJson.sanitizedDatabaseUrl?.includes('[REDACTED]'));

  const customSqlite = resolveDatabaseConnectionConfig(
    {
      LIBRARY_DB_PATH: './custom/library.db',
    },
    cwd
  );
  assert.equal(customSqlite.engine, 'sqlite');
  assert.equal(customSqlite.connectionSource, 'LIBRARY_DB_PATH');
  assert.equal(customSqlite.resolvedFilePath, path.resolve(cwd, './custom/library.db'));

  assert.equal(
    sanitizeConnectionString('postgres://u:p@localhost:5432/app'),
    'postgres://u:[REDACTED]@localhost:5432/app'
  );
});

test('verifyDatabaseModels confirms all required models and seeded user records are valid', () => {
  const seed = createSeedDatabaseState();
  const check = verifyDatabaseModels(seed);

  assert.equal(check.valid, true);
  assert.deepEqual(check.missingModels, []);
  assert.deepEqual(check.invalidUserIds, []);
  for (const model of REQUIRED_DATABASE_MODELS) {
    assert.ok(model in check.modelCounts, `Expected model count for ${model}`);
  }
  assert.ok(check.modelCounts.users >= 7);
  assert.ok(check.modelCounts.books >= 10);

  const broken = verifyDatabaseModels({ users: [] });
  assert.equal(broken.valid, false);
  assert.ok(broken.missingModels.includes('books'));
  assert.ok(broken.missingModels.includes('librarySettings'));
});

test('formatAuthDbDebugLog emits database connection and user query status without secrets', () => {
  const line = formatAuthDbDebugLog({
    operation: 'login_query',
    connected: true,
    engine: 'sqlite',
    target: '.data/library.db',
    identifier: 'Ananya.Verma@university.edu',
    usersScanned: 7,
    recordFound: true,
    userId: 1042,
    role: 'student',
    accountStatus: 'Active',
    passwordVerified: true,
    queryDurationMs: 1.42,
    outcome: 'authenticated',
  });

  assert.ok(line.startsWith('[AUTH DEBUG]'));
  assert.ok(line.includes('db_connected=true'));
  assert.ok(line.includes('engine=sqlite'));
  assert.ok(line.includes('record_found=true'));
  assert.ok(line.includes('user_id=1042'));
  assert.ok(line.includes('role=student'));
  assert.ok(line.includes('password_verified=true'));
  assert.ok(!line.includes('Student@123'));
  assert.ok(!line.includes('password_hash'));
});

test('SQLite store persists registered student credentials across restarts and supports login by Student ID and Email', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-sqlite-test-'));
  const dbPath = path.join(tmpDir, 'library.db');

  try {
    const firstBoot = new LibraryService({ dbFilePath: dbPath, authDebugLogger: false });
    assert.equal(firstBoot.dbConfig.engine, 'sqlite');
    const created = firstBoot.registerStudent({
      full_name: 'Kiran Rao',
      email: 'kiran.rao@university.edu',
      student_id: 'STU-9910',
      department: 'Computer Science',
      academic_year: '2nd Year',
      password: 'MyStrongPassword1!',
      interests: ['Machine Learning', 'Databases'],
      firebase_uid: 'fb_uid_kiran_9910',
    });
    assert.equal(created.code, 'STU-9910');
    assert.equal(created.firebase_uid, 'fb_uid_kiran_9910');
    firstBoot.close();

    // Reopen fresh LibraryService instance from SQLite file
    const secondBoot = new LibraryService({ dbFilePath: dbPath, authDebugLogger: false });
    const byEmail = secondBoot.authenticateUser(
      'KIRAN.RAO@UNIVERSITY.EDU',
      'MyStrongPassword1!',
      'student'
    );
    const byId = secondBoot.authenticateUser('stu-9910', 'MyStrongPassword1!', 'student');
    assert.equal(byEmail.user_id, created.user_id);
    assert.equal(byId.user_id, created.user_id);
    assert.equal(byId.firebase_uid, 'fb_uid_kiran_9910');
    secondBoot.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SQLite store auto-migrates legacy library-db.json and supports Firebase profile restoration', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-migrate-test-'));
  const legacyJsonPath = path.join(tmpDir, 'library-db.json');
  const dbPath = path.join(tmpDir, 'library.db');

  try {
    // Seed a legacy JSON store with a registered user
    const legacyService = new LibraryService({
      dbFilePath: legacyJsonPath,
      authDebugLogger: false,
    });
    assert.equal(legacyService.dbConfig.engine, 'local-json-store');
    legacyService.registerStudent({
      full_name: 'Meera Nair',
      email: 'meera.nair@university.edu',
      student_id: 'STU-7701',
      department: 'Data Science',
      academic_year: '3rd Year',
      password: 'LegacyUserPass1!',
      interests: ['Data Science'],
    });

    // Boot SQLite store in same directory -> should auto-migrate legacy user
    const sqliteService = new LibraryService({ dbFilePath: dbPath, authDebugLogger: false });
    const migratedUser = sqliteService.authenticateUser(
      'STU-7701',
      'LegacyUserPass1!',
      'student'
    );
    assert.equal(migratedUser.email, 'meera.nair@university.edu');

    // Test Firebase restore into a fresh SQLite container with Firestore profile hint
    const restored = sqliteService.restoreOrAuthenticateFirebaseUser({
      email: 'cloud.student@university.edu',
      uid: 'fb_cloud_123',
      password: 'CloudRecovered1!',
      requestedRole: 'student',
      profileHint: {
        displayName: 'Cloud Student',
        studentCode: 'STU-8842',
        department: 'Artificial Intelligence',
        academicYear: '4th Year',
        interests: ['Deep Learning', 'NLP'],
        preferredSubjects: ['Transformers'],
      },
    });
    assert.equal(restored.code, 'STU-8842');
    assert.equal(restored.department, 'Artificial Intelligence');
    assert.deepEqual(restored.interests, ['Deep Learning', 'NLP']);

    // Verify subsequent local login by Student ID works immediately after restoration
    const afterRestoreLogin = sqliteService.authenticateUser(
      'STU-8842',
      'CloudRecovered1!',
      'student'
    );
    assert.equal(afterRestoreLogin.user_id, restored.user_id);
    sqliteService.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

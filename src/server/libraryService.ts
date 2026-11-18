import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeLiveRecommendations,
  RECOMMENDATION_SCORING_CONFIG,
} from '../utils/recommendationEngine.ts';
import {
  formatAuthDbDebugLog,
  resolveDatabaseConnectionConfig,
  verifyDatabaseModels,
  type AuthDbDebugEvent,
  type DatabaseConnectionConfig,
} from './dbConfig.ts';
import {
  hashPassword,
  sanitizeAuditDetails,
  sanitizePlainText,
  sanitizeUserPublicSummary,
  verifyPassword,
  withLock,
} from './security.ts';
import {
  createSeedDatabaseState,
  reconcileAllBookCounts,
  reconcileBookCounts,
  reconcileBookRatings,
} from './seedData.ts';
import {
  getDaysDifferenceFromToday,
  resolveTargetStudents,
  runMaintenanceScheduler,
} from './scheduler.ts';
import { SqliteLibraryStore } from './sqliteStore.ts';
import type {
  DbAnnouncement,
  DbBook,
  DbBookCopy,
  DbBorrowing,
  DbNotification,
  DbReservation,
  DbSession,
  DbUser,
  LibraryDbState,
  SessionResponsePayload,
  UserRole,
} from './types.ts';
import type { AdminPermissions, AdminProfile } from '../utils/adminDashboard.ts';
import type {
  AdminAuditLogEntry,
  PermissionKey,
  RolePermissionDefinition,
  StaffAccountRecord,
} from '../utils/adminManagement.ts';
import type {
  BookCopyRecord,
  BookDetailPayload,
  BookReviewRecord,
  DetailedBookRecord,
  RatingBreakdownItem,
} from '../utils/bookDetails.ts';
import type { CatalogBook } from '../utils/bookCatalog.ts';
import type { LibrarianProfile } from '../utils/librarianDashboard.ts';
import type {
  ActiveBorrowingDetail,
  CirculationPolicy,
  CirculationStudentRecord,
  ReturnCopyCondition,
} from '../utils/librarianCirculation.ts';
import type { CopyCondition, CopyStatus, InventoryBookItem, InventoryPhysicalCopy } from '../utils/librarianInventory.ts';
import type { OverdueRecordItem } from '../utils/librarianOverdue.ts';
import type { LibrarianReservationItem } from '../utils/librarianReservations.ts';
import type { LibrarianStudentDirectoryItem } from '../utils/librarianStudents.ts';
import type {
  NotificationItem,
  NotificationPreferencesPayload,
  NotificationsPayload,
} from '../utils/notificationsPage.ts';
import type {
  ReadingActivityChartPoint,
  ReadingHistoryPayload,
  ReadingHistoryRecord,
} from '../utils/readingHistory.ts';
import type { RecommendationFeedbackValue, RecommendationsPayload } from '../utils/recommendationsPage.ts';
import type {
  ReservationRecord,
  ReservationsPayload,
  ReservationStatus,
} from '../utils/reservationsPage.ts';
import type { StudentDashboardPayload } from '../utils/studentDashboard.ts';
import type { StudentProfileFullPayload } from '../utils/studentProfilePage.ts';

export class HttpError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code: string = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface LibraryStoreOptions {
  dbFilePath?: string | null;
  initialState?: LibraryDbState;
  authDebugLogger?: ((line: string, event: AuthDbDebugEvent) => void) | false;
}

export class LibraryService {
  state: LibraryDbState;
  private dbFilePath: string | null;
  private sqliteStore: SqliteLibraryStore | null = null;
  readonly dbConfig: DatabaseConnectionConfig;
  private authDebugLogger: ((line: string, event: AuthDbDebugEvent) => void) | null;

  constructor(options: LibraryStoreOptions = {}) {
    this.dbFilePath = options.dbFilePath ?? null;
    this.dbConfig = resolveDatabaseConnectionConfig(
      process.env,
      process.cwd(),
      options.initialState ? null : this.dbFilePath
    );
    this.authDebugLogger =
      options.authDebugLogger === false
        ? null
        : options.authDebugLogger ?? ((line) => console.info(line));

    if (options.initialState) {
      this.state = options.initialState;
    } else if (this.dbConfig.engine === 'sqlite' && this.dbFilePath) {
      this.sqliteStore = new SqliteLibraryStore(this.dbFilePath);
      const legacyJsonPath = path.join(path.dirname(this.dbFilePath), 'library-db.json');
      this.state = this.sqliteStore.loadOrInitialize(legacyJsonPath);
    } else if (this.dbFilePath && fs.existsSync(this.dbFilePath)) {
      const raw = fs.readFileSync(this.dbFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LibraryDbState>;
      const verification = verifyDatabaseModels(parsed);
      if (!verification.valid) {
        const defaults = createSeedDatabaseState();
        this.state = {
          ...defaults,
          ...parsed,
          nextIds: { ...defaults.nextIds, ...(parsed.nextIds ?? {}) },
          librarySettings: parsed.librarySettings ?? defaults.librarySettings,
        } as LibraryDbState;
        this.persist();
      } else {
        this.state = parsed as LibraryDbState;
      }
      reconcileAllBookCounts(this.state);
    } else {
      this.state = createSeedDatabaseState();
      this.persist();
    }
  }

  getDatabaseDiagnostics() {
    const modelVerification = verifyDatabaseModels(this.state);
    return {
      connected: true,
      engine: this.dbConfig.engine,
      connection_source: this.dbConfig.connectionSource,
      target: this.dbConfig.sanitizedTarget,
      external_database_url_configured: this.dbConfig.externalDatabaseUrlConfigured,
      ephemeral_local_storage: this.dbConfig.isEphemeralLocalStorage,
      models_verified: modelVerification.valid,
      missing_models: modelVerification.missingModels,
      invalid_user_ids: modelVerification.invalidUserIds,
      model_counts: modelVerification.modelCounts,
    };
  }

  emitAuthDebug(
    event: Omit<AuthDbDebugEvent, 'connected' | 'engine' | 'target' | 'usersScanned'>
  ): void {
    if (!this.authDebugLogger) return;
    const fullEvent: AuthDbDebugEvent = {
      ...event,
      connected: true,
      engine: this.dbConfig.engine,
      target: this.dbConfig.sanitizedTarget,
      usersScanned: this.state.users.length,
    };
    const line = formatAuthDbDebugLog(fullEvent);
    this.authDebugLogger(line, fullEvent);
  }

  persist(): void {
    if (this.sqliteStore) {
      this.sqliteStore.saveState(this.state);
      return;
    }
    if (!this.dbFilePath) return;
    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.dbFilePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.dbFilePath);
  }

  close(): void {
    this.sqliteStore?.close();
    this.sqliteStore = null;
  }

  runScheduler(now: Date = new Date()) {
    const summary = runMaintenanceScheduler(this.state, now);
    this.persist();
    return summary;
  }

  private addAuditLog(entry: Omit<AdminAuditLogEntry, 'log_id' | 'timestamp'>) {
    const log: AdminAuditLogEntry = {
      ...entry,
      details: sanitizeAuditDetails(entry.details),
      log_id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      timestamp: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(log);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
  }

  private addNotification(
    payload: Omit<DbNotification, 'notification_id'>
  ): DbNotification {
    const created: DbNotification = {
      ...payload,
      notification_id: this.state.nextIds.notification++,
    };
    this.state.notifications.unshift(created);
    return created;
  }

  // ==================== AUTH & SESSION ====================

  createSession(
    user: DbUser,
    deviceLabel: string = 'Web Browser',
    ipAddress: string = '127.0.0.1',
    rememberMe: boolean = false
  ): { session: DbSession; maxAgeMs: number } {
    const maxAgeMs = rememberMe ? 30 * 86_400_000 : 24 * 3_600_000;
    const now = new Date();
    const session: DbSession = {
      session_id: `sess_${crypto.randomBytes(24).toString('hex')}`,
      user_id: user.user_id,
      role: user.role,
      device_label: deviceLabel.slice(0, 80),
      ip_address: ipAddress,
      created_at: now.toISOString(),
      last_active_at: now.toISOString(),
      expires_at: new Date(now.getTime() + maxAgeMs).toISOString(),
    };
    this.state.sessions.push(session);
    this.persist();
    return { session, maxAgeMs };
  }

  getSessionUser(sessionId: string | null): { session: DbSession; user: DbUser } | null {
    if (!sessionId) return null;
    const nowMs = Date.now();
    const session = this.state.sessions.find((s) => s.session_id === sessionId);
    if (!session) return null;
    if (new Date(session.expires_at).getTime() <= nowMs) {
      this.state.sessions = this.state.sessions.filter((s) => s.session_id !== sessionId);
      this.persist();
      return null;
    }
    const user = this.state.users.find((u) => u.user_id === session.user_id);
    if (!user || user.account_status !== 'Active') {
      return null;
    }
    session.last_active_at = new Date().toISOString();
    return { session, user };
  }

  destroySession(sessionId: string | null): void {
    if (!sessionId) return;
    const before = this.state.sessions.length;
    this.state.sessions = this.state.sessions.filter((s) => s.session_id !== sessionId);
    if (this.state.sessions.length !== before) {
      this.persist();
    }
  }

  authenticateUser(
    identifier: string,
    password: string,
    requestedRole?: UserRole
  ): DbUser {
    const startedAt = performance.now();
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !password) {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanId || '<empty>',
        recordFound: false,
        passwordVerified: false,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'invalid_input',
      });
      throw new HttpError(400, 'Identifier and password are required.', 'INVALID_INPUT');
    }

    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === cleanId || u.code.toLowerCase() === cleanId
    );
    if (!user) {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanId,
        recordFound: false,
        passwordVerified: false,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'user_not_found',
      });
      throw new HttpError(
        401,
        'Invalid credentials. Please check your email/ID and password.',
        'INVALID_CREDENTIALS'
      );
    }

    const passwordMatched = verifyPassword(password, user.password_hash);
    if (!passwordMatched) {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanId,
        recordFound: true,
        userId: user.user_id,
        role: user.role,
        accountStatus: user.account_status,
        passwordVerified: false,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'password_mismatch',
      });
      throw new HttpError(
        401,
        'Invalid credentials. Please check your email/ID and password.',
        'INVALID_CREDENTIALS'
      );
    }

    if (user.account_status !== 'Active') {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanId,
        recordFound: true,
        userId: user.user_id,
        role: user.role,
        accountStatus: user.account_status,
        passwordVerified: true,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'account_inactive',
      });
      throw new HttpError(
        403,
        `Your account status is ${user.account_status}. Please contact a library administrator.`,
        'ACCOUNT_INACTIVE'
      );
    }

    if (requestedRole && user.role !== requestedRole) {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanId,
        recordFound: true,
        userId: user.user_id,
        role: user.role,
        accountStatus: user.account_status,
        passwordVerified: true,
        queryDurationMs: performance.now() - startedAt,
        outcome: `role_mismatch_expected_${requestedRole}`,
      });
      throw new HttpError(
        403,
        `Account role mismatch: your account is registered as "${user.role}", not "${requestedRole}".`,
        'ROLE_MISMATCH'
      );
    }

    this.emitAuthDebug({
      operation: 'login_query',
      identifier: cleanId,
      recordFound: true,
      userId: user.user_id,
      role: user.role,
      accountStatus: user.account_status,
      passwordVerified: true,
      queryDurationMs: performance.now() - startedAt,
      outcome: 'authenticated',
    });

    return user;
  }

  registerStudent(input: {
    full_name: string;
    email: string;
    student_id: string;
    department: string;
    academic_year: string;
    password: string;
    interests: string[];
    preferred_subjects?: string[];
    mobile?: string | null;
    institution?: string;
    firebase_uid?: string | null;
  }): DbUser {
    const startedAt = performance.now();
    const cleanName = sanitizePlainText(input.full_name);
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanCode = input.student_id.trim().toUpperCase();
    const cleanDept = sanitizePlainText(input.department) || 'Computer Science';
    const cleanYear = sanitizePlainText(input.academic_year) || '1st Year';
    const cleanInstitution = sanitizePlainText(input.institution ?? '');
    const cleanMobile = input.mobile ? sanitizePlainText(input.mobile) : null;
    const cleanFirebaseUid = input.firebase_uid ? sanitizePlainText(input.firebase_uid) : null;

    if (!cleanName || cleanName.length < 2) {
      throw new HttpError(400, 'Please enter your full name.', 'INVALID_NAME');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      throw new HttpError(400, 'Please enter a valid email address.', 'INVALID_EMAIL');
    }
    if (!cleanCode || cleanCode.length < 3) {
      throw new HttpError(400, 'Please enter a valid Student ID.', 'INVALID_CODE');
    }
    if (!input.password || input.password.length < 8) {
      throw new HttpError(
        400,
        'Password must be at least 8 characters long.',
        'WEAK_PASSWORD'
      );
    }
    if (!Array.isArray(input.interests) || input.interests.length === 0) {
      throw new HttpError(
        400,
        'Please select at least one reading interest.',
        'MISSING_INTERESTS'
      );
    }

    const emailExists = this.state.users.some((u) => u.email.toLowerCase() === cleanEmail);
    if (emailExists) {
      throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_EXISTS');
    }
    const codeExists = this.state.users.some((u) => u.code.toLowerCase() === cleanCode.toLowerCase());
    if (codeExists) {
      throw new HttpError(409, 'This Student ID is already registered.', 'CODE_EXISTS');
    }

    const nowIso = new Date().toISOString();
    const userId = this.state.nextIds.user++;
    const cleanInterests = input.interests
      .map((i) => sanitizePlainText(i))
      .filter(Boolean);
    const cleanSubjects = Array.isArray(input.preferred_subjects)
      ? input.preferred_subjects.map((s) => sanitizePlainText(s)).filter(Boolean)
      : [];

    const newUser: DbUser = {
      user_id: userId,
      role: 'student',
      full_name: cleanName,
      email: cleanEmail,
      code: cleanCode,
      password_hash: hashPassword(input.password),
      firebase_uid: cleanFirebaseUid,
      account_status: 'Active',
      avatar_url: null,
      must_change_password: false,
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
      department: cleanDept,
      program: `B.Tech ${cleanDept}`,
      institution:
        cleanInstitution || this.state.librarySettings.general_settings.library_name,
      academic_year: cleanYear,
      semester: 'Semester 1',
      mobile: cleanMobile,
      interests: cleanInterests,
      preferred_subjects:
        cleanSubjects.length > 0 ? cleanSubjects : cleanInterests.slice(0, 3),
      preferred_authors: [],
      restriction_reason: null,
      recommendation_preferences: {
        preferred_topics: cleanInterests.slice(0, 4),
        discovery_preference: 'balanced',
        reading_level: 'No preference',
        content_formats: ['Print Books', 'eBooks'],
        content_languages: ['English'],
        avoid_previously_read: true,
        availability_preference: 'available_first',
      },
      notification_preferences: {
        categories: [
          { category: 'Borrowing', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Due Date Reminders', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required to prevent accidental overdue loans', email_supported: true },
          { category: 'Overdue', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Mandatory institutional circulation notice', email_supported: true },
          { category: 'Reservations', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Recommendations', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Reviews & Feedback', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: false },
          { category: 'Library Announcements', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Account & Security', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required for password & session security', email_supported: true },
        ],
        reminder_timings: ['2_days_before', '1_day_before', 'on_due_date'],
        allow_reminder_customization: true,
        email_delivery_configured: true,
        configured_loan_period_days: this.state.librarySettings.loan_policy.default_loan_duration_days,
      },
    };

    this.state.users.push(newUser);
    this.addNotification({
      user_id: newUser.user_id,
      title: 'Welcome to the AI Smart Library!',
      message: `Your account (${cleanCode}) is active. Explore catalog books and cold-start recommendations tailored to ${cleanInterests.slice(0, 2).join(' & ')}.`,
      category: 'Recommendations',
      priority: 'Normal',
      is_read: false,
      related_entity_type: 'account',
      related_entity_id: newUser.user_id,
      related_book_id: null,
      related_book_title: null,
      action_label: 'Explore Recommendations',
      action_url: '/student/recommendations',
      created_at: nowIso,
      read_at: null,
      can_delete: true,
      is_mandatory: false,
      announcement_author: null,
      dedupe_key: `welcome-${newUser.user_id}`,
    });
    this.persist();
    this.emitAuthDebug({
      operation: 'register_query',
      identifier: cleanEmail,
      recordFound: true,
      userId: newUser.user_id,
      role: newUser.role,
      accountStatus: newUser.account_status,
      persisted: Boolean(this.dbFilePath),
      queryDurationMs: performance.now() - startedAt,
      outcome: 'student_created',
    });
    return newUser;
  }

  authenticateOrProvisionGoogleUser(input: {
    email: string;
    name?: string;
    uid: string;
    requestedRole?: UserRole;
    profileHint?: {
      displayName?: string;
      studentCode?: string;
      department?: string;
      academicYear?: string;
      interests?: string[];
      preferredSubjects?: string[];
    };
  }): DbUser {
    const startedAt = performance.now();
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new HttpError(400, 'Verified Google email address is required.', 'INVALID_EMAIL');
    }

    const existing = this.state.users.find(
      (u) => u.email.toLowerCase() === cleanEmail || (input.uid && u.firebase_uid === input.uid)
    );
    if (existing) {
      if (existing.account_status !== 'Active') {
        this.emitAuthDebug({
          operation: 'login_query',
          identifier: cleanEmail,
          recordFound: true,
          userId: existing.user_id,
          role: existing.role,
          accountStatus: existing.account_status,
          passwordVerified: true,
          queryDurationMs: performance.now() - startedAt,
          outcome: 'account_inactive_google',
        });
        throw new HttpError(
          403,
          `Your account status is ${existing.account_status}. Please contact a library administrator.`,
          'ACCOUNT_INACTIVE'
        );
      }

      if (input.requestedRole && existing.role !== input.requestedRole) {
        this.emitAuthDebug({
          operation: 'login_query',
          identifier: cleanEmail,
          recordFound: true,
          userId: existing.user_id,
          role: existing.role,
          accountStatus: existing.account_status,
          passwordVerified: true,
          queryDurationMs: performance.now() - startedAt,
          outcome: `role_mismatch_expected_${input.requestedRole}`,
        });
        throw new HttpError(
          403,
          `Account role mismatch: your account is registered as "${existing.role}", not "${input.requestedRole}".`,
          'ROLE_MISMATCH'
        );
      }

      if (input.uid && existing.firebase_uid !== input.uid) {
        existing.firebase_uid = input.uid;
        existing.updated_at = new Date().toISOString();
        this.persist();
      }

      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanEmail,
        recordFound: true,
        userId: existing.user_id,
        role: existing.role,
        accountStatus: existing.account_status,
        passwordVerified: true,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'authenticated_google',
      });
      return existing;
    }

    if (input.requestedRole && input.requestedRole !== 'student') {
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanEmail,
        recordFound: false,
        passwordVerified: true,
        queryDurationMs: performance.now() - startedAt,
        outcome: `google_unprovisioned_for_${input.requestedRole}`,
      });
      throw new HttpError(
        403,
        `No ${input.requestedRole} account is provisioned for ${cleanEmail}. Staff and administrator accounts must be created by an administrator.`,
        'STAFF_ACCOUNT_REQUIRED'
      );
    }

    const hint = input.profileHint;
    const displayName =
      sanitizePlainText(hint?.displayName ?? '') ||
      sanitizePlainText(input.name ?? '') ||
      cleanEmail.split('@')[0] ||
      'Google Library Member';
    const userId = this.state.nextIds.user++;
    const hintedCode = hint?.studentCode ? sanitizePlainText(hint.studentCode).toUpperCase() : '';
    const canUseHintedCode =
      hintedCode.length >= 3 &&
      !this.state.users.some((u) => u.code.toLowerCase() === hintedCode.toLowerCase());
    const studentCode = canUseHintedCode
      ? hintedCode
      : `STU-GGL-${String(userId).padStart(4, '0')}`;
    const generatedPassword = crypto.randomBytes(24).toString('hex');
    const nowIso = new Date().toISOString();
    const defaultInterests = ['Artificial Intelligence', 'Computer Science', 'Data Science'];
    const hintedInterests = Array.isArray(hint?.interests)
      ? hint.interests.map((x) => sanitizePlainText(x)).filter(Boolean)
      : [];
    const resolvedInterests = hintedInterests.length > 0 ? hintedInterests : defaultInterests;
    const hintedSubjects = Array.isArray(hint?.preferredSubjects)
      ? hint.preferredSubjects.map((x) => sanitizePlainText(x)).filter(Boolean)
      : [];
    const resolvedSubjects =
      hintedSubjects.length > 0 ? hintedSubjects : ['Machine Learning', 'Algorithms'];
    const resolvedDepartment =
      sanitizePlainText(hint?.department ?? '') || 'Computer Science';
    const resolvedAcademicYear =
      sanitizePlainText(hint?.academicYear ?? '') || '1st Year';

    const newUser: DbUser = {
      user_id: userId,
      role: 'student',
      full_name: displayName,
      email: cleanEmail,
      code: studentCode,
      password_hash: hashPassword(generatedPassword),
      firebase_uid: input.uid,
      account_status: 'Active',
      avatar_url: null,
      must_change_password: false,
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
      department: resolvedDepartment,
      program: `B.Tech ${resolvedDepartment}`,
      institution: this.state.librarySettings.general_settings.library_name,
      academic_year: resolvedAcademicYear,
      semester: 'Semester 1',
      mobile: null,
      interests: resolvedInterests,
      preferred_subjects: resolvedSubjects,
      preferred_authors: [],
      restriction_reason: null,
      recommendation_preferences: {
        preferred_topics: resolvedInterests.slice(0, 4),
        discovery_preference: 'balanced',
        reading_level: 'No preference',
        content_formats: ['Print Books', 'eBooks'],
        content_languages: ['English'],
        avoid_previously_read: true,
        availability_preference: 'available_first',
      },
      notification_preferences: {
        categories: [
          { category: 'Borrowing', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Due Date Reminders', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required to prevent accidental overdue loans', email_supported: true },
          { category: 'Overdue', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Mandatory institutional circulation notice', email_supported: true },
          { category: 'Reservations', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Recommendations', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Reviews & Feedback', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: false },
          { category: 'Library Announcements', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Account & Security', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required for password & session security', email_supported: true },
        ],
        reminder_timings: ['2_days_before', '1_day_before', 'on_due_date'],
        allow_reminder_customization: true,
        email_delivery_configured: true,
        configured_loan_period_days: this.state.librarySettings.loan_policy.default_loan_duration_days,
      },
    };

    this.state.users.push(newUser);
    this.addNotification({
      user_id: newUser.user_id,
      title: 'Welcome via Google Sign-In!',
      message: `Your student account (${studentCode}) is active and ready for personalised library recommendations.`,
      category: 'Recommendations',
      priority: 'Normal',
      is_read: false,
      related_entity_type: 'account',
      related_entity_id: newUser.user_id,
      related_book_id: null,
      related_book_title: null,
      action_label: 'Explore Recommendations',
      action_url: '/student/recommendations',
      created_at: nowIso,
      read_at: null,
      can_delete: true,
      is_mandatory: false,
      announcement_author: null,
      dedupe_key: `welcome-google-${newUser.user_id}`,
    });
    this.persist();
    this.emitAuthDebug({
      operation: 'register_query',
      identifier: cleanEmail,
      recordFound: true,
      userId: newUser.user_id,
      role: newUser.role,
      accountStatus: newUser.account_status,
      persisted: Boolean(this.dbFilePath),
      queryDurationMs: performance.now() - startedAt,
      outcome: 'student_created_google',
    });
    return newUser;
  }

  restoreOrAuthenticateFirebaseUser(input: {
    email: string;
    uid: string;
    name?: string;
    password?: string;
    requestedRole?: UserRole;
    profileHint?: {
      displayName?: string;
      studentCode?: string;
      department?: string;
      academicYear?: string;
      interests?: string[];
      preferredSubjects?: string[];
    };
  }): DbUser {
    const startedAt = performance.now();
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new HttpError(400, 'Verified Firebase email address is required.', 'INVALID_EMAIL');
    }

    const existing = this.state.users.find(
      (u) => u.email.toLowerCase() === cleanEmail || (input.uid && u.firebase_uid === input.uid)
    );
    if (existing) {
      if (existing.account_status !== 'Active') {
        throw new HttpError(
          403,
          `Your account status is ${existing.account_status}. Please contact a library administrator.`,
          'ACCOUNT_INACTIVE'
        );
      }
      if (input.requestedRole && existing.role !== input.requestedRole) {
        throw new HttpError(
          403,
          `Account role mismatch: your account is registered as "${existing.role}", not "${input.requestedRole}".`,
          'ROLE_MISMATCH'
        );
      }
      let dirty = false;
      if (input.uid && existing.firebase_uid !== input.uid) {
        existing.firebase_uid = input.uid;
        dirty = true;
      }
      if (
        existing.role === 'student' &&
        input.password &&
        input.password.length >= 8 &&
        !verifyPassword(input.password, existing.password_hash)
      ) {
        existing.password_hash = hashPassword(input.password);
        dirty = true;
      }
      if (dirty) {
        existing.updated_at = new Date().toISOString();
        this.persist();
      }
      this.emitAuthDebug({
        operation: 'login_query',
        identifier: cleanEmail,
        recordFound: true,
        userId: existing.user_id,
        role: existing.role,
        accountStatus: existing.account_status,
        passwordVerified: true,
        queryDurationMs: performance.now() - startedAt,
        outcome: 'authenticated_firebase_restore',
      });
      return existing;
    }

    if (input.requestedRole && input.requestedRole !== 'student') {
      throw new HttpError(
        403,
        `No ${input.requestedRole} account is provisioned for ${cleanEmail}. Staff and administrator accounts must be created by an administrator.`,
        'STAFF_ACCOUNT_REQUIRED'
      );
    }

    const hint = input.profileHint;
    const displayName =
      sanitizePlainText(hint?.displayName ?? '') ||
      sanitizePlainText(input.name ?? '') ||
      cleanEmail.split('@')[0] ||
      'Student Member';
    const userId = this.state.nextIds.user++;
    const hintedCode = hint?.studentCode ? sanitizePlainText(hint.studentCode).toUpperCase() : '';
    const canUseHintedCode =
      hintedCode.length >= 3 &&
      !this.state.users.some((u) => u.code.toLowerCase() === hintedCode.toLowerCase());
    const studentCode = canUseHintedCode
      ? hintedCode
      : `STU-FB-${String(userId).padStart(4, '0')}`;
    const rawPassword =
      input.password && input.password.length >= 8
        ? input.password
        : crypto.randomBytes(24).toString('hex');
    const nowIso = new Date().toISOString();
    const defaultInterests = ['Artificial Intelligence', 'Computer Science', 'Data Science'];
    const hintedInterests = Array.isArray(hint?.interests)
      ? hint.interests.map((x) => sanitizePlainText(x)).filter(Boolean)
      : [];
    const resolvedInterests = hintedInterests.length > 0 ? hintedInterests : defaultInterests;
    const hintedSubjects = Array.isArray(hint?.preferredSubjects)
      ? hint.preferredSubjects.map((x) => sanitizePlainText(x)).filter(Boolean)
      : [];
    const resolvedSubjects =
      hintedSubjects.length > 0 ? hintedSubjects : ['Algorithms', 'Machine Learning'];
    const resolvedDepartment =
      sanitizePlainText(hint?.department ?? '') || 'Computer Science';
    const resolvedAcademicYear =
      sanitizePlainText(hint?.academicYear ?? '') || '1st Year';

    const restoredUser: DbUser = {
      user_id: userId,
      role: 'student',
      full_name: displayName,
      email: cleanEmail,
      code: studentCode,
      password_hash: hashPassword(rawPassword),
      firebase_uid: input.uid,
      account_status: 'Active',
      avatar_url: null,
      must_change_password: false,
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
      department: resolvedDepartment,
      program: `B.Tech ${resolvedDepartment}`,
      institution: this.state.librarySettings.general_settings.library_name,
      academic_year: resolvedAcademicYear,
      semester: 'Semester 1',
      mobile: null,
      interests: resolvedInterests,
      preferred_subjects: resolvedSubjects,
      preferred_authors: [],
      restriction_reason: null,
      recommendation_preferences: {
        preferred_topics: resolvedInterests.slice(0, 4),
        discovery_preference: 'balanced',
        reading_level: 'No preference',
        content_formats: ['Print Books', 'eBooks'],
        content_languages: ['English'],
        avoid_previously_read: true,
        availability_preference: 'available_first',
      },
      notification_preferences: {
        categories: [
          { category: 'Borrowing', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Due Date Reminders', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required to prevent accidental overdue loans', email_supported: true },
          { category: 'Overdue', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Mandatory institutional circulation notice', email_supported: true },
          { category: 'Reservations', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Recommendations', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Reviews & Feedback', in_app_enabled: true, email_enabled: false, is_mandatory: false, mandatory_reason: null, email_supported: false },
          { category: 'Library Announcements', in_app_enabled: true, email_enabled: true, is_mandatory: false, mandatory_reason: null, email_supported: true },
          { category: 'Account & Security', in_app_enabled: true, email_enabled: true, is_mandatory: true, mandatory_reason: 'Required for password & session security', email_supported: true },
        ],
        reminder_timings: ['2_days_before', '1_day_before', 'on_due_date'],
        allow_reminder_customization: true,
        email_delivery_configured: true,
        configured_loan_period_days: this.state.librarySettings.loan_policy.default_loan_duration_days,
      },
    };

    this.state.users.push(restoredUser);
    this.persist();
    this.emitAuthDebug({
      operation: 'register_query',
      identifier: cleanEmail,
      recordFound: true,
      userId: restoredUser.user_id,
      role: restoredUser.role,
      accountStatus: restoredUser.account_status,
      persisted: Boolean(this.dbFilePath),
      queryDurationMs: performance.now() - startedAt,
      outcome: 'student_restored_firebase',
    });
    return restoredUser;
  }

  buildSessionPayload(user: DbUser): SessionResponsePayload {
    const rolePerm = this.state.roles.find((r) => r.role_key === user.role);
    const adminPermissions: AdminPermissions = {
      can_manage_staff: Boolean(rolePerm?.permissions.manage_staff ?? user.role === 'admin'),
      can_manage_users: Boolean(rolePerm?.permissions.manage_users ?? user.role === 'admin'),
      can_manage_catalog_taxonomy: Boolean(rolePerm?.permissions.manage_taxonomy ?? user.role === 'admin'),
      can_manage_branches: Boolean(rolePerm?.permissions.manage_branches ?? user.role === 'admin'),
      can_configure_settings: Boolean(rolePerm?.permissions.configure_settings ?? user.role === 'admin'),
      can_manage_roles: Boolean(rolePerm?.permissions.manage_roles ?? user.role === 'admin'),
      can_view_audit_logs: Boolean(rolePerm?.permissions.view_audit_logs ?? user.role === 'admin'),
      can_view_reports: Boolean(rolePerm?.permissions.view_reports ?? user.role !== 'student'),
      can_manage_inventory: Boolean(rolePerm?.permissions.manage_inventory ?? user.role !== 'student'),
    };

    const librarianPermissions: LibrarianProfile['permissions'] = {
      can_manage_inventory: Boolean(rolePerm?.permissions.manage_inventory ?? true),
      can_issue_books: Boolean(rolePerm?.permissions.issue_return_books ?? true),
      can_return_books: Boolean(rolePerm?.permissions.issue_return_books ?? true),
      can_manage_reservations: Boolean(rolePerm?.permissions.manage_reservations ?? true),
      can_view_student_records: Boolean(rolePerm?.permissions.view_student_records ?? true),
      can_view_new_registrations: true,
      can_manage_announcements: Boolean(rolePerm?.permissions.manage_announcements ?? true),
      can_view_reports: Boolean(rolePerm?.permissions.view_reports ?? true),
    };

    const payload: SessionResponsePayload = {
      authenticated: true,
      verified_role: user.role,
      role: user.role,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        code: user.code,
        role: user.role,
        account_status: user.account_status,
      },
      permissions: adminPermissions,
    };

    if (user.role === 'student') {
      payload.student = {
        student_id: user.user_id,
        student_code: user.code,
        name: user.full_name,
        email: user.email,
        course_department: user.department ?? 'Computer Science',
        academic_year: user.academic_year ?? '1st Year',
        avatar_url: user.avatar_url ?? '/src/assets/images/student_avatar_profile_1794589807361.jpg',
        interests: user.interests ?? [],
        preferred_subjects: user.preferred_subjects ?? [],
      };
    } else if (user.role === 'librarian') {
      payload.librarian = {
        librarian_id: user.user_id,
        user_id: user.user_id,
        staff_code: user.code,
        full_name: user.full_name,
        email: user.email,
        department_title: user.designation ?? 'Librarian',
        role: 'librarian',
        account_status: user.account_status === 'Active' ? 'Active' : 'Suspended',
        avatar_url: user.avatar_url,
        permissions: librarianPermissions,
      };
    } else if (user.role === 'admin') {
      const adminProfile: AdminProfile = {
        admin_id: user.user_id,
        user_id: user.user_id,
        staff_code: user.code,
        full_name: user.full_name,
        email: user.email,
        mobile_number: user.mobile ?? '',
        designation: user.designation ?? 'Chief System Administrator',
        branch: user.branch ?? 'Main Central Library',
        joining_date: user.joining_date ?? user.created_at.slice(0, 10),
        role: 'admin',
        account_status: user.account_status === 'Active' ? 'Active' : 'Suspended',
        avatar_url: user.avatar_url,
        permissions: adminPermissions,
      };
      payload.admin = adminProfile;
    }

    return payload;
  }

  hasPermission(user: DbUser, permissionKey: PermissionKey): boolean {
    if (user.role === 'admin') return true;
    const roleDef = this.state.roles.find((r) => r.role_key === user.role);
    if (!roleDef) return false;
    return Boolean(roleDef.permissions[permissionKey]);
  }

  // ==================== BOOK MAPPERS & PUBLIC CATALOG ====================

  toCatalogBook(book: DbBook): CatalogBook {
    return {
      book_id: book.book_id,
      slug: book.slug,
      isbn: book.isbn,
      title: book.title,
      author: book.authors,
      publisher: book.publisher,
      publication_year: book.publication_year,
      category: book.category,
      subject: book.subject,
      description: book.description,
      keywords: book.keywords,
      language: book.language,
      format: book.catalog_format,
      cover_image: book.cover_image,
      total_copies: book.total_copies,
      available_copies: book.available_copies,
      reserved_copies: book.reserved_copies,
      rating_average: book.rating_average,
      rating_count: book.rating_count,
      review_count: book.review_count,
      borrow_count: book.borrow_count,
      created_at: book.created_at,
    };
  }

  toInventoryBookItem(book: DbBook): InventoryBookItem {
    const availabilityStatus =
      book.status === 'Archived'
        ? 'Archived'
        : book.available_copies > 0 && book.available_copies === book.total_copies
          ? 'Available'
          : book.available_copies > 0
            ? 'Partially Available'
            : book.issued_copies > 0
              ? 'Fully Issued'
              : book.reserved_copies > 0
                ? 'Reserved/Held'
                : 'Unavailable';

    const hasActiveBorrowings = this.state.borrowings.some(
      (b) => b.book_id === book.book_id && b.status !== 'Returned'
    );
    const hasActiveReservations = this.state.reservations.some(
      (r) =>
        r.book_id === book.book_id &&
        (r.status === 'Waiting' || r.status === 'Ready for Pickup')
    );
    const hasHistoricalTransactions = this.state.borrowings.some(
      (b) => b.book_id === book.book_id
    );

    return {
      book_id: book.book_id,
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      authors: book.authors,
      isbn: book.isbn,
      publisher: book.publisher,
      publication_year: book.publication_year,
      edition: book.edition,
      language: book.language,
      pages: book.pages,
      description: book.description,
      category: book.category,
      subject: book.subject,
      keywords: book.keywords,
      format: book.format,
      cover_image: book.cover_image,
      status: book.status,
      total_copies: book.total_copies,
      available_copies: book.available_copies,
      issued_copies: book.issued_copies,
      reserved_copies: book.reserved_copies,
      unavailable_copies: book.unavailable_copies,
      availability_status: availabilityStatus,
      branch: book.branch,
      floor: book.floor,
      section: book.section,
      shelf: book.shelf,
      rating_average: book.rating_count > 0 ? book.rating_average : null,
      rating_count: book.rating_count,
      borrow_count: book.borrow_count,
      has_active_borrowings: hasActiveBorrowings,
      has_active_reservations: hasActiveReservations,
      has_historical_transactions: hasHistoricalTransactions,
      created_at: book.created_at,
      updated_at: book.updated_at,
      added_by: book.added_by,
      updated_by: book.updated_by,
    };
  }

  toInventoryPhysicalCopy(copy: DbBookCopy): InventoryPhysicalCopy {
    const activeBorrowing = this.state.borrowings.find(
      (b) => b.copy_id === copy.copy_id && b.status !== 'Returned'
    );
    const borrower = activeBorrowing
      ? this.state.users.find((u) => u.user_id === activeBorrowing.student_id)
      : undefined;
    const hasHistory = this.state.borrowings.some((b) => b.copy_id === copy.copy_id);

    return {
      copy_id: copy.copy_id,
      book_id: copy.book_id,
      accession_number: copy.accession_number,
      barcode: copy.barcode,
      status: copy.status,
      condition: copy.condition,
      branch: copy.branch,
      floor: copy.floor,
      section: copy.section,
      shelf: copy.shelf,
      current_borrower_name: borrower?.full_name ?? null,
      current_borrower_code: borrower?.code ?? null,
      due_date: activeBorrowing?.due_date ?? null,
      has_active_borrowing: Boolean(activeBorrowing),
      has_historical_transactions: hasHistory,
      added_at: copy.added_at,
      updated_at: copy.updated_at,
    };
  }

  getPublicOverview() {
    const activeBooks = this.state.books.filter((b) => b.status === 'Active');
    const totalCopies = activeBooks.reduce((acc, b) => acc + b.total_copies, 0);
    const availableCopies = activeBooks.reduce((acc, b) => acc + b.available_copies, 0);
    const activeStudents = this.state.users.filter(
      (u) => u.role === 'student' && u.account_status === 'Active'
    ).length;

    return {
      metrics: {
        total_books: activeBooks.length,
        total_copies: totalCopies,
        available_copies: availableCopies,
        active_students: activeStudents,
        categories_count: this.state.categories.filter((c) => c.status === 'Active').length,
        branches_count: this.state.branches.filter((b) => b.status === 'Active').length,
      },
      featured_books: activeBooks.slice(0, 6).map((b) => this.toCatalogBook(b)),
      general_settings: this.state.librarySettings.general_settings,
    };
  }

  queryCatalogBooks(query: Record<string, string | undefined>) {
    const activeBooks = this.state.books
      .filter((b) => b.status === 'Active')
      .map((b) => this.toCatalogBook(b));

    const search = (query.q ?? query.search ?? '').trim().toLowerCase();
    const category = (query.category ?? '').trim().toLowerCase();
    const subject = (query.subject ?? '').trim().toLowerCase();
    const author = (query.author ?? '').trim().toLowerCase();
    const availability = (query.availability ?? 'all').trim().toLowerCase();
    const language = (query.language ?? '').trim().toLowerCase();
    const format = (query.format ?? '').trim().toLowerCase();
    const yearFrom = query.year_from ? Number.parseInt(query.year_from, 10) : NaN;
    const yearTo = query.year_to ? Number.parseInt(query.year_to, 10) : NaN;
    const minRating = query.min_rating ? Number.parseFloat(query.min_rating) : NaN;
    const sort = query.sort ?? 'relevance';
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(60, Math.max(1, Number.parseInt(query.limit ?? '12', 10) || 12));

    const filtered = activeBooks.filter((book) => {
      if (search) {
        const hay = [
          book.title,
          book.author,
          book.subject,
          book.category,
          book.isbn,
          book.description,
          ...book.keywords,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (category && book.category.toLowerCase() !== category) return false;
      if (subject && book.subject.toLowerCase() !== subject) return false;
      if (author && !book.author.toLowerCase().includes(author)) return false;
      if (language && book.language.toLowerCase() !== language) return false;
      if (format && book.format.toLowerCase() !== format) return false;
      if (!Number.isNaN(yearFrom) && book.publication_year < yearFrom) return false;
      if (!Number.isNaN(yearTo) && book.publication_year > yearTo) return false;
      if (!Number.isNaN(minRating) && book.rating_average < minRating) return false;

      if (availability === 'available' && book.available_copies <= 0) return false;
      if (availability === 'issued' && (book.available_copies > 0 || book.reserved_copies > 0)) {
        return false;
      }
      if (availability === 'reserved' && (book.available_copies > 0 || book.reserved_copies === 0)) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sort) {
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'highest_rated':
          return b.rating_average - a.rating_average || b.rating_count - a.rating_count;
        case 'most_borrowed':
          return b.borrow_count - a.borrow_count;
        case 'recently_published':
          return b.publication_year - a.publication_year;
        case 'newest':
          return b.created_at.localeCompare(a.created_at);
        default:
          return b.rating_average - a.rating_average || b.borrow_count - a.borrow_count;
      }
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return {
      items,
      total,
      availableCatalogCount: activeBooks.filter((b) => b.available_copies > 0).length,
      page: safePage,
      limit,
      totalPages,
      facets: {
        categories: Array.from(new Set(activeBooks.map((b) => b.category))).sort(),
        subjects: Array.from(new Set(activeBooks.map((b) => b.subject))).sort(),
        authors: Array.from(new Set(activeBooks.map((b) => b.author))).sort(),
        languages: Array.from(new Set(activeBooks.map((b) => b.language))),
        formats: Array.from(new Set(activeBooks.map((b) => b.format))),
        minYear: Math.min(...activeBooks.map((b) => b.publication_year), 2020),
        maxYear: Math.max(...activeBooks.map((b) => b.publication_year), 2025),
      },
      isPrototypeSample: false,
    };
  }

  getBookDetails(identifier: string, currentUser: DbUser | null): BookDetailPayload {
    const cleanId = identifier.trim().toLowerCase();
    const book = this.state.books.find(
      (b) =>
        b.status === 'Active' &&
        (String(b.book_id) === cleanId || b.slug.toLowerCase() === cleanId)
    );
    if (!book) {
      throw new HttpError(404, 'Book not found in catalog.', 'BOOK_NOT_FOUND');
    }

    const catalogBook = this.toCatalogBook(book);
    const copies: BookCopyRecord[] = this.state.copies
      .filter((c) => c.book_id === book.book_id)
      .map((c) => ({
        copy_id: c.copy_id,
        book_id: c.book_id,
        barcode: c.barcode ?? c.accession_number,
        status:
          c.status === 'Issued'
            ? 'issued'
            : c.status === 'Reserved'
              ? 'reserved'
              : 'available',
        branch: c.branch,
        shelf: c.shelf,
      }));

    const detailedBook: DetailedBookRecord = {
      ...catalogBook,
      edition: book.edition,
      pages: book.pages,
      location: {
        branch: book.branch,
        floor: book.floor,
        section: book.section,
        shelf: book.shelf,
      },
      copies,
    };

    const reviews: BookReviewRecord[] = this.state.reviews
      .filter((r) => r.book_id === book.book_id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((r) => {
        const reviewer = this.state.users.find((u) => u.user_id === r.student_id);
        const hasBorrowed = this.state.borrowings.some(
          (b) => b.student_id === r.student_id && b.book_id === book.book_id
        );
        return {
          review_id: r.rating_id,
          student_id: r.student_id,
          book_id: r.book_id,
          reviewer_display:
            currentUser?.user_id === r.student_id
              ? `${reviewer?.full_name ?? 'You'} (You)`
              : `${reviewer?.full_name ?? 'Student Borrower'} · ${reviewer?.department ?? 'University'}`,
          rating: r.rating,
          review: r.review,
          created_at: r.created_at,
          updated_at: r.updated_at,
          relative_date: r.updated_at.slice(0, 10),
          verified_borrower: hasBorrowed,
        };
      });

    const ratingDistribution: RatingBreakdownItem[] = ([5, 4, 3, 2, 1] as const).map((stars) => {
      const count = reviews.filter((r) => Math.round(r.rating) === stars).length;
      return {
        stars,
        count,
        percentage: reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0,
      };
    });

    const relatedBooks = this.state.books
      .filter(
        (b) =>
          b.status === 'Active' &&
          b.book_id !== book.book_id &&
          (b.subject === book.subject || b.category === book.category)
      )
      .slice(0, 4)
      .map((b) => this.toCatalogBook(b));

    let studentEligibility: BookDetailPayload['student_eligibility'] = {
      is_authenticated: Boolean(currentUser),
      can_borrow: false,
      ineligible_reason: 'Sign in with your student account to borrow or reserve books.',
      already_borrowed: false,
      can_review: false,
      review_ineligible_reason: 'Sign in to submit a rating and review.',
    };

    if (currentUser && currentUser.role === 'student') {
      const studentBorrowings = this.state.borrowings.filter(
        (b) => b.student_id === currentUser.user_id
      );
      const activeLoans = studentBorrowings.filter((b) => b.status !== 'Returned');
      const activeForBook = activeLoans.find((b) => b.book_id === book.book_id);
      const maxLoans = this.state.librarySettings.loan_policy.max_active_loans_per_student;
      const activeReservation = this.state.reservations.find(
        (r) =>
          r.student_id === currentUser.user_id &&
          r.book_id === book.book_id &&
          (r.status === 'Waiting' || r.status === 'Ready for Pickup')
      );
      const waitingQueue = this.state.reservations
        .filter((r) => r.book_id === book.book_id && r.status === 'Waiting')
        .sort(
          (a, b) =>
            a.reservation_date.localeCompare(b.reservation_date) ||
            a.reservation_id - b.reservation_id
        );
      const existingReview = reviews.find((r) => r.student_id === currentUser.user_id);
      const hasCompletedOrBorrowed = studentBorrowings.some((b) => b.book_id === book.book_id);
      const canBorrow =
        currentUser.account_status === 'Active' &&
        book.available_copies > 0 &&
        !activeForBook &&
        activeLoans.length < maxLoans;

      studentEligibility = {
        is_authenticated: true,
        can_borrow: canBorrow,
        ineligible_reason:
          currentUser.account_status !== 'Active'
            ? `Your library account is currently ${currentUser.account_status.toLowerCase()}.`
            : activeForBook
              ? 'You currently have an active loan for this title.'
              : activeLoans.length >= maxLoans
                ? `You have reached the maximum active borrowing limit (${maxLoans} books).`
                : book.available_copies === 0
                  ? 'All copies are currently issued or reserved.'
                  : undefined,
        already_borrowed: Boolean(activeForBook),
        active_borrowing: activeForBook
          ? {
              transaction_id: activeForBook.borrowing_id,
              issue_date: activeForBook.issue_date,
              due_date: activeForBook.due_date,
            }
          : undefined,
        active_reservation: activeReservation
          ? {
              reservation_id: activeReservation.reservation_id,
              student_id: activeReservation.student_id,
              book_id: activeReservation.book_id,
              reservation_date: activeReservation.reservation_date,
              status:
                activeReservation.status === 'Ready for Pickup' ? 'Ready for Pickup' : 'Active',
              queue_position:
                activeReservation.status === 'Waiting'
                  ? waitingQueue.findIndex(
                      (x) => x.reservation_id === activeReservation.reservation_id
                    ) + 1
                  : null,
            }
          : undefined,
        can_review: Boolean(hasCompletedOrBorrowed || existingReview),
        review_ineligible_reason:
          hasCompletedOrBorrowed || existingReview
            ? undefined
            : 'Ratings and reviews are enabled after you borrow this book.',
        existing_review: existingReview,
      };
    } else if (currentUser) {
      studentEligibility = {
        is_authenticated: true,
        can_borrow: false,
        ineligible_reason: 'Student account required to borrow online from the catalog.',
        already_borrowed: false,
        can_review: false,
        review_ineligible_reason: 'Only student borrowers can submit book reviews.',
      };
    }

    const recommendationReason =
      currentUser && currentUser.role === 'student'
        ? (currentUser.interests ?? []).some(
            (i) =>
              i.toLowerCase() === book.category.toLowerCase() ||
              i.toLowerCase() === book.subject.toLowerCase()
          )
          ? `Matches your saved academic interests in ${book.category} and ${book.subject}.`
          : null
        : null;

    return {
      is_prototype_sample: false,
      book: detailedBook,
      issued_copies: book.issued_copies,
      loan_period_days: this.state.librarySettings.loan_policy.default_loan_duration_days,
      student_eligibility: studentEligibility,
      recommendation_reason: recommendationReason,
      rating_distribution: ratingDistribution,
      reviews,
      related_books: relatedBooks,
    };
  }

  // ==================== CORE ATOMIC CIRCULATION ENGINE ====================

  async issueBookTransaction(params: {
    studentId: number;
    bookId: number;
    copyId?: number | null;
    reservationId?: number | null;
    actorName: string;
    allowQueueOverride?: boolean;
  }) {
    return withLock(`book-${params.bookId}`, () => {
      const student = this.state.users.find(
        (u) => u.user_id === params.studentId && u.role === 'student'
      );
      if (!student) {
        throw new HttpError(404, 'Student record not found.', 'STUDENT_NOT_FOUND');
      }
      if (student.account_status !== 'Active') {
        throw new HttpError(
          403,
          `Student account is ${student.account_status} and cannot borrow books.`,
          'ACCOUNT_BLOCKED'
        );
      }

      const book = this.state.books.find((b) => b.book_id === params.bookId);
      if (!book || book.status === 'Archived') {
        throw new HttpError(404, 'Book is not available for circulation.', 'BOOK_NOT_FOUND');
      }

      const activeStudentLoans = this.state.borrowings.filter(
        (b) => b.student_id === student.user_id && b.status !== 'Returned'
      );
      const maxLoans = this.state.librarySettings.loan_policy.max_active_loans_per_student;
      if (activeStudentLoans.length >= maxLoans) {
        throw new HttpError(
          409,
          `Maximum active borrowing limit reached (${activeStudentLoans.length}/${maxLoans}). Return a book before borrowing another.`,
          'LIMIT_REACHED'
        );
      }

      if (activeStudentLoans.some((b) => b.book_id === book.book_id)) {
        throw new HttpError(
          409,
          'Student already has an active loan for this title.',
          'ALREADY_BORROWED'
        );
      }

      // Check active reservation entitlement or queue priority
      const entitledReservation =
        (params.reservationId
          ? this.state.reservations.find(
              (r) =>
                r.reservation_id === params.reservationId &&
                r.student_id === student.user_id &&
                r.book_id === book.book_id &&
                (r.status === 'Ready for Pickup' || r.status === 'Waiting')
            )
          : undefined) ??
        this.state.reservations.find(
          (r) =>
            r.student_id === student.user_id &&
            r.book_id === book.book_id &&
            r.status === 'Ready for Pickup'
        );

      // Select physical copy
      let selectedCopy: DbBookCopy | undefined;
      if (params.copyId) {
        selectedCopy = this.state.copies.find(
          (c) => c.copy_id === params.copyId && c.book_id === book.book_id
        );
        if (!selectedCopy) {
          throw new HttpError(404, 'Selected physical copy not found for this book.', 'COPY_NOT_FOUND');
        }
        const isHeldForThisStudent =
          selectedCopy.status === 'Reserved' &&
          entitledReservation &&
          entitledReservation.assigned_copy_id === selectedCopy.copy_id;

        if (selectedCopy.status !== 'Available' && !isHeldForThisStudent) {
          throw new HttpError(
            409,
            `Copy ${selectedCopy.accession_number} is currently ${selectedCopy.status} and cannot be issued.`,
            'COPY_UNAVAILABLE'
          );
        }
      } else if (entitledReservation?.assigned_copy_id) {
        selectedCopy = this.state.copies.find(
          (c) => c.copy_id === entitledReservation.assigned_copy_id
        );
      }

      if (!selectedCopy) {
        selectedCopy = this.state.copies.find(
          (c) => c.book_id === book.book_id && c.status === 'Available'
        );
      }

      if (!selectedCopy) {
        throw new HttpError(
          409,
          'No available physical copies remain for this title. You can place a reservation instead.',
          'NO_COPIES_AVAILABLE'
        );
      }

      // Queue conflict check: if waiting/ready reservations exist for OTHER students and no free unassigned copies
      const readyHoldsForOthers = this.state.reservations.filter(
        (r) =>
          r.book_id === book.book_id &&
          r.status === 'Ready for Pickup' &&
          r.student_id !== student.user_id
      );
      if (
        !params.allowQueueOverride &&
        !entitledReservation &&
        selectedCopy.status === 'Available' &&
        readyHoldsForOthers.some((r) => r.assigned_copy_id === selectedCopy!.copy_id)
      ) {
        throw new HttpError(
          409,
          'This copy is held for another student in the reservation queue.',
          'RESERVATION_CONFLICT'
        );
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const loanDurationDays = this.state.librarySettings.loan_policy.default_loan_duration_days;
      const issueDate = nowIso.slice(0, 10);
      const dueDate = new Date(now.getTime() + loanDurationDays * 86_400_000)
        .toISOString()
        .slice(0, 10);

      const borrowingId = this.state.nextIds.borrowing++;
      const transactionCode = `TXN-${now.getUTCFullYear()}-${borrowingId}`;

      const newBorrowing: DbBorrowing = {
        borrowing_id: borrowingId,
        transaction_code: transactionCode,
        student_id: student.user_id,
        book_id: book.book_id,
        copy_id: selectedCopy.copy_id,
        issue_date: issueDate,
        due_date: dueDate,
        return_date: null,
        status: 'Issued',
        renewals_used: 0,
        progress_percent: 5,
        issued_by_staff_name: params.actorName,
        returned_condition: null,
        condition_notes: null,
        fine_amount: null,
        fine_payment_status: null,
        fine_outstanding_balance: null,
        last_reminder_at: null,
        reminder_history: [],
        created_at: nowIso,
        updated_at: nowIso,
      };

      this.state.borrowings.unshift(newBorrowing);
      selectedCopy.status = 'Issued';
      selectedCopy.updated_at = nowIso;
      book.borrow_count += 1;
      book.updated_at = nowIso;

      if (entitledReservation) {
        entitledReservation.status = 'Completed';
        entitledReservation.updated_at = nowIso;
      }

      reconcileBookCounts(this.state, book.book_id);

      this.addNotification({
        user_id: student.user_id,
        title: `Book Issued: ${book.title}`,
        message: `Copy ${selectedCopy.accession_number} of "${book.title}" has been issued. Due date: ${dueDate} (${loanDurationDays}-day policy).`,
        category: 'Borrowing',
        priority: 'Normal',
        is_read: false,
        related_entity_type: 'borrowing',
        related_entity_id: borrowingId,
        related_book_id: book.book_id,
        related_book_title: book.title,
        action_label: 'View My Books',
        action_url: '/student/my-books',
        created_at: nowIso,
        read_at: null,
        can_delete: true,
        is_mandatory: false,
        announcement_author: params.actorName,
        dedupe_key: `issued-${borrowingId}`,
      });

      this.persist();

      return {
        transaction_id: transactionCode,
        borrowing_id: borrowingId,
        student_id: student.user_id,
        student_name: student.full_name,
        student_code: student.code,
        book_id: book.book_id,
        book_title: book.title,
        copy_id: selectedCopy.copy_id,
        accession_number: selectedCopy.accession_number,
        issue_date: issueDate,
        due_date: dueDate,
        loan_duration_days: loanDurationDays,
        librarian_name: params.actorName,
        in_app_notification_created: true,
        email_notification_sent: this.state.librarySettings.reminder_policy.email_notifications_enabled,
      };
    });
  }

  async renewBorrowing(studentId: number, borrowingId: number) {
    const borrowing = this.state.borrowings.find(
      (b) => b.borrowing_id === borrowingId && b.student_id === studentId
    );
    if (!borrowing) {
      throw new HttpError(404, 'Borrowing record not found.', 'BORROWING_NOT_FOUND');
    }
    return withLock(`book-${borrowing.book_id}`, () => {
      if (borrowing.status === 'Returned') {
        throw new HttpError(409, 'Returned books cannot be renewed.', 'ALREADY_RETURNED');
      }
      const { loan_policy } = this.state.librarySettings;
      if (!loan_policy.allow_renewal) {
        throw new HttpError(403, 'Book renewals are currently disabled by library policy.', 'RENEWAL_DISABLED');
      }
      if (borrowing.renewals_used >= loan_policy.max_renewals_per_loan) {
        throw new HttpError(
          409,
          `Maximum renewal limit (${loan_policy.max_renewals_per_loan}) reached for this loan.`,
          'MAX_RENEWALS_REACHED'
        );
      }

      const waitingQueue = this.state.reservations.some(
        (r) => r.book_id === borrowing.book_id && r.status === 'Waiting'
      );
      if (waitingQueue) {
        throw new HttpError(
          409,
          'Another student is waiting in the reservation queue for this title, so renewal is unavailable.',
          'RESERVATION_WAITING'
        );
      }

      const currentDueMs = new Date(borrowing.due_date).getTime();
      const baseMs = Math.max(currentDueMs, Date.now());
      const nextDueDate = new Date(baseMs + loan_policy.renewal_extension_days * 86_400_000)
        .toISOString()
        .slice(0, 10);

      borrowing.due_date = nextDueDate;
      borrowing.renewals_used += 1;
      borrowing.status = 'Issued';
      borrowing.updated_at = new Date().toISOString();

      const book = this.state.books.find((b) => b.book_id === borrowing.book_id);
      this.addNotification({
        user_id: studentId,
        title: `Loan Renewed: ${book?.title ?? 'Library Book'}`,
        message: `Your borrowing has been extended by ${loan_policy.renewal_extension_days} days. New due date: ${nextDueDate}.`,
        category: 'Borrowing',
        priority: 'Normal',
        is_read: false,
        related_entity_type: 'borrowing',
        related_entity_id: borrowing.borrowing_id,
        related_book_id: borrowing.book_id,
        related_book_title: book?.title ?? null,
        action_label: 'View My Books',
        action_url: '/student/my-books',
        created_at: borrowing.updated_at,
        read_at: null,
        can_delete: true,
        is_mandatory: false,
        announcement_author: null,
        dedupe_key: `renew-${borrowing.borrowing_id}-${borrowing.renewals_used}`,
      });

      this.persist();
      return {
        borrowing_id: borrowing.borrowing_id,
        due_date: borrowing.due_date,
        renewals_used: borrowing.renewals_used,
        max_renewals: loan_policy.max_renewals_per_loan,
        message: `Loan renewed until ${borrowing.due_date}.`,
      };
    });
  }

  async returnBookTransaction(params: {
    borrowingId: number;
    condition: ReturnCopyCondition;
    conditionNotes?: string | null;
    sendDamagedToRepair?: boolean;
    actorName: string;
  }) {
    const borrowing = this.state.borrowings.find((b) => b.borrowing_id === params.borrowingId);
    if (!borrowing) {
      throw new HttpError(404, 'Borrowing transaction not found.', 'BORROWING_NOT_FOUND');
    }

    return withLock(`book-${borrowing.book_id}`, () => {
      if (borrowing.status === 'Returned') {
        throw new HttpError(
          409,
          'This borrowing transaction has already been returned.',
          'ALREADY_RETURNED'
        );
      }

      const book = this.state.books.find((b) => b.book_id === borrowing.book_id);
      const copy = this.state.copies.find((c) => c.copy_id === borrowing.copy_id);
      const student = this.state.users.find((u) => u.user_id === borrowing.student_id);
      if (!book || !copy || !student) {
        throw new HttpError(404, 'Related book, copy, or student record missing.', 'DATA_INTEGRITY_ERROR');
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const returnDate = nowIso.slice(0, 10);
      const daysDiff = getDaysDifferenceFromToday(borrowing.due_date, now);
      const daysOverdue = daysDiff < 0 ? Math.abs(daysDiff) : 0;

      const { fine_policy, reservation_policy } = this.state.librarySettings;
      const chargeableDays = Math.max(0, daysOverdue - fine_policy.grace_period_days);
      const fineApplied = Boolean(
        fine_policy.fine_policy_enabled &&
          chargeableDays > 0 &&
          fine_policy.fine_per_day_amount &&
          fine_policy.fine_per_day_amount > 0
      );
      const fineAmount = fineApplied
        ? Number((chargeableDays * (fine_policy.fine_per_day_amount ?? 0)).toFixed(2))
        : null;

      borrowing.status = 'Returned';
      borrowing.return_date = returnDate;
      borrowing.progress_percent = 100;
      borrowing.returned_condition = params.condition;
      borrowing.condition_notes = params.conditionNotes
        ? sanitizePlainText(params.conditionNotes)
        : null;
      borrowing.fine_amount = fineAmount;
      borrowing.fine_payment_status = fineApplied ? 'Unpaid' : null;
      borrowing.fine_outstanding_balance = fineAmount;
      borrowing.updated_at = nowIso;

      let resultingCopyStatus: CopyStatus = 'Available';
      let heldForStudentName: string | null = null;
      let reservationStatusNote: string | null = null;

      if (params.condition === 'Lost') {
        copy.status = 'Lost';
        resultingCopyStatus = 'Lost';
      } else if (params.condition === 'Damaged') {
        copy.condition = 'Needs Repair';
        copy.status = params.sendDamagedToRepair ? 'Under Repair' : 'Damaged';
        resultingCopyStatus = copy.status;
      } else {
        copy.condition = params.condition;
        // Promote oldest waiting reservation in FIFO order!
        const nextWaiting = this.state.reservations
          .filter((r) => r.book_id === book.book_id && r.status === 'Waiting')
          .sort(
            (a, b) =>
              a.reservation_date.localeCompare(b.reservation_date) ||
              a.reservation_id - b.reservation_id
          )[0];

        if (nextWaiting) {
          const waitingStudent = this.state.users.find(
            (u) => u.user_id === nextWaiting.student_id
          );
          const pickupDeadlineIso = new Date(
            now.getTime() + reservation_policy.pickup_window_hours * 3_600_000
          ).toISOString();

          copy.status = 'Reserved';
          resultingCopyStatus = 'Reserved';
          nextWaiting.status = 'Ready for Pickup';
          nextWaiting.ready_date = nowIso;
          nextWaiting.pickup_deadline = pickupDeadlineIso;
          nextWaiting.assigned_copy_id = copy.copy_id;
          nextWaiting.updated_at = nowIso;

          heldForStudentName = waitingStudent?.full_name ?? `Student #${nextWaiting.student_id}`;
          reservationStatusNote = `Copy ${copy.accession_number} held for ${heldForStudentName} (${nextWaiting.reservation_code}) — Ready for Pickup until ${pickupDeadlineIso.slice(0, 16).replace('T', ' ')}.`;

          this.addNotification({
            user_id: nextWaiting.student_id,
            title: 'Reserved Book Ready for Pickup',
            message: `"${book.title}" (${copy.accession_number}) has been returned and is now Ready for Pickup! Please collect within ${reservation_policy.pickup_window_hours} hours.`,
            category: 'Reservations',
            priority: 'Important',
            is_read: false,
            related_entity_type: 'reservation',
            related_entity_id: nextWaiting.reservation_id,
            related_book_id: book.book_id,
            related_book_title: book.title,
            action_label: 'View Reservations',
            action_url: '/student/reservations',
            created_at: nowIso,
            read_at: null,
            can_delete: true,
            is_mandatory: false,
            announcement_author: params.actorName,
            dedupe_key: `res-ready-${nextWaiting.reservation_id}-${copy.copy_id}`,
          });
        } else {
          copy.status = 'Available';
          resultingCopyStatus = 'Available';
        }
      }

      copy.updated_at = nowIso;
      reconcileBookCounts(this.state, book.book_id);

      // Prompt returning student to rate book & update reading history
      this.addNotification({
        user_id: student.user_id,
        title: `Return Confirmed: ${book.title}`,
        message: `Thank you for returning "${book.title}" (${copy.accession_number}). It has been added to your Reading History — share a quick rating to refine your AI recommendations!`,
        category: 'Reviews & Feedback',
        priority: 'Normal',
        is_read: false,
        related_entity_type: 'book',
        related_entity_id: book.book_id,
        related_book_id: book.book_id,
        related_book_title: book.title,
        action_label: 'Rate Book',
        action_url: `/books/${book.slug}`,
        created_at: nowIso,
        read_at: null,
        can_delete: true,
        is_mandatory: false,
        announcement_author: params.actorName,
        dedupe_key: `returned-${borrowing.borrowing_id}`,
      });

      this.persist();

      return {
        borrowing_id: borrowing.borrowing_id,
        transaction_code: borrowing.transaction_code,
        student_id: student.user_id,
        student_name: student.full_name,
        student_code: student.code,
        book_id: book.book_id,
        book_title: book.title,
        copy_id: copy.copy_id,
        accession_number: copy.accession_number,
        return_date: returnDate,
        returned_condition: params.condition,
        resulting_copy_status: resultingCopyStatus,
        days_overdue: daysOverdue,
        fine_applied: fineApplied,
        fine_amount: fineAmount,
        fine_currency_symbol: fine_policy.fine_currency_symbol,
        fine_status_label: fineApplied
          ? `${fine_policy.fine_currency_symbol}${fineAmount?.toFixed(2)} (${chargeableDays} chargeable overdue days)`
          : fine_policy.fine_policy_enabled
            ? 'No fine (within grace period / on time)'
            : 'No overdue fine assessed (fine policy disabled)',
        reservation_status_note: reservationStatusNote,
        held_for_student_name: heldForStudentName,
        reading_history_updated: true,
        in_app_notification_created: true,
        email_notification_sent: this.state.librarySettings.reminder_policy.email_notifications_enabled,
      };
    });
  }

  // ==================== RESERVATIONS ====================

  async createReservation(studentId: number, bookId: number) {
    return withLock(`book-${bookId}`, () => {
      const { reservation_policy } = this.state.librarySettings;
      if (!reservation_policy.reservations_enabled) {
        throw new HttpError(403, 'Book reservations are currently disabled by library settings.', 'RESERVATIONS_DISABLED');
      }

      const student = this.state.users.find(
        (u) => u.user_id === studentId && u.role === 'student'
      );
      if (!student || student.account_status !== 'Active') {
        throw new HttpError(403, 'Only active student accounts can place reservations.', 'ACCOUNT_BLOCKED');
      }

      const book = this.state.books.find((b) => b.book_id === bookId && b.status === 'Active');
      if (!book) {
        throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
      }

      if (book.available_copies > 0) {
        throw new HttpError(
          409,
          'Copies are currently available to borrow immediately — reservation is only needed when all copies are checked out.',
          'COPIES_AVAILABLE'
        );
      }

      const activeStudentRes = this.state.reservations.filter(
        (r) =>
          r.student_id === studentId &&
          (r.status === 'Waiting' || r.status === 'Ready for Pickup')
      );
      if (activeStudentRes.length >= reservation_policy.max_active_reservations_per_student) {
        throw new HttpError(
          409,
          `Maximum active reservation limit (${reservation_policy.max_active_reservations_per_student}) reached.`,
          'RESERVATION_LIMIT_REACHED'
        );
      }

      if (activeStudentRes.some((r) => r.book_id === bookId)) {
        throw new HttpError(
          409,
          'You already have an active reservation for this title.',
          'DUPLICATE_RESERVATION'
        );
      }

      const alreadyBorrowed = this.state.borrowings.some(
        (b) => b.student_id === studentId && b.book_id === bookId && b.status !== 'Returned'
      );
      if (alreadyBorrowed) {
        throw new HttpError(
          409,
          'You currently have this book borrowed.',
          'ALREADY_BORROWED'
        );
      }

      const nowIso = new Date().toISOString();
      const resId = this.state.nextIds.reservation++;
      const resCode = `RES-${new Date().getUTCFullYear()}-${resId}`;
      const newRes: DbReservation = {
        reservation_id: resId,
        reservation_code: resCode,
        student_id: studentId,
        book_id: bookId,
        reservation_date: nowIso.slice(0, 10),
        status: 'Waiting',
        ready_date: null,
        pickup_deadline: null,
        assigned_copy_id: null,
        notes: 'Placed via catalog queue.',
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.state.reservations.push(newRes);

      const waitingList = this.state.reservations
        .filter((r) => r.book_id === bookId && r.status === 'Waiting')
        .sort(
          (a, b) =>
            a.reservation_date.localeCompare(b.reservation_date) ||
            a.reservation_id - b.reservation_id
        );
      const queuePosition = waitingList.findIndex((r) => r.reservation_id === resId) + 1;

      this.addNotification({
        user_id: studentId,
        title: `Reservation Confirmed: ${book.title}`,
        message: `You are #${queuePosition} in the queue for "${book.title}" (${resCode}). You will be notified as soon as a copy is returned.`,
        category: 'Reservations',
        priority: 'Normal',
        is_read: false,
        related_entity_type: 'reservation',
        related_entity_id: resId,
        related_book_id: bookId,
        related_book_title: book.title,
        action_label: 'View Reservations',
        action_url: '/student/reservations',
        created_at: nowIso,
        read_at: null,
        can_delete: true,
        is_mandatory: false,
        announcement_author: null,
        dedupe_key: `res-created-${resId}`,
      });

      this.persist();
      return {
        reservation_id: resId,
        reservation_code: resCode,
        queue_position: queuePosition,
        status: 'Waiting',
        message: `Reservation placed (#${queuePosition} in queue).`,
      };
    });
  }

  async cancelReservation(
    reservationId: number,
    actor: DbUser,
    reason?: string
  ) {
    const reservation = this.state.reservations.find(
      (r) => r.reservation_id === reservationId
    );
    if (!reservation) {
      throw new HttpError(404, 'Reservation record not found.', 'RESERVATION_NOT_FOUND');
    }
    if (actor.role === 'student' && reservation.student_id !== actor.user_id) {
      throw new HttpError(403, 'You can only cancel your own reservations.', 'FORBIDDEN');
    }

    return withLock(`book-${reservation.book_id}`, () => {
      if (
        reservation.status === 'Completed' ||
        reservation.status === 'Cancelled' ||
        reservation.status === 'Expired'
      ) {
        throw new HttpError(409, `Reservation is already ${reservation.status}.`, 'INVALID_STATE');
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const heldCopyId = reservation.assigned_copy_id;
      const book = this.state.books.find((b) => b.book_id === reservation.book_id);

      reservation.status = 'Cancelled';
      reservation.assigned_copy_id = null;
      reservation.notes = reason ? sanitizePlainText(reason) : reservation.notes;
      reservation.updated_at = nowIso;

      if (heldCopyId) {
        const heldCopy = this.state.copies.find((c) => c.copy_id === heldCopyId);
        if (heldCopy && heldCopy.status === 'Reserved') {
          const nextWaiting = this.state.reservations
            .filter((r) => r.book_id === reservation.book_id && r.status === 'Waiting')
            .sort(
              (a, b) =>
                a.reservation_date.localeCompare(b.reservation_date) ||
                a.reservation_id - b.reservation_id
            )[0];
          if (nextWaiting) {
            const pickupDeadlineIso = new Date(
              now.getTime() +
                this.state.librarySettings.reservation_policy.pickup_window_hours * 3_600_000
            ).toISOString();
            nextWaiting.status = 'Ready for Pickup';
            nextWaiting.ready_date = nowIso;
            nextWaiting.pickup_deadline = pickupDeadlineIso;
            nextWaiting.assigned_copy_id = heldCopy.copy_id;
            nextWaiting.updated_at = nowIso;
            heldCopy.status = 'Reserved';

            this.addNotification({
              user_id: nextWaiting.student_id,
              title: 'Reserved Book Ready for Pickup',
              message: `"${book?.title ?? 'Reserved book'}" (${heldCopy.accession_number}) is now ready for your pickup!`,
              category: 'Reservations',
              priority: 'Important',
              is_read: false,
              related_entity_type: 'reservation',
              related_entity_id: nextWaiting.reservation_id,
              related_book_id: reservation.book_id,
              related_book_title: book?.title ?? null,
              action_label: 'View Reservations',
              action_url: '/student/reservations',
              created_at: nowIso,
              read_at: null,
              can_delete: true,
              is_mandatory: false,
              announcement_author: actor.full_name,
              dedupe_key: `res-ready-${nextWaiting.reservation_id}-${heldCopy.copy_id}`,
            });
          } else {
            heldCopy.status = 'Available';
          }
          heldCopy.updated_at = nowIso;
        }
      }

      reconcileBookCounts(this.state, reservation.book_id);
      this.persist();
      return {
        reservation_id: reservation.reservation_id,
        status: 'Cancelled',
        message: 'Reservation cancelled and queue updated.',
      };
    });
  }

  async markReservationReady(reservationId: number, copyId: number, actor: DbUser) {
    const reservation = this.state.reservations.find(
      (r) => r.reservation_id === reservationId
    );
    if (!reservation) {
      throw new HttpError(404, 'Reservation record not found.', 'RESERVATION_NOT_FOUND');
    }
    return withLock(`book-${reservation.book_id}`, () => {
      if (reservation.status !== 'Waiting') {
        throw new HttpError(409, 'Only Waiting reservations can be marked Ready for Pickup.', 'INVALID_STATE');
      }
      const copy = this.state.copies.find(
        (c) => c.copy_id === copyId && c.book_id === reservation.book_id
      );
      if (!copy || copy.status !== 'Available') {
        throw new HttpError(409, 'Selected copy is not available to place on hold.', 'COPY_UNAVAILABLE');
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const windowHours = this.state.librarySettings.reservation_policy.pickup_window_hours;
      const pickupDeadlineIso = new Date(now.getTime() + windowHours * 3_600_000).toISOString();

      copy.status = 'Reserved';
      copy.updated_at = nowIso;
      reservation.status = 'Ready for Pickup';
      reservation.ready_date = nowIso;
      reservation.pickup_deadline = pickupDeadlineIso;
      reservation.assigned_copy_id = copy.copy_id;
      reservation.updated_at = nowIso;
      reconcileBookCounts(this.state, reservation.book_id);

      const book = this.state.books.find((b) => b.book_id === reservation.book_id);
      this.addNotification({
        user_id: reservation.student_id,
        title: 'Reserved Book Ready for Pickup',
        message: `"${book?.title ?? 'Your book'}" (${copy.accession_number}) is ready for pickup within ${windowHours} hours.`,
        category: 'Reservations',
        priority: 'Important',
        is_read: false,
        related_entity_type: 'reservation',
        related_entity_id: reservation.reservation_id,
        related_book_id: reservation.book_id,
        related_book_title: book?.title ?? null,
        action_label: 'View Reservations',
        action_url: '/student/reservations',
        created_at: nowIso,
        read_at: null,
        can_delete: true,
        is_mandatory: false,
        announcement_author: actor.full_name,
        dedupe_key: `res-ready-${reservation.reservation_id}-${copy.copy_id}`,
      });

      this.persist();
      return {
        reservation_id: reservation.reservation_id,
        status: 'Ready for Pickup',
        pickup_deadline: pickupDeadlineIso,
        assigned_copy_accession: copy.accession_number,
      };
    });
  }

  async extendReservationDeadline(reservationId: number, extraHours: number = 24) {
    const reservation = this.state.reservations.find(
      (r) => r.reservation_id === reservationId
    );
    if (!reservation) {
      throw new HttpError(404, 'Reservation record not found.', 'RESERVATION_NOT_FOUND');
    }
    if (reservation.status !== 'Ready for Pickup') {
      throw new HttpError(409, 'Only Ready for Pickup reservations can have deadlines extended.', 'INVALID_STATE');
    }
    const baseMs = reservation.pickup_deadline
      ? Math.max(Date.now(), new Date(reservation.pickup_deadline).getTime())
      : Date.now();
    const nextDeadline = new Date(baseMs + extraHours * 3_600_000).toISOString();
    reservation.pickup_deadline = nextDeadline;
    reservation.updated_at = new Date().toISOString();
    this.persist();
    return {
      reservation_id: reservation.reservation_id,
      pickup_deadline: nextDeadline,
      message: `Pickup window extended by ${extraHours} hours.`,
    };
  }

  async fulfillReservation(reservationId: number, actorName: string) {
    const reservation = this.state.reservations.find(
      (r) => r.reservation_id === reservationId
    );
    if (!reservation) {
      throw new HttpError(404, 'Reservation not found.', 'RESERVATION_NOT_FOUND');
    }
    if (reservation.status !== 'Ready for Pickup') {
      throw new HttpError(409, 'Reservation is not Ready for Pickup yet.', 'NOT_READY');
    }
    return this.issueBookTransaction({
      studentId: reservation.student_id,
      bookId: reservation.book_id,
      copyId: reservation.assigned_copy_id,
      reservationId: reservation.reservation_id,
      actorName,
    });
  }

  // ==================== STUDENT WORKFLOWS ====================

  getStudentRecommendations(
    student: DbUser,
    query: Record<string, string | undefined> = {}
  ): RecommendationsPayload {
    const payload = computeLiveRecommendations({
      student: {
        student_id: student.user_id,
        department: student.department ?? 'Computer Science',
        interests: student.interests ?? [],
        preferred_subjects: student.preferred_subjects ?? [],
      },
      books: this.state.books.map((b) => ({
        book_id: b.book_id,
        slug: b.slug,
        title: b.title,
        author: b.authors,
        cover_image: b.cover_image,
        category: b.category,
        subject: b.subject,
        keywords: b.keywords,
        language: b.language,
        format: b.catalog_format,
        publication_year: b.publication_year,
        rating_average: b.rating_average,
        rating_count: b.rating_count,
        available_copies: b.available_copies,
        total_copies: b.total_copies,
        reserved_copies: b.reserved_copies,
        borrow_count: b.borrow_count,
        status: b.status,
      })),
      allBorrowings: this.state.borrowings.map((b) => ({
        student_id: b.student_id,
        book_id: b.book_id,
        status: b.status === 'Returned' ? 'returned' : b.status === 'Overdue' ? 'overdue' : 'borrowed',
        issue_date: b.issue_date,
        return_date: b.return_date,
      })),
      allReviews: this.state.reviews.map((r) => ({
        student_id: r.student_id,
        book_id: r.book_id,
        rating: r.rating,
        updated_at: r.updated_at,
      })),
      studentFeedback: this.state.recommendationFeedback.filter(
        (f) => f.student_id === student.user_id
      ),
      allStudents: this.state.users
        .filter((u) => u.role === 'student')
        .map((u) => ({
          student_id: u.user_id,
          department: u.department ?? '',
          interests: u.interests ?? [],
          preferred_subjects: u.preferred_subjects ?? [],
        })),
      weights: RECOMMENDATION_SCORING_CONFIG,
    });

    // Optional server-side filtering if query params provided
    const cat = query.category?.trim().toLowerCase();
    const sub = query.subject?.trim().toLowerCase();
    const avail = query.availability?.trim().toLowerCase();
    const lang = query.language?.trim().toLowerCase();
    const fmt = query.format?.trim().toLowerCase();
    const minRating = query.min_rating ? Number.parseFloat(query.min_rating) : NaN;

    if (cat || sub || avail || lang || fmt || !Number.isNaN(minRating)) {
      payload.items = payload.items.filter((item) => {
        if (cat && item.category.toLowerCase() !== cat) return false;
        if (sub && item.subject.toLowerCase() !== sub) return false;
        if (avail === 'available' && !item.is_available) return false;
        if (avail === 'reservable' && (item.is_available || item.total_copies === 0)) return false;
        if (lang && item.language.toLowerCase() !== lang) return false;
        if (fmt && item.format.toLowerCase() !== fmt) return false;
        if (!Number.isNaN(minRating) && item.rating < minRating) return false;
        return true;
      });
    }

    return payload;
  }

  saveRecommendationFeedback(
    studentId: number,
    bookId: number,
    feedback: RecommendationFeedbackValue
  ) {
    const existing = this.state.recommendationFeedback.find(
      (f) => f.student_id === studentId && f.book_id === bookId
    );
    const nowIso = new Date().toISOString();
    if (existing) {
      if (existing.feedback === feedback) {
        this.state.recommendationFeedback = this.state.recommendationFeedback.filter(
          (f) => !(f.student_id === studentId && f.book_id === bookId)
        );
      } else {
        existing.feedback = feedback;
        existing.updated_at = nowIso;
      }
    } else {
      this.state.recommendationFeedback.push({
        student_id: studentId,
        book_id: bookId,
        feedback,
        updated_at: nowIso,
      });
    }
    this.persist();
    return { ok: true };
  }

  upsertReview(student: DbUser, bookId: number, rating: number, reviewText: string) {
    const book = this.state.books.find((b) => b.book_id === bookId && b.status === 'Active');
    if (!book) {
      throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
    }
    const cleanRating = Math.round(Number(rating));
    if (!Number.isFinite(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      throw new HttpError(400, 'Rating must be between 1 and 5 stars.', 'INVALID_RATING');
    }
    const cleanReview = sanitizePlainText(reviewText ?? '').slice(0, 1200);
    const nowIso = new Date().toISOString().slice(0, 10);

    let review = this.state.reviews.find(
      (r) => r.student_id === student.user_id && r.book_id === bookId
    );
    if (review) {
      review.rating = cleanRating;
      review.review = cleanReview;
      review.updated_at = nowIso;
    } else {
      review = {
        rating_id: this.state.nextIds.review++,
        student_id: student.user_id,
        book_id: bookId,
        rating: cleanRating,
        review: cleanReview,
        created_at: nowIso,
        updated_at: nowIso,
      };
      this.state.reviews.push(review);
    }

    reconcileBookRatings(this.state, bookId);
    this.persist();

    return {
      rating_id: review.rating_id,
      book_id: bookId,
      rating: review.rating,
      review: review.review,
      updated_at: review.updated_at,
      book_rating_average: book.rating_average,
      book_rating_count: book.rating_count,
    };
  }

  getStudentDashboard(student: DbUser): StudentDashboardPayload {
    const bookMap = new Map(this.state.books.map((b) => [b.book_id, b]));
    const toLibraryBook = (b: DbBook) => ({
      book_id: b.book_id,
      slug: b.slug,
      title: b.title,
      author: b.authors,
      category: b.category,
      subject: b.subject,
      cover: b.cover_image,
      availability: (b.available_copies > 2
        ? 'Available'
        : b.available_copies > 0
          ? 'Limited'
          : 'Checked Out') as 'Available' | 'Limited' | 'Checked Out',
      available_copies: b.available_copies,
      total_copies: b.total_copies,
      rating_average: b.rating_average,
      added_at: b.created_at,
    });

    const studentBorrowings = this.state.borrowings.filter(
      (b) => b.student_id === student.user_id
    );
    const activeBorrowings = studentBorrowings
      .filter((b) => b.status !== 'Returned')
      .map((b) => {
        const book = bookMap.get(b.book_id);
        return {
          transaction_id: b.borrowing_id,
          student_id: b.student_id,
          book_id: b.book_id,
          issue_date: b.issue_date,
          due_date: b.due_date,
          return_date: b.return_date,
          status: (b.status === 'Overdue' ? 'overdue' : 'borrowed') as 'borrowed' | 'returned' | 'overdue',
          progress_percent: b.progress_percent,
          book: book ? toLibraryBook(book) : toLibraryBook(this.state.books[0]),
        };
      });

    const completedCount = studentBorrowings.filter((b) => b.status === 'Returned').length;
    const studentReservations = this.state.reservations
      .filter((r) => r.student_id === student.user_id)
      .map((r) => {
        const book = bookMap.get(r.book_id);
        const mappedStatus: 'active' | 'ready_for_pickup' | 'fulfilled' | 'cancelled' =
          r.status === 'Ready for Pickup'
            ? 'ready_for_pickup'
            : r.status === 'Waiting'
              ? 'active'
              : r.status === 'Completed'
                ? 'fulfilled'
                : 'cancelled';
        return {
          reservation_id: r.reservation_id,
          student_id: r.student_id,
          book_id: r.book_id,
          reserved_at: r.reservation_date,
          status: mappedStatus,
          book: book ? toLibraryBook(book) : toLibraryBook(this.state.books[0]),
        };
      });

    const liveRecs = this.getStudentRecommendations(student);
    const dashboardRecs = liveRecs.items
      .filter((item) => !item.already_completed)
      .slice(0, 6)
      .map((item) => {
        const book = bookMap.get(item.book_id) ?? this.state.books[0];
        return {
          student_id: student.user_id,
          book_id: item.book_id,
          recommendation_score: item.recommendation_score ?? 0.85,
          recommendation_reason: item.recommendation_reason,
          book: toLibraryBook(book),
        };
      });

    const studentNotifs = this.state.notifications
      .filter((n) => n.user_id === student.user_id)
      .slice(0, 8)
      .map((n) => ({
        notification_id: n.notification_id,
        student_id: n.user_id,
        type: (n.category === 'Reservations'
          ? 'reservation_ready'
          : n.category === 'Due Date Reminders' || n.category === 'Overdue'
            ? 'due_reminder'
            : n.category === 'Reviews & Feedback'
              ? 'rating_prompt'
              : 'new_arrival') as 'due_reminder' | 'reservation_ready' | 'new_arrival' | 'rating_prompt',
        message: n.message,
        created_at: n.created_at,
        relative_time: n.created_at.slice(0, 10),
        is_read: n.is_read,
      }));

    const studentReviews = this.state.reviews
      .filter((r) => r.student_id === student.user_id)
      .map((r) => ({
        student_id: r.student_id,
        book_id: r.book_id,
        rating: r.rating,
        review: r.review,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));

    const subjectCountMap = new Map<string, number>();
    for (const b of studentBorrowings) {
      const book = bookMap.get(b.book_id);
      if (book) {
        subjectCountMap.set(book.subject, (subjectCountMap.get(book.subject) ?? 0) + 1);
      }
    }
    const favouriteSubjects = Array.from(subjectCountMap.entries()).map(([subject, count]) => ({
      subject,
      count,
    }));

    return {
      is_prototype_sample: false,
      student: {
        student_id: student.user_id,
        student_code: student.code,
        name: student.full_name,
        email: student.email,
        course_department: student.department ?? 'Computer Science',
        academic_year: student.academic_year ?? '1st Year',
        avatar_url: student.avatar_url ?? '/src/assets/images/student_avatar_profile_1794589807361.jpg',
        interests: student.interests ?? [],
        preferred_subjects: student.preferred_subjects ?? [],
      },
      recommendations: dashboardRecs,
      current_borrowings: activeBorrowings,
      reading_history_count: completedCount,
      reservations: studentReservations,
      recent_books: this.state.books
        .filter((b) => b.status === 'Active')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 4)
        .map(toLibraryBook),
      notifications: studentNotifs,
      monthly_reading_activity: [
        { month: 'Jan', books_completed: Math.min(completedCount, 1), books_borrowed: Math.min(studentBorrowings.length, 1) },
        { month: 'Feb', books_completed: completedCount, books_borrowed: studentBorrowings.length },
      ],
      favourite_subjects_breakdown: favouriteSubjects,
      recent_reviews: studentReviews,
    };
  }

  getStudentBorrowingsList(student: DbUser) {
    const bookMap = new Map(this.state.books.map((b) => [b.book_id, b]));
    const copyMap = new Map(this.state.copies.map((c) => [c.copy_id, c]));
    const { loan_policy } = this.state.librarySettings;
    const now = new Date();

    const items = this.state.borrowings
      .filter((b) => b.student_id === student.user_id && b.status !== 'Returned')
      .map((b) => {
        const book = bookMap.get(b.book_id);
        const copy = copyMap.get(b.copy_id);
        const daysRemaining = getDaysDifferenceFromToday(b.due_date, now);
        const hasWaitingQueue = this.state.reservations.some(
          (r) => r.book_id === b.book_id && r.status === 'Waiting'
        );
        const canRenew =
          loan_policy.allow_renewal &&
          b.renewals_used < loan_policy.max_renewals_per_loan &&
          !hasWaitingQueue;

        return {
          borrowing_id: b.borrowing_id,
          transaction_code: b.transaction_code,
          book_id: b.book_id,
          book_slug: book?.slug ?? String(b.book_id),
          book_title: book?.title ?? `Book #${b.book_id}`,
          book_author: book?.authors ?? 'Library Author',
          book_cover: book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
          category: book?.category ?? 'General',
          subject: book?.subject ?? 'General',
          accession_number: copy?.accession_number ?? `COPY-${b.copy_id}`,
          shelf_location: `${book?.branch ?? 'Main'} · ${book?.shelf ?? 'Shelf'}`,
          issue_date: b.issue_date,
          due_date: b.due_date,
          days_remaining: daysRemaining,
          status: daysRemaining < 0 ? 'Overdue' : daysRemaining === 0 ? 'Due Today' : 'Borrowed',
          renewals_used: b.renewals_used,
          max_renewals: loan_policy.max_renewals_per_loan,
          can_renew: canRenew,
          renewal_block_reason: !loan_policy.allow_renewal
            ? 'Renewals disabled by library settings'
            : b.renewals_used >= loan_policy.max_renewals_per_loan
              ? 'Maximum renewals reached'
              : hasWaitingQueue
                ? 'Reserved by another student'
                : null,
        };
      });

    return {
      items,
      policy: {
        default_loan_duration_days: loan_policy.default_loan_duration_days,
        max_active_loans_per_student: loan_policy.max_active_loans_per_student,
        allow_renewal: loan_policy.allow_renewal,
        max_renewals_per_loan: loan_policy.max_renewals_per_loan,
        renewal_extension_days: loan_policy.renewal_extension_days,
      },
    };
  }

  getStudentReadingHistory(
    student: DbUser,
    query: Record<string, string | undefined>
  ): ReadingHistoryPayload {
    const bookMap = new Map(this.state.books.map((b) => [b.book_id, b]));
    const copyMap = new Map(this.state.copies.map((c) => [c.copy_id, c]));
    const reviewMap = new Map(
      this.state.reviews
        .filter((r) => r.student_id === student.user_id)
        .map((r) => [r.book_id, r])
    );

    const allCompleted: ReadingHistoryRecord[] = this.state.borrowings
      .filter((b) => b.student_id === student.user_id && b.status === 'Returned')
      .sort(
        (a, b) =>
          (b.return_date ?? b.issue_date).localeCompare(a.return_date ?? a.issue_date) ||
          b.borrowing_id - a.borrowing_id
      )
      .map((b) => {
        const book = bookMap.get(b.book_id);
        const copy = copyMap.get(b.copy_id);
        const rev = reviewMap.get(b.book_id);
        const returnDate = b.return_date ?? b.issue_date;
        const issueMs = new Date(b.issue_date).getTime();
        const returnMs = new Date(returnDate).getTime();
        const duration = Math.max(1, Math.round((returnMs - issueMs) / 86_400_000));
        const availableCopies = book?.available_copies ?? 0;
        const totalCopies = book?.total_copies ?? 0;
        const alreadyActiveForBook = this.state.borrowings.some(
          (active) =>
            active.student_id === student.user_id &&
            active.book_id === b.book_id &&
            active.status !== 'Returned'
        );
        return {
          borrowing_id: b.borrowing_id,
          book_id: b.book_id,
          copy_id: b.copy_id,
          copy_barcode: copy?.barcode ?? copy?.accession_number ?? `COPY-${b.copy_id}`,
          slug: book?.slug ?? String(b.book_id),
          title: book?.title ?? `Book #${b.book_id}`,
          author: book?.authors ?? 'Unknown',
          isbn: book?.isbn ?? '',
          category: book?.category ?? 'General',
          subject: book?.subject ?? 'General',
          cover_image:
            book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
          issue_date: b.issue_date,
          due_date: b.due_date,
          return_date: returnDate,
          loan_duration_days: duration,
          status: 'Returned',
          available_copies: availableCopies,
          total_copies: totalCopies,
          availability_label:
            availableCopies > 0
              ? `${availableCopies} of ${totalCopies} available`
              : 'Currently checked out',
          can_borrow_again: availableCopies > 0 && !alreadyActiveForBook,
          can_review: true,
          student_rating: rev?.rating ?? null,
          student_review: rev?.review ?? null,
          rating_id: rev?.rating_id ?? null,
          rating_updated_at: rev?.updated_at ?? null,
          review_status: rev ? 'Rated' : 'Not Rated',
        };
      });

    const search = (query.search ?? '').trim().toLowerCase();
    const category = (query.category ?? '').trim().toLowerCase();
    const subject = (query.subject ?? '').trim().toLowerCase();
    const author = (query.author ?? '').trim().toLowerCase();
    const statusFilter = (query.status ?? '').trim().toLowerCase();
    const ratingFilter = (query.rating_filter ?? query.rating_status ?? 'all').trim().toLowerCase();
    const sort = (query.sort ?? 'recent').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? '10', 10) || 10));

    const filtered = allCompleted
      .filter((r) => {
        if (
          search &&
          !`${r.title} ${r.author} ${r.category} ${r.subject}`.toLowerCase().includes(search)
        ) {
          return false;
        }
        if (category && r.category.toLowerCase() !== category) return false;
        if (subject && r.subject.toLowerCase() !== subject) return false;
        if (author && r.author.toLowerCase() !== author) return false;
        if (statusFilter && r.status.toLowerCase() !== statusFilter) return false;
        if (ratingFilter === 'rated' && r.student_rating === null) return false;
        if ((ratingFilter === 'not_rated' || ratingFilter === 'unrated') && r.student_rating !== null) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'oldest') {
          return a.return_date.localeCompare(b.return_date) || a.borrowing_id - b.borrowing_id;
        }
        if (sort === 'title_asc') return a.title.localeCompare(b.title);
        if (sort === 'title_desc') return b.title.localeCompare(a.title);
        if (sort === 'highest_rated') {
          return (b.student_rating ?? -1) - (a.student_rating ?? -1);
        }
        if (sort === 'longest_duration') {
          return b.loan_duration_days - a.loan_duration_days;
        }
        return b.return_date.localeCompare(a.return_date) || b.borrowing_id - a.borrowing_id;
      });

    const rankFacets = (vals: string[]) => {
      const counts = new Map<string, number>();
      for (const v of vals) {
        if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 3);
    };

    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const totalCompleted = allCompleted.length;
    const ratedCount = allCompleted.filter((r) => r.student_rating !== null).length;
    const avgDuration =
      totalCompleted > 0
        ? Math.round(
            (allCompleted.reduce((acc, r) => acc + r.loan_duration_days, 0) / totalCompleted) * 10
          ) / 10
        : null;

    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthlyActivity: ReadingActivityChartPoint[] =
      totalCompleted === 0
        ? []
        : Array.from({ length: 6 }, (_, idx) => {
            const offset = 5 - idx;
            const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return {
              key,
              month: monthShort[d.getMonth()],
              count: allCompleted.filter((r) => r.return_date.startsWith(key)).length,
            };
          });

    const monthCountMap = new Map<string, number>();
    for (const r of allCompleted) {
      const ym = r.return_date.slice(0, 7);
      monthCountMap.set(ym, (monthCountMap.get(ym) ?? 0) + 1);
    }
    let mostActivePeriod: { label: string; count: number } | null = null;
    for (const [ym, count] of monthCountMap.entries()) {
      const [y, m] = ym.split('-');
      const mIdx = Number.parseInt(m ?? '1', 10) - 1;
      const label = monthShort[mIdx] ? `${monthShort[mIdx]} ${y}` : ym;
      if (!mostActivePeriod || count > mostActivePeriod.count) {
        mostActivePeriod = { label, count };
      }
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const safePage = Math.min(page, totalPages);

    return {
      is_prototype_sample: false,
      items: filtered.slice((safePage - 1) * limit, safePage * limit),
      total_count: totalCompleted,
      filtered_count: filtered.length,
      page: safePage,
      limit,
      total_pages: totalPages,
      summary: {
        total_books: totalCompleted,
        this_month: allCompleted.filter(
          (r) =>
            r.return_date.startsWith(currentMonthPrefix) ||
            r.issue_date.startsWith(currentMonthPrefix)
        ).length,
        favourite_category: rankFacets(allCompleted.map((r) => r.category))[0]?.name ?? null,
        ratings_given: ratedCount,
      },
      insights: {
        has_sufficient_data: totalCompleted >= 2,
        favourite_subjects: totalCompleted >= 2 ? rankFacets(allCompleted.map((r) => r.subject)) : [],
        favourite_categories: totalCompleted >= 2 ? rankFacets(allCompleted.map((r) => r.category)) : [],
        favourite_authors: totalCompleted >= 2 ? rankFacets(allCompleted.map((r) => r.author)) : [],
        average_loan_duration_days: totalCompleted >= 2 ? avgDuration : null,
        most_active_period: totalCompleted >= 2 ? mostActivePeriod : null,
        total_completed: totalCompleted,
      },
      monthly_activity: monthlyActivity,
      facets: {
        categories: Array.from(new Set(allCompleted.map((r) => r.category))).sort(),
        subjects: Array.from(new Set(allCompleted.map((r) => r.subject))).sort(),
        authors: Array.from(new Set(allCompleted.map((r) => r.author))).sort(),
        statuses: ['Returned'],
      },
    };
  }

  getStudentReservationsPayload(
    student: DbUser,
    query: Record<string, string | undefined>
  ): ReservationsPayload {
    const bookMap = new Map(this.state.books.map((b) => [b.book_id, b]));
    const pickupWindowHours = this.state.librarySettings.reservation_policy.pickup_window_hours;
    const holdDays = Math.max(1, Math.round(pickupWindowHours / 24));

    const mapped: ReservationRecord[] = this.state.reservations
      .filter((r) => r.student_id === student.user_id)
      .sort(
        (a, b) =>
          b.reservation_date.localeCompare(a.reservation_date) ||
          b.reservation_id - a.reservation_id
      )
      .map((r) => {
        const book = bookMap.get(r.book_id);
        const waitingQueue = this.state.reservations
          .filter((x) => x.book_id === r.book_id && x.status === 'Waiting')
          .sort(
            (a, b) =>
              a.reservation_date.localeCompare(b.reservation_date) ||
              a.reservation_id - b.reservation_id
          );
        const queuePosition =
          r.status === 'Waiting'
            ? waitingQueue.findIndex((x) => x.reservation_id === r.reservation_id) + 1
            : null;
        const status: ReservationStatus = r.status;

        return {
          reservation_id: r.reservation_id,
          reference_code: r.reservation_code,
          book_id: r.book_id,
          slug: book?.slug ?? String(r.book_id),
          title: book?.title ?? `Book #${r.book_id}`,
          author: book?.authors ?? 'Unknown',
          category: book?.category ?? 'General',
          subject: book?.subject ?? 'General',
          cover_image:
            book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
          reservation_date: r.reservation_date,
          status,
          queue_position: queuePosition,
          people_ahead: queuePosition !== null ? Math.max(0, queuePosition - 1) : null,
          estimated_availability:
            status === 'Ready for Pickup'
              ? 'Available now for desk collection'
              : status === 'Waiting'
                ? 'Queued in FIFO order'
                : null,
          ready_date: r.ready_date,
          pickup_deadline: r.pickup_deadline,
          hold_days: status === 'Ready for Pickup' ? holdDays : null,
          fulfilled_date: r.status === 'Completed' ? r.updated_at.slice(0, 10) : null,
          cancelled_date: r.status === 'Cancelled' ? r.updated_at.slice(0, 10) : null,
          expired_date: r.status === 'Expired' ? r.updated_at.slice(0, 10) : null,
          available_copies: book?.available_copies ?? 0,
          total_copies: book?.total_copies ?? 0,
          location_summary: book ? `${book.branch} · ${book.shelf}` : 'Main Central Library',
          instructions:
            status === 'Ready for Pickup'
              ? `Present your student ID at ${book?.branch ?? 'Main Central Library'} before ${r.pickup_deadline ?? 'the hold deadline'}.`
              : status === 'Waiting'
                ? 'You will be notified automatically as soon as a copy is returned and assigned to you.'
                : null,
          can_cancel: status === 'Waiting' || status === 'Ready for Pickup',
          can_collect_online: false,
        };
      });

    const tab = (query.tab ?? 'all').toLowerCase();
    const search = (query.search ?? '').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? '6', 10) || 6));

    const filtered = mapped.filter((item) => {
      if (
        search &&
        !`${item.title} ${item.author} ${item.reference_code}`.toLowerCase().includes(search)
      ) {
        return false;
      }
      if (tab === 'active') return item.status === 'Waiting' || item.status === 'Ready for Pickup';
      if (tab === 'ready_for_pickup' || tab === 'ready') return item.status === 'Ready for Pickup';
      if (tab === 'waiting') return item.status === 'Waiting';
      if (tab === 'completed' || tab === 'fulfilled') {
        return item.status === 'Completed' || item.status === 'Borrowed';
      }
      if (tab === 'cancelled_expired' || tab === 'cancelled') {
        return item.status === 'Cancelled' || item.status === 'Expired';
      }
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const safePage = Math.min(page, totalPages);

    return {
      is_prototype_sample: false,
      items: filtered.slice((safePage - 1) * limit, safePage * limit),
      total_count: mapped.length,
      filtered_count: filtered.length,
      page: safePage,
      limit,
      total_pages: totalPages,
      summary: {
        active_reservations: mapped.filter(
          (i) => i.status === 'Waiting' || i.status === 'Ready for Pickup'
        ).length,
        ready_for_pickup: mapped.filter((i) => i.status === 'Ready for Pickup').length,
        waiting: mapped.filter((i) => i.status === 'Waiting').length,
        expiring_soon: mapped.filter((i) => i.status === 'Ready for Pickup').length,
      },
      policy: {
        reservation_limit:
          this.state.librarySettings.reservation_policy.max_active_reservations_per_student,
        active_count: mapped.filter(
          (i) => i.status === 'Waiting' || i.status === 'Ready for Pickup'
        ).length,
        pickup_hold_days: holdDays,
        priority_policy_label: 'First-In, First-Out (FIFO) Queue',
        workflow_mode: 'librarian_issue',
      },
      supported_statuses: ['Waiting', 'Ready for Pickup', 'Completed', 'Cancelled', 'Expired'],
    };
  }

  getStudentNotificationsPayload(
    student: DbUser,
    query: Record<string, string | undefined>
  ): NotificationsPayload {
    const bookMap = new Map(this.state.books.map((b) => [b.book_id, b]));
    const allStudentNotifs: NotificationItem[] = this.state.notifications
      .filter((n) => n.user_id === student.user_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.notification_id - a.notification_id)
      .map((n) => {
        const book = n.related_book_id ? bookMap.get(n.related_book_id) : undefined;
        return {
          notification_id: n.notification_id,
          title: n.title,
          message: n.message,
          category: n.category,
          priority: n.priority,
          is_read: n.is_read,
          related_entity_type: n.related_entity_type,
          related_entity_id: n.related_entity_id,
          related_book_id: n.related_book_id,
          related_book_title: n.related_book_title,
          action_label: n.action_label,
          action_route: n.related_book_id && book
            ? { name: 'book-detail', slug: book.slug }
            : n.category === 'Reservations'
              ? { name: 'student-reservations' }
              : n.category === 'Due Date Reminders' || n.category === 'Overdue' || n.category === 'Borrowing'
                ? { name: 'student-my-books' }
                : n.category === 'Recommendations'
                  ? { name: 'student-recommendations' }
                  : null,
          action_url: n.action_url,
          created_at: n.created_at,
          read_at: n.read_at,
          can_delete: n.can_delete,
          is_mandatory: n.is_mandatory,
          announcement_author: n.announcement_author,
        };
      });

    const filter = (query.tab ?? 'all').toLowerCase();
    const category = query.category?.trim();
    const search = (query.search ?? '').trim().toLowerCase();

    const filtered = allStudentNotifs.filter((item) => {
      if (filter === 'unread' && item.is_read) return false;
      if (filter === 'read' && !item.is_read) return false;
      if (filter === 'important' && item.priority === 'Normal') return false;
      if (category && category !== 'All' && item.category !== category) return false;
      if (search && !`${item.title} ${item.message} ${item.category}`.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });

    const unreadCount = allStudentNotifs.filter((n) => !n.is_read).length;

    return {
      is_prototype_sample: false,
      items: filtered,
      total_count: allStudentNotifs.length,
      filtered_count: filtered.length,
      unread_count: unreadCount,
      page: 1,
      limit: 50,
      total_pages: 1,
      summary: {
        total_notifications: allStudentNotifs.length,
        unread: unreadCount,
        important: allStudentNotifs.filter((n) => n.priority !== 'Normal').length,
        recent: allStudentNotifs.length,
      },
      allow_delete: true,
      preferences: student.notification_preferences ?? {
        categories: [],
        reminder_timings: ['2_days_before', '1_day_before', 'on_due_date'],
        allow_reminder_customization: true,
        email_delivery_configured: true,
        configured_loan_period_days: this.state.librarySettings.loan_policy.default_loan_duration_days,
      },
    };
  }

  getStudentProfilePayload(student: DbUser) {
    const sessions = this.state.sessions
      .filter((s) => s.user_id === student.user_id)
      .map((s) => ({
        session_id: s.session_id,
        device_label: s.device_label,
        browser: s.device_label,
        location_summary: s.ip_address,
        last_active_at: s.last_active_at,
        is_current: true,
        can_revoke: true,
      }));

    const recPrefsRaw = (student.recommendation_preferences ?? {}) as Record<string, unknown>;

    return {
      is_prototype_sample: false,
      account_status: (student.account_status === 'Active' ? 'Active' : 'Suspended') as
        | 'Active'
        | 'Pending'
        | 'Suspended',
      email_verified: true,
      email_verification_pending: null,
      policy: {
        allow_profile_photo_edit: true,
        allow_student_code_edit: false,
        allow_academic_edit: true,
        allow_session_revoke: true,
        allow_account_deletion: false,
      },
      personal: {
        full_name: student.full_name,
        email: student.email,
        mobile_number: student.mobile ?? '',
        avatar_url: student.avatar_url ?? '',
      },
      academic: {
        student_code: student.code,
        institution_name:
          student.institution ?? this.state.librarySettings.general_settings.library_name,
        course_department: student.department ?? 'Computer Science',
        academic_year: student.academic_year ?? '1st Year',
        semester: student.semester ?? 'Semester 1',
      },
      reading_interests: student.interests ?? [],
      available_reading_interests: [
        'Artificial Intelligence',
        'Machine Learning',
        'Data Science',
        'Programming',
        'Computer Science',
        'Mathematics',
        'Physics',
        'Business',
        'Finance',
        'Psychology',
        'Literature',
        'History',
        'Science Fiction',
        'Self Development',
        'Cybersecurity',
        'Web Development',
        'Cloud Computing',
        'Electronics',
        'Robotics',
        'Research',
      ],
      preferred_subjects: student.preferred_subjects ?? [],
      available_subjects: Array.from(
        new Set([
          ...this.state.subjects.map((s) => s.name),
          'Database Management Systems',
          'Operating Systems',
          'Computer Networks',
          'Software Engineering',
          'Artificial Intelligence',
          'Data Structures & Algorithms',
          'Python Programming',
        ])
      ),
      recommendation_preferences: {
        preferred_topics: Array.isArray(recPrefsRaw.preferred_topics)
          ? (recPrefsRaw.preferred_topics as string[])
          : (student.interests ?? []).slice(0, 3),
        discovery_preference:
          (recPrefsRaw.discovery_preference as 'mostly_familiar' | 'balanced' | 'explore_new') ??
          'balanced',
        reading_level:
          (recPrefsRaw.reading_level as
            | 'Beginner'
            | 'Intermediate'
            | 'Advanced'
            | 'No preference') ?? 'No preference',
        content_formats: Array.isArray(recPrefsRaw.content_formats)
          ? (recPrefsRaw.content_formats as string[])
          : ['Print Books', 'eBooks'],
        content_languages: Array.isArray(recPrefsRaw.content_languages)
          ? (recPrefsRaw.content_languages as string[])
          : ['English'],
        avoid_previously_read: Boolean(recPrefsRaw.avoid_previously_read ?? false),
        availability_preference:
          (recPrefsRaw.availability_preference as 'available_first' | 'include_unavailable') ??
          'available_first',
      },
      notification_preferences:
        student.notification_preferences ??
        ({
          categories: [],
          reminder_timings: ['2_days_before', '1_day_before', 'on_due_date'],
          allow_reminder_customization: true,
          email_delivery_configured: true,
          configured_loan_period_days:
            this.state.librarySettings.loan_policy.default_loan_duration_days,
        } as NotificationPreferencesPayload),
      active_sessions: sessions,
    };
  }

  // ==================== LIBRARIAN WORKFLOWS ====================

  getCirculationPolicy(): CirculationPolicy {
    return {
      default_loan_duration_days:
        this.state.librarySettings.loan_policy.default_loan_duration_days,
      reservation_pickup_window_hours:
        this.state.librarySettings.reservation_policy.pickup_window_hours,
      fine_policy_enabled: this.state.librarySettings.fine_policy.fine_policy_enabled,
      fine_per_day_amount: this.state.librarySettings.fine_policy.fine_per_day_amount,
      fine_currency_symbol: this.state.librarySettings.fine_policy.fine_currency_symbol,
      supports_email_notifications:
        this.state.librarySettings.reminder_policy.email_notifications_enabled,
      supports_barcodes: true,
      server_reference_iso: new Date().toISOString().slice(0, 10),
    };
  }

  toCirculationStudentRecord(student: DbUser): CirculationStudentRecord {
    const activeLoans = this.state.borrowings.filter(
      (b) => b.student_id === student.user_id && b.status !== 'Returned'
    );
    const now = new Date();
    const dueSoonCount = activeLoans.filter((b) => {
      const d = getDaysDifferenceFromToday(b.due_date, now);
      return d >= 0 && d <= 3;
    }).length;
    const overdueCount = activeLoans.filter(
      (b) => getDaysDifferenceFromToday(b.due_date, now) < 0
    ).length;
    const maxLimit = this.state.librarySettings.loan_policy.max_active_loans_per_student;

    return {
      student_id: student.user_id,
      student_code: student.code,
      roll_number: student.code,
      full_name: student.full_name,
      email: student.email,
      department: student.department ?? 'Computer Science',
      program: student.program ?? 'B.Tech',
      account_status:
        student.account_status === 'Active'
          ? 'Active'
          : student.account_status === 'Suspended'
            ? 'Suspended'
            : 'Blocked',
      active_loans_count: activeLoans.length,
      due_soon_count: dueSoonCount,
      overdue_count: overdueCount,
      max_borrowing_limit: maxLimit,
      remaining_capacity: Math.max(0, maxLimit - activeLoans.length),
      active_book_ids: activeLoans.map((b) => b.book_id),
      restriction_reason: student.restriction_reason ?? null,
    };
  }

  toActiveBorrowingDetail(b: DbBorrowing): ActiveBorrowingDetail {
    const student = this.state.users.find((u) => u.user_id === b.student_id);
    const book = this.state.books.find((bk) => bk.book_id === b.book_id);
    const copy = this.state.copies.find((c) => c.copy_id === b.copy_id);
    const daysRemaining = getDaysDifferenceFromToday(b.due_date, new Date());

    return {
      borrowing_id: b.borrowing_id,
      transaction_code: b.transaction_code,
      student_id: b.student_id,
      student_name: student?.full_name ?? `Student #${b.student_id}`,
      student_code: student?.code ?? `STU-${b.student_id}`,
      student_email: student?.email ?? '',
      student_department: student?.department ?? 'Computer Science',
      student_account_status:
        student?.account_status === 'Active' ? 'Active' : 'Blocked',
      book_id: b.book_id,
      book_title: book?.title ?? `Book #${b.book_id}`,
      book_author: book?.authors ?? 'Unknown',
      book_isbn: book?.isbn ?? '',
      book_cover: book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
      copy_id: b.copy_id,
      accession_number: copy?.accession_number ?? `COPY-${b.copy_id}`,
      barcode: copy?.barcode ?? null,
      shelf_location: `${book?.branch ?? 'Main'} · ${book?.shelf ?? 'Shelf'}`,
      copy_condition: copy?.condition ?? 'Good',
      copy_status: copy?.status ?? 'Issued',
      issue_date: b.issue_date,
      due_date: b.due_date,
      return_date: b.return_date,
      status: daysRemaining < 0 && b.status !== 'Returned' ? 'Overdue' : b.status,
    };
  }

  toLibrarianReservationItem(r: DbReservation): LibrarianReservationItem {
    const student = this.state.users.find((u) => u.user_id === r.student_id);
    const book = this.state.books.find((b) => b.book_id === r.book_id);
    const copy = r.assigned_copy_id
      ? this.state.copies.find((c) => c.copy_id === r.assigned_copy_id)
      : undefined;

    const waitingQueue = this.state.reservations
      .filter((x) => x.book_id === r.book_id && x.status === 'Waiting')
      .sort(
        (a, b) =>
          a.reservation_date.localeCompare(b.reservation_date) ||
          a.reservation_id - b.reservation_id
      );
    const queuePosition =
      r.status === 'Waiting'
        ? waitingQueue.findIndex((x) => x.reservation_id === r.reservation_id) + 1
        : null;

    return {
      reservation_id: r.reservation_id,
      reservation_code: r.reservation_code,
      student_id: r.student_id,
      student_name: student?.full_name ?? `Student #${r.student_id}`,
      student_code: student?.code ?? `STU-${r.student_id}`,
      student_department: student?.department ?? 'Computer Science',
      student_email: student?.email ?? '',
      student_account_status: student?.account_status === 'Active' ? 'Active' : 'Blocked',
      book_id: r.book_id,
      book_slug: book?.slug ?? String(r.book_id),
      book_title: book?.title ?? `Book #${r.book_id}`,
      book_author: book?.authors ?? 'Unknown',
      book_isbn: book?.isbn ?? '',
      book_cover: book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
      category: book?.category ?? 'General',
      subject: book?.subject ?? 'General',
      branch: book?.branch ?? 'Main Central Library',
      reservation_date: r.reservation_date,
      queue_position: queuePosition,
      queue_total: waitingQueue.length || null,
      status: r.status,
      ready_date: r.ready_date,
      pickup_deadline: r.pickup_deadline,
      assigned_copy_id: r.assigned_copy_id,
      assigned_copy_accession: copy?.accession_number ?? null,
      assigned_copy_status: copy?.status ?? null,
      notes: r.notes,
    };
  }

  getOverdueRecords(): OverdueRecordItem[] {
    const now = new Date();
    const { fine_policy } = this.state.librarySettings;

    return this.state.borrowings
      .filter((b) => {
        if (b.status === 'Returned') return false;
        return getDaysDifferenceFromToday(b.due_date, now) < 0 || b.status === 'Overdue';
      })
      .map((b) => {
        const student = this.state.users.find((u) => u.user_id === b.student_id);
        const book = this.state.books.find((bk) => bk.book_id === b.book_id);
        const copy = this.state.copies.find((c) => c.copy_id === b.copy_id);
        const daysRemaining = getDaysDifferenceFromToday(b.due_date, now);
        const daysOverdue = Math.max(1, Math.abs(daysRemaining));
        const chargeableDays = Math.max(0, daysOverdue - fine_policy.grace_period_days);
        const computedFine =
          fine_policy.fine_policy_enabled && fine_policy.fine_per_day_amount
            ? Number((chargeableDays * fine_policy.fine_per_day_amount).toFixed(2))
            : null;

        return {
          borrowing_id: b.borrowing_id,
          transaction_code: b.transaction_code,
          student_id: b.student_id,
          student_name: student?.full_name ?? `Student #${b.student_id}`,
          student_code: student?.code ?? `STU-${b.student_id}`,
          student_email: student?.email ?? '',
          student_department: student?.department ?? 'Computer Science',
          student_account_status: student?.account_status === 'Active' ? 'Active' : 'Blocked',
          student_restriction_note: student?.restriction_reason ?? null,
          book_id: b.book_id,
          book_slug: book?.slug ?? String(b.book_id),
          book_title: book?.title ?? `Book #${b.book_id}`,
          book_author: book?.authors ?? 'Unknown',
          book_isbn: book?.isbn ?? '',
          book_cover: book?.cover_image ?? '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
          book_category: book?.category ?? 'General',
          branch: book?.branch ?? 'Main Central Library',
          copy_id: b.copy_id,
          accession_number: copy?.accession_number ?? `COPY-${b.copy_id}`,
          shelf_location: `${book?.branch ?? 'Main'} · ${book?.shelf ?? 'Shelf'}`,
          copy_condition: copy?.condition ?? 'Good',
          issue_date: b.issue_date,
          due_date: b.due_date,
          return_date: b.return_date,
          borrowing_status: 'Overdue',
          days_overdue: daysOverdue,
          fine_amount: computedFine,
          fine_currency_symbol: fine_policy.fine_currency_symbol,
          fine_calculation_basis:
            computedFine !== null
              ? `${fine_policy.fine_currency_symbol}${fine_policy.fine_per_day_amount}/day after ${fine_policy.grace_period_days}-day grace`
              : null,
          fine_payment_status: computedFine !== null ? (b.fine_payment_status ?? 'Unpaid') : null,
          fine_outstanding_balance: computedFine,
          last_reminder_at: b.last_reminder_at,
          reminder_history: b.reminder_history,
        };
      });
  }

  sendOverdueReminder(borrowingId: number, actorName: string, skipCooldown: boolean = false) {
    const borrowing = this.state.borrowings.find(
      (b) => b.borrowing_id === borrowingId && b.status !== 'Returned'
    );
    if (!borrowing) {
      throw new HttpError(404, 'Active borrowing record not found.', 'NOT_FOUND');
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const cooldownHours =
      this.state.librarySettings.reminder_policy.overdue_reminder_frequency_days * 24;

    if (!skipCooldown && borrowing.last_reminder_at) {
      const hoursElapsed = (now.getTime() - new Date(borrowing.last_reminder_at).getTime()) / 3_600_000;
      if (hoursElapsed < Math.min(24, cooldownHours)) {
        throw new HttpError(
          429,
          'A reminder was already sent recently for this overdue loan.',
          'COOLDOWN_ACTIVE'
        );
      }
    }

    const book = this.state.books.find((b) => b.book_id === borrowing.book_id);
    const daysOverdue = Math.max(1, Math.abs(getDaysDifferenceFromToday(borrowing.due_date, now)));

    this.addNotification({
      user_id: borrowing.student_id,
      title: `Overdue Notice: ${book?.title ?? `Book #${borrowing.book_id}`}`,
      message: `This book is ${daysOverdue} day(s) overdue (due ${borrowing.due_date}). Please return it at your earliest convenience.`,
      category: 'Overdue',
      priority: 'Urgent',
      is_read: false,
      related_entity_type: 'borrowing',
      related_entity_id: borrowing.borrowing_id,
      related_book_id: borrowing.book_id,
      related_book_title: book?.title ?? null,
      action_label: 'View My Books',
      action_url: '/student/my-books',
      created_at: nowIso,
      read_at: null,
      can_delete: true,
      is_mandatory: true,
      announcement_author: actorName,
      dedupe_key: null,
    });

    const reminderLog = {
      reminder_id: `REM-${borrowing.borrowing_id}-${Date.now()}`,
      sent_at: nowIso,
      channel: (this.state.librarySettings.reminder_policy.email_notifications_enabled
        ? 'In-App + Email'
        : 'In-App') as 'In-App' | 'In-App + Email',
      sent_by: actorName,
      status: 'Delivered' as const,
    };
    borrowing.last_reminder_at = nowIso;
    borrowing.reminder_history.unshift(reminderLog);
    borrowing.updated_at = nowIso;
    this.persist();
    return reminderLog;
  }

  createBookWithCopies(input: {
    title: string;
    subtitle?: string;
    authors: string;
    isbn: string;
    publisher?: string;
    publication_year: number;
    edition?: string;
    language?: 'English' | 'Hindi' | 'Other';
    pages?: number;
    category: string;
    subject: string;
    keywords?: string[];
    description?: string;
    format: 'Hardcover' | 'Paperback' | 'Reference' | 'E-Book';
    cover_image?: string;
    initial_copies: number;
    physical_copies?: Array<{
      accession_number: string;
      barcode?: string | null;
      condition?: CopyCondition;
      status?: CopyStatus;
      location_code?: string;
    }>;
    branch: string;
    floor?: string;
    section?: string;
    shelf: string;
    actorName: string;
  }) {
    const cleanTitle = sanitizePlainText(input.title);
    const cleanAuthors = sanitizePlainText(input.authors);
    const cleanIsbn = input.isbn.trim();
    if (!cleanTitle || !cleanAuthors || !cleanIsbn) {
      throw new HttpError(400, 'Title, authors, and ISBN are required.', 'INVALID_INPUT');
    }

    const dupIsbn = this.state.books.some(
      (b) => b.isbn.toLowerCase() === cleanIsbn.toLowerCase() && b.status === 'Active'
    );
    if (dupIsbn) {
      throw new HttpError(409, `A book with ISBN ${cleanIsbn} already exists in inventory.`, 'DUPLICATE_ISBN');
    }

    const numCopies = Math.max(1, Math.min(50, Math.round(Number(input.initial_copies) || 1)));
    const bookId = this.state.nextIds.book++;
    const nowIso = new Date().toISOString();
    const slugBase = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${slugBase}-${bookId}`;

    const newBook: DbBook = {
      book_id: bookId,
      slug,
      isbn: cleanIsbn,
      title: cleanTitle,
      subtitle: sanitizePlainText(input.subtitle ?? ''),
      authors: cleanAuthors,
      publisher: sanitizePlainText(input.publisher ?? 'Academic Library Press') || 'Academic Library Press',
      publication_year: Number(input.publication_year) || new Date().getUTCFullYear(),
      edition: sanitizePlainText(input.edition ?? '1st Edition') || '1st Edition',
      language: input.language ?? 'English',
      pages: Number(input.pages) || 320,
      category: sanitizePlainText(input.category) || 'Computer Science',
      subject: sanitizePlainText(input.subject) || 'Computer Science',
      description:
        sanitizePlainText(input.description ?? '') ||
        `${cleanTitle} by ${cleanAuthors}. Cataloged for academic coursework and library research.`,
      keywords: (input.keywords ?? []).map((k) => sanitizePlainText(k)).filter(Boolean),
      format: input.format || 'Hardcover',
      catalog_format: input.format === 'E-Book' ? 'E-Book' : 'Physical Book',
      cover_image:
        input.cover_image?.trim() || '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
      status: 'Active',
      branch: sanitizePlainText(input.branch) || 'Main Central Library',
      floor: sanitizePlainText(input.floor ?? '2nd Floor') || '2nd Floor',
      section: sanitizePlainText(input.section ?? 'General Stacks') || 'General Stacks',
      shelf: sanitizePlainText(input.shelf) || 'GEN-101',
      total_copies: 0,
      available_copies: 0,
      issued_copies: 0,
      reserved_copies: 0,
      unavailable_copies: 0,
      rating_average: 0,
      rating_count: 0,
      review_count: 0,
      borrow_count: 0,
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
      added_by: input.actorName,
      updated_by: input.actorName,
    };

    this.state.books.unshift(newBook);

    const providedCopies = Array.isArray(input.physical_copies) && input.physical_copies.length > 0
      ? input.physical_copies
      : null;

    if (providedCopies) {
      for (const draftCopy of providedCopies) {
        const acc = String(draftCopy.accession_number ?? '').trim();
        if (!acc) {
          throw new HttpError(400, 'Every physical copy must include an accession number.', 'INVALID_ACCESSION');
        }
        if (this.state.copies.some((c) => c.accession_number.toLowerCase() === acc.toLowerCase())) {
          throw new HttpError(409, `Accession number ${acc} already exists in inventory.`, 'DUPLICATE_ACCESSION');
        }
      }
      for (let i = 0; i < providedCopies.length; i++) {
        const draftCopy = providedCopies[i];
        const copyId = this.state.nextIds.copy++;
        const accession = String(draftCopy.accession_number).trim();
        const safeStatus: CopyStatus =
          draftCopy.status === 'Under Repair' || draftCopy.status === 'Damaged'
            ? draftCopy.status
            : 'Available';
        const safeCondition: CopyCondition =
          draftCopy.condition === 'Good' ||
          draftCopy.condition === 'Fair' ||
          draftCopy.condition === 'Worn' ||
          draftCopy.condition === 'Needs Repair' ||
          draftCopy.condition === 'New'
            ? draftCopy.condition
            : draftCopy.condition === 'Damaged'
              ? 'Needs Repair'
              : 'New';
        this.state.copies.push({
          copy_id: copyId,
          book_id: bookId,
          accession_number: accession,
          barcode: draftCopy.barcode ? String(draftCopy.barcode).trim() : `BC-${bookId}-${String(i + 1).padStart(2, '0')}`,
          status: safeStatus,
          condition: safeCondition,
          branch: newBook.branch,
          floor: newBook.floor,
          section: newBook.section,
          shelf: draftCopy.location_code?.trim() || newBook.shelf,
          added_at: nowIso.slice(0, 10),
          updated_at: nowIso,
        });
      }
    } else {
      for (let i = 1; i <= numCopies; i++) {
        const copyId = this.state.nextIds.copy++;
        const accession = `ACC-${String(bookId).padStart(4, '0')}-${String(i).padStart(2, '0')}`;
        this.state.copies.push({
          copy_id: copyId,
          book_id: bookId,
          accession_number: accession,
          barcode: `BC-${bookId}-${String(i).padStart(2, '0')}`,
          status: 'Available',
          condition: 'New',
          branch: newBook.branch,
          floor: newBook.floor,
          section: newBook.section,
          shelf: newBook.shelf,
          added_at: nowIso.slice(0, 10),
          updated_at: nowIso,
        });
      }
    }

    reconcileBookCounts(this.state, bookId);
    this.persist();
    return this.toInventoryBookItem(newBook);
  }

  buildLibrarianFullProfilePayload(user: DbUser, currentSessionId?: string) {
    const base = this.buildSessionPayload(user).librarian!;
    const defaultPrefs = [
      {
        category: 'overdue_alerts' as const,
        label: 'Overdue Alerts',
        description: 'Daily summary and escalation notices for overdue student loans.',
        in_app_enabled: true,
        email_enabled: true,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: true,
      },
      {
        category: 'reservation_alerts' as const,
        label: 'Reservation Alerts',
        description: 'New queue holds, returned copies matching reservations, and expiring pickups.',
        in_app_enabled: true,
        email_enabled: true,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: true,
      },
      {
        category: 'issue_notifications' as const,
        label: 'Issue Notifications',
        description: 'Desk circulation receipts and limit override confirmations.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: true,
      },
      {
        category: 'return_notifications' as const,
        label: 'Return Notifications',
        description: 'Damaged/lost copy return flags and stock replenishment notices.',
        in_app_enabled: true,
        email_enabled: false,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: true,
      },
      {
        category: 'library_announcements' as const,
        label: 'Library Announcements',
        description: 'Administrative broadcasts, scheduled audits, and holiday desk hours.',
        in_app_enabled: true,
        email_enabled: true,
        is_mandatory: false,
        mandatory_reason: null,
        email_supported: true,
      },
      {
        category: 'account_security_alerts' as const,
        label: 'Account Security Alerts',
        description: 'Password updates, session revocations, and staff sign-in verification.',
        in_app_enabled: true,
        email_enabled: true,
        is_mandatory: true,
        mandatory_reason: 'Mandatory for staff account protection and cannot be turned off.',
        email_supported: true,
      },
    ];

    const storedPrefs = Array.isArray(user.librarian_notification_preferences)
      ? defaultPrefs.map((def) => {
          const match = (
            user.librarian_notification_preferences as Array<{
              category: string;
              in_app_enabled: boolean;
              email_enabled: boolean;
            }>
          ).find((p) => p.category === def.category);
          return match
            ? {
                ...def,
                in_app_enabled: def.is_mandatory ? true : Boolean(match.in_app_enabled),
                email_enabled: Boolean(match.email_enabled),
              }
            : def;
        })
      : defaultPrefs;

    const recentActivity = this.state.auditLogs
      .filter((l) => l.actor_id === user.user_id || l.actor_name === user.full_name)
      .slice(0, 12)
      .map((l) => ({
        activity_id: l.log_id,
        action: l.action,
        target_summary: `${l.entity_label} (${l.entity_id})`,
        timestamp: l.timestamp,
        status: (l.result === 'Success' ? 'Completed' : 'Verified') as 'Completed' | 'Verified',
      }));

    const activeSessions = this.state.sessions
      .filter((s) => s.user_id === user.user_id)
      .map((s) => ({
        session_id: s.session_id,
        device_label: s.device_label,
        browser: s.device_label,
        location_summary: s.ip_address,
        last_active_at: s.last_active_at,
        is_current: s.session_id === currentSessionId,
        can_revoke: s.session_id !== currentSessionId,
      }));

    return {
      is_prototype_sample: false,
      librarian: {
        ...base,
        mobile_number: user.mobile ?? '',
        designation: user.designation ?? base.department_title,
        branch: user.branch ?? 'Main Central Library',
        joining_date: user.joining_date ?? user.created_at,
      },
      capabilities: {
        allow_photo_upload: true,
        supports_email_notifications:
          this.state.librarySettings.reminder_policy.email_notifications_enabled,
        supports_session_management: true,
        supports_audit_logs: true,
        supports_2fa: false as const,
      },
      notification_preferences: storedPrefs,
      recent_activity: recentActivity,
      active_sessions: activeSessions,
    };
  }

  toStaffAccountRecord(u: DbUser): StaffAccountRecord {
    return {
      staff_id: u.user_id,
      staff_code: u.code,
      full_name: u.full_name,
      email: u.email,
      mobile_number: u.mobile ?? '',
      designation: u.designation ?? (u.role === 'admin' ? 'System Administrator' : 'Librarian'),
      branch: u.branch ?? 'Main Central Library',
      role: u.role === 'admin' ? 'admin' : 'librarian',
      status:
        u.account_status === 'Active'
          ? 'Active'
          : u.account_status === 'Inactive'
            ? 'Inactive'
            : 'Suspended',
      joining_date: u.joining_date ?? u.created_at,
      created_at: u.created_at,
      invitation_pending: Boolean(u.invitation_pending),
      invitation_sent_at: u.invitation_sent_at ?? null,
      must_change_password: Boolean(u.must_change_password),
    };
  }

  toLibrarianStudentDirectoryItem(u: DbUser): LibrarianStudentDirectoryItem {
    const circ = this.toCirculationStudentRecord(u);
    const activeReservations = this.state.reservations.filter(
      (r) =>
        r.student_id === u.user_id &&
        (r.status === 'Waiting' || r.status === 'Ready for Pickup')
    ).length;
    const allStudentLoans = this.state.borrowings.filter((b) => b.student_id === u.user_id);
    const completedLoans = allStudentLoans.filter((b) => b.status === 'Returned').length;

    return {
      ...circ,
      institution: u.institution ?? this.state.librarySettings.general_settings.library_name,
      academic_year: u.academic_year ?? '1st Year',
      semester: u.semester ?? 'Semester 1',
      mobile: u.mobile ?? null,
      active_reservations_count: activeReservations,
      total_books_borrowed: allStudentLoans.length,
      completed_loans_count: completedLoans,
    };
  }

  publishAnnouncementRecord(announcementId: number, actorName: string) {
    const ann = this.state.announcements.find((a) => a.announcement_id === announcementId);
    if (!ann) {
      throw new HttpError(404, 'Announcement not found.', 'NOT_FOUND');
    }
    const nowIso = new Date().toISOString();
    ann.status = 'Published';
    ann.publish_at = nowIso;
    ann.updated_at = nowIso;

    if (!ann.notifications_sent) {
      const targetStudents = resolveTargetStudents(
        this.state,
        ann.target_type,
        ann.target_value
      );
      let created = 0;
      for (const s of targetStudents) {
        if (
          this.state.notifications.some(
            (n) => n.user_id === s.user_id && n.dedupe_key === `announcement-${ann.announcement_id}`
          )
        ) {
          continue;
        }
        this.addNotification({
          user_id: s.user_id,
          title: ann.title,
          message: ann.content,
          category: 'Library Announcements',
          priority: ann.priority,
          is_read: false,
          related_entity_type: 'announcement',
          related_entity_id: ann.announcement_id,
          related_book_id: null,
          related_book_title: null,
          action_label: 'View Notifications',
          action_url: '/student/notifications',
          created_at: nowIso,
          read_at: null,
          can_delete: true,
          is_mandatory: false,
          announcement_author: actorName,
          dedupe_key: `announcement-${ann.announcement_id}`,
        });
        created += 1;
      }
      ann.notifications_sent = true;
      ann.notifications_created = created;
      ann.recipients_count = targetStudents.length;
    }

    this.persist();
    return ann;
  }

  getAdminWorkspaceData(adminUser: DbUser) {
    const staff = this.state.users
      .filter((u) => u.role === 'librarian' || u.role === 'admin')
      .map((u) => this.toStaffAccountRecord(u));
    const students = this.state.users
      .filter((u) => u.role === 'student')
      .map((u) => this.toLibrarianStudentDirectoryItem(u));
    const books = this.state.books.map((b) => this.toInventoryBookItem(b));
    const copies = this.state.copies.map((c) => this.toInventoryPhysicalCopy(c));
    const activeBorrowings = this.state.borrowings
      .filter((b) => b.status !== 'Returned')
      .map((b) => this.toActiveBorrowingDetail(b));
    const returnedHistoryCount = this.state.borrowings.filter(
      (b) => b.status === 'Returned'
    ).length;
    const overdueRecords = this.getOverdueRecords();
    const reservations = this.state.reservations.map((r) =>
      this.toLibrarianReservationItem(r)
    );
    const announcements = this.state.announcements.map((a) => ({
      announcement_id: a.announcement_id,
      title: a.title,
      content: a.content,
      category: a.category,
      priority: a.priority,
      target_type: a.target_type,
      target_value: a.target_value,
      target_label:
        a.target_type === 'all_students'
          ? 'All Students'
          : `${a.target_type}: ${a.target_value ?? ''}`,
      status: a.status,
      publish_at: a.publish_at,
      expires_at: a.expires_at,
      created_by: a.created_by,
      created_at: a.created_at,
      updated_at: a.updated_at,
      estimated_recipient_count: a.recipients_count,
      delivery_stats: a.notifications_sent
        ? {
            notifications_created: a.notifications_created,
            recipients_count: a.recipients_count,
            read_count: null,
          }
        : null,
    }));

    return {
      adminProfile: this.buildSessionPayload(adminUser).admin,
      staff,
      students,
      books,
      copies,
      categories: this.state.categories,
      subjects: this.state.subjects,
      branches: this.state.branches,
      activeBorrowings,
      returnedHistoryCount,
      overdueRecords,
      reservations,
      announcements,
      circulationPolicy: this.getCirculationPolicy(),
      librarySettings: this.state.librarySettings,
      roles: this.state.roles,
      auditLogs: this.state.auditLogs,
      userSummaries: this.state.users.map(sanitizeUserPublicSummary),
    };
  }

  recordAdminAudit(
    actor: DbUser,
    action: string,
    entityType: AdminAuditLogEntry['entity_type'],
    entityId: string,
    entityLabel: string,
    details: string,
    result: 'Success' | 'Blocked' | 'Failed' = 'Success'
  ) {
    this.addAuditLog({
      actor_id: actor.user_id,
      actor_name: actor.full_name,
      actor_role: actor.role === 'admin' ? 'admin' : 'librarian',
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      details,
      result,
    });
    this.persist();
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { verifyDatabaseModels } from './dbConfig.ts';
import { createSeedDatabaseState, reconcileAllBookCounts } from './seedData.ts';
import type {
  DbAnnouncement,
  DbBook,
  DbBookCopy,
  DbBorrowing,
  DbNotification,
  DbRecommendationFeedback,
  DbReservation,
  DbReview,
  DbSession,
  DbUser,
  LibraryDbState,
} from './types.ts';
import type {
  AdminAuditLogEntry,
  CatalogCategoryRecord,
  CatalogSubjectRecord,
  LibraryBranchRecord,
  LibraryPolicySettings,
  RolePermissionDefinition,
} from '../utils/adminManagement.ts';

function parseJsonOr<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class SqliteLibraryStore {
  readonly dbPath: string;
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA synchronous = NORMAL;
    `);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS db_meta (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('student', 'librarian', 'admin')),
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        code TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        firebase_uid TEXT,
        account_status TEXT NOT NULL DEFAULT 'Active',
        avatar_url TEXT,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        department TEXT,
        program TEXT,
        institution TEXT,
        academic_year TEXT,
        semester TEXT,
        mobile TEXT,
        interests_json TEXT,
        preferred_subjects_json TEXT,
        preferred_authors_json TEXT,
        restriction_reason TEXT,
        recommendation_preferences_json TEXT,
        notification_preferences_json TEXT,
        designation TEXT,
        branch TEXT,
        joining_date TEXT,
        invitation_pending INTEGER,
        invitation_sent_at TEXT,
        librarian_notification_preferences_json TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_users_code ON users (code COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users (firebase_uid);

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        device_label TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

      CREATE TABLE IF NOT EXISTS books (
        book_id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        isbn TEXT NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        authors TEXT NOT NULL,
        publisher TEXT NOT NULL,
        publication_year INTEGER NOT NULL,
        edition TEXT NOT NULL,
        language TEXT NOT NULL,
        pages INTEGER NOT NULL,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        keywords_json TEXT NOT NULL,
        format TEXT NOT NULL,
        catalog_format TEXT NOT NULL,
        cover_image TEXT NOT NULL,
        status TEXT NOT NULL,
        branch TEXT NOT NULL,
        floor TEXT NOT NULL,
        section TEXT NOT NULL,
        shelf TEXT NOT NULL,
        total_copies INTEGER NOT NULL,
        available_copies INTEGER NOT NULL,
        issued_copies INTEGER NOT NULL,
        reserved_copies INTEGER NOT NULL,
        unavailable_copies INTEGER NOT NULL,
        rating_average REAL NOT NULL,
        rating_count INTEGER NOT NULL,
        review_count INTEGER NOT NULL,
        borrow_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        added_by TEXT,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS book_copies (
        copy_id INTEGER PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
        accession_number TEXT NOT NULL UNIQUE,
        barcode TEXT,
        status TEXT NOT NULL,
        condition TEXT NOT NULL,
        branch TEXT NOT NULL,
        floor TEXT NOT NULL,
        section TEXT NOT NULL,
        shelf TEXT NOT NULL,
        added_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS borrowings (
        borrowing_id INTEGER PRIMARY KEY,
        transaction_code TEXT NOT NULL UNIQUE,
        student_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        copy_id INTEGER NOT NULL,
        issue_date TEXT NOT NULL,
        due_date TEXT NOT NULL,
        return_date TEXT,
        status TEXT NOT NULL,
        renewals_used INTEGER NOT NULL,
        progress_percent REAL NOT NULL,
        issued_by_staff_name TEXT,
        returned_condition TEXT,
        condition_notes TEXT,
        fine_amount REAL,
        fine_payment_status TEXT,
        fine_outstanding_balance REAL,
        last_reminder_at TEXT,
        reminder_history_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reservations (
        reservation_id INTEGER PRIMARY KEY,
        reservation_code TEXT NOT NULL UNIQUE,
        student_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        reservation_date TEXT NOT NULL,
        status TEXT NOT NULL,
        ready_date TEXT,
        pickup_deadline TEXT,
        assigned_copy_id INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reviews (
        rating_id INTEGER PRIMARY KEY,
        student_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        review TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recommendation_feedback (
        student_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        feedback TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (student_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        is_read INTEGER NOT NULL,
        related_entity_type TEXT NOT NULL,
        related_entity_id INTEGER,
        related_book_id INTEGER,
        related_book_title TEXT,
        action_label TEXT,
        action_url TEXT,
        created_at TEXT NOT NULL,
        read_at TEXT,
        can_delete INTEGER NOT NULL,
        is_mandatory INTEGER NOT NULL,
        announcement_author TEXT,
        dedupe_key TEXT
      );

      CREATE TABLE IF NOT EXISTS announcements (
        announcement_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_value TEXT,
        status TEXT NOT NULL,
        publish_at TEXT,
        expires_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        notifications_sent INTEGER NOT NULL,
        notifications_created INTEGER NOT NULL,
        recipients_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        category_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subjects (
        subject_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS branches (
        branch_id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        address TEXT NOT NULL,
        contact_info TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS roles (
        role_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS library_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        settings_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        log_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);
  }

  loadOrInitialize(legacyJsonPath?: string | null): LibraryDbState {
    const versionRow = this.db
      .prepare('SELECT value_json FROM db_meta WHERE key = ?')
      .get('version') as { value_json: string } | undefined;

    if (versionRow) {
      const loaded = this.readState();
      reconcileAllBookCounts(loaded);
      return loaded;
    }

    // Migrate from legacy JSON file if present on disk
    if (legacyJsonPath && fs.existsSync(legacyJsonPath)) {
      try {
        const raw = fs.readFileSync(legacyJsonPath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<LibraryDbState>;
        const defaults = createSeedDatabaseState();
        const verification = verifyDatabaseModels(parsed);
        const migrated: LibraryDbState = verification.valid
          ? (parsed as LibraryDbState)
          : ({
              ...defaults,
              ...parsed,
              nextIds: { ...defaults.nextIds, ...(parsed.nextIds ?? {}) },
              librarySettings: parsed.librarySettings ?? defaults.librarySettings,
            } as LibraryDbState);
        reconcileAllBookCounts(migrated);
        this.saveState(migrated);
        return migrated;
      } catch {
        // Fall through to fresh seed if legacy JSON was unreadable
      }
    }

    const seeded = createSeedDatabaseState();
    reconcileAllBookCounts(seeded);
    this.saveState(seeded);
    return seeded;
  }

  readState(): LibraryDbState {
    const defaults = createSeedDatabaseState();
    const versionRow = this.db
      .prepare('SELECT value_json FROM db_meta WHERE key = ?')
      .get('version') as { value_json: string } | undefined;
    const nextIdsRow = this.db
      .prepare('SELECT value_json FROM db_meta WHERE key = ?')
      .get('nextIds') as { value_json: string } | undefined;

    const users = (
      this.db.prepare('SELECT * FROM users ORDER BY user_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbUser => {
      const u: DbUser = {
        user_id: Number(row.user_id),
        role: String(row.role) as DbUser['role'],
        full_name: String(row.full_name),
        email: String(row.email),
        code: String(row.code),
        password_hash: String(row.password_hash),
        account_status: String(row.account_status) as DbUser['account_status'],
        avatar_url: row.avatar_url !== null && row.avatar_url !== undefined ? String(row.avatar_url) : null,
        must_change_password: Boolean(row.must_change_password),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      };
      if (row.firebase_uid !== null && row.firebase_uid !== undefined) {
        u.firebase_uid = String(row.firebase_uid);
      }
      if (row.department !== null && row.department !== undefined) u.department = String(row.department);
      if (row.program !== null && row.program !== undefined) u.program = String(row.program);
      if (row.institution !== null && row.institution !== undefined) u.institution = String(row.institution);
      if (row.academic_year !== null && row.academic_year !== undefined) u.academic_year = String(row.academic_year);
      if (row.semester !== null && row.semester !== undefined) u.semester = String(row.semester);
      if (row.mobile !== undefined) u.mobile = row.mobile !== null ? String(row.mobile) : null;
      if (row.interests_json !== null && row.interests_json !== undefined) {
        u.interests = parseJsonOr<string[]>(row.interests_json, []);
      }
      if (row.preferred_subjects_json !== null && row.preferred_subjects_json !== undefined) {
        u.preferred_subjects = parseJsonOr<string[]>(row.preferred_subjects_json, []);
      }
      if (row.preferred_authors_json !== null && row.preferred_authors_json !== undefined) {
        u.preferred_authors = parseJsonOr<string[]>(row.preferred_authors_json, []);
      }
      if (row.restriction_reason !== undefined) {
        u.restriction_reason =
          row.restriction_reason !== null ? String(row.restriction_reason) : null;
      }
      if (row.recommendation_preferences_json !== null && row.recommendation_preferences_json !== undefined) {
        u.recommendation_preferences = parseJsonOr(row.recommendation_preferences_json, undefined);
      }
      if (row.notification_preferences_json !== null && row.notification_preferences_json !== undefined) {
        u.notification_preferences = parseJsonOr(row.notification_preferences_json, undefined);
      }
      if (row.designation !== null && row.designation !== undefined) u.designation = String(row.designation);
      if (row.branch !== null && row.branch !== undefined) u.branch = String(row.branch);
      if (row.joining_date !== null && row.joining_date !== undefined) u.joining_date = String(row.joining_date);
      if (row.invitation_pending !== null && row.invitation_pending !== undefined) {
        u.invitation_pending = Boolean(row.invitation_pending);
      }
      if (row.invitation_sent_at !== undefined) {
        u.invitation_sent_at =
          row.invitation_sent_at !== null ? String(row.invitation_sent_at) : null;
      }
      if (
        row.librarian_notification_preferences_json !== null &&
        row.librarian_notification_preferences_json !== undefined
      ) {
        u.librarian_notification_preferences = parseJsonOr(
          row.librarian_notification_preferences_json,
          undefined
        );
      }
      return u;
    });

    const sessions = (
      this.db.prepare('SELECT * FROM sessions').all() as Array<Record<string, unknown>>
    ).map((row): DbSession => ({
      session_id: String(row.session_id),
      user_id: Number(row.user_id),
      role: String(row.role) as DbSession['role'],
      device_label: String(row.device_label),
      ip_address: String(row.ip_address),
      created_at: String(row.created_at),
      last_active_at: String(row.last_active_at),
      expires_at: String(row.expires_at),
    }));

    const books = (
      this.db.prepare('SELECT * FROM books ORDER BY book_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbBook => ({
      book_id: Number(row.book_id),
      slug: String(row.slug),
      isbn: String(row.isbn),
      title: String(row.title),
      subtitle: String(row.subtitle),
      authors: String(row.authors),
      publisher: String(row.publisher),
      publication_year: Number(row.publication_year),
      edition: String(row.edition),
      language: String(row.language) as DbBook['language'],
      pages: Number(row.pages),
      category: String(row.category),
      subject: String(row.subject),
      description: String(row.description),
      keywords: parseJsonOr<string[]>(row.keywords_json, []),
      format: String(row.format) as DbBook['format'],
      catalog_format: String(row.catalog_format) as DbBook['catalog_format'],
      cover_image: String(row.cover_image),
      status: String(row.status) as DbBook['status'],
      branch: String(row.branch),
      floor: String(row.floor),
      section: String(row.section),
      shelf: String(row.shelf),
      total_copies: Number(row.total_copies),
      available_copies: Number(row.available_copies),
      issued_copies: Number(row.issued_copies),
      reserved_copies: Number(row.reserved_copies),
      unavailable_copies: Number(row.unavailable_copies),
      rating_average: Number(row.rating_average),
      rating_count: Number(row.rating_count),
      review_count: Number(row.review_count),
      borrow_count: Number(row.borrow_count),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      added_by: row.added_by !== null && row.added_by !== undefined ? String(row.added_by) : null,
      updated_by: row.updated_by !== null && row.updated_by !== undefined ? String(row.updated_by) : null,
    }));

    const copies = (
      this.db.prepare('SELECT * FROM book_copies ORDER BY copy_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbBookCopy => ({
      copy_id: Number(row.copy_id),
      book_id: Number(row.book_id),
      accession_number: String(row.accession_number),
      barcode: row.barcode !== null && row.barcode !== undefined ? String(row.barcode) : null,
      status: String(row.status) as DbBookCopy['status'],
      condition: String(row.condition) as DbBookCopy['condition'],
      branch: String(row.branch),
      floor: String(row.floor),
      section: String(row.section),
      shelf: String(row.shelf),
      added_at: String(row.added_at),
      updated_at: String(row.updated_at),
    }));

    const borrowings = (
      this.db.prepare('SELECT * FROM borrowings ORDER BY borrowing_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbBorrowing => ({
      borrowing_id: Number(row.borrowing_id),
      transaction_code: String(row.transaction_code),
      student_id: Number(row.student_id),
      book_id: Number(row.book_id),
      copy_id: Number(row.copy_id),
      issue_date: String(row.issue_date),
      due_date: String(row.due_date),
      return_date: row.return_date !== null && row.return_date !== undefined ? String(row.return_date) : null,
      status: String(row.status) as DbBorrowing['status'],
      renewals_used: Number(row.renewals_used),
      progress_percent: Number(row.progress_percent),
      issued_by_staff_name:
        row.issued_by_staff_name !== null && row.issued_by_staff_name !== undefined
          ? String(row.issued_by_staff_name)
          : null,
      returned_condition:
        row.returned_condition !== null && row.returned_condition !== undefined
          ? (String(row.returned_condition) as DbBorrowing['returned_condition'])
          : null,
      condition_notes:
        row.condition_notes !== null && row.condition_notes !== undefined
          ? String(row.condition_notes)
          : null,
      fine_amount: row.fine_amount !== null && row.fine_amount !== undefined ? Number(row.fine_amount) : null,
      fine_payment_status:
        row.fine_payment_status !== null && row.fine_payment_status !== undefined
          ? (String(row.fine_payment_status) as DbBorrowing['fine_payment_status'])
          : null,
      fine_outstanding_balance:
        row.fine_outstanding_balance !== null && row.fine_outstanding_balance !== undefined
          ? Number(row.fine_outstanding_balance)
          : null,
      last_reminder_at:
        row.last_reminder_at !== null && row.last_reminder_at !== undefined
          ? String(row.last_reminder_at)
          : null,
      reminder_history: parseJsonOr(row.reminder_history_json, []),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const reservations = (
      this.db.prepare('SELECT * FROM reservations ORDER BY reservation_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbReservation => ({
      reservation_id: Number(row.reservation_id),
      reservation_code: String(row.reservation_code),
      student_id: Number(row.student_id),
      book_id: Number(row.book_id),
      reservation_date: String(row.reservation_date),
      status: String(row.status) as DbReservation['status'],
      ready_date: row.ready_date !== null && row.ready_date !== undefined ? String(row.ready_date) : null,
      pickup_deadline:
        row.pickup_deadline !== null && row.pickup_deadline !== undefined
          ? String(row.pickup_deadline)
          : null,
      assigned_copy_id:
        row.assigned_copy_id !== null && row.assigned_copy_id !== undefined
          ? Number(row.assigned_copy_id)
          : null,
      notes: row.notes !== null && row.notes !== undefined ? String(row.notes) : null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const reviews = (
      this.db.prepare('SELECT * FROM reviews ORDER BY rating_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbReview => ({
      rating_id: Number(row.rating_id),
      student_id: Number(row.student_id),
      book_id: Number(row.book_id),
      rating: Number(row.rating),
      review: String(row.review),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const recommendationFeedback = (
      this.db.prepare('SELECT * FROM recommendation_feedback').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbRecommendationFeedback => ({
      student_id: Number(row.student_id),
      book_id: Number(row.book_id),
      feedback: String(row.feedback) as DbRecommendationFeedback['feedback'],
      updated_at: String(row.updated_at),
    }));

    const notifications = (
      this.db.prepare('SELECT * FROM notifications ORDER BY notification_id DESC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbNotification => ({
      notification_id: Number(row.notification_id),
      user_id: Number(row.user_id),
      title: String(row.title),
      message: String(row.message),
      category: String(row.category) as DbNotification['category'],
      priority: String(row.priority) as DbNotification['priority'],
      is_read: Boolean(row.is_read),
      related_entity_type: String(row.related_entity_type) as DbNotification['related_entity_type'],
      related_entity_id:
        row.related_entity_id !== null && row.related_entity_id !== undefined
          ? Number(row.related_entity_id)
          : null,
      related_book_id:
        row.related_book_id !== null && row.related_book_id !== undefined
          ? Number(row.related_book_id)
          : null,
      related_book_title:
        row.related_book_title !== null && row.related_book_title !== undefined
          ? String(row.related_book_title)
          : null,
      action_label:
        row.action_label !== null && row.action_label !== undefined ? String(row.action_label) : null,
      action_url:
        row.action_url !== null && row.action_url !== undefined ? String(row.action_url) : null,
      created_at: String(row.created_at),
      read_at: row.read_at !== null && row.read_at !== undefined ? String(row.read_at) : null,
      can_delete: Boolean(row.can_delete),
      is_mandatory: Boolean(row.is_mandatory),
      announcement_author:
        row.announcement_author !== null && row.announcement_author !== undefined
          ? String(row.announcement_author)
          : null,
      dedupe_key:
        row.dedupe_key !== null && row.dedupe_key !== undefined ? String(row.dedupe_key) : null,
    }));

    const announcements = (
      this.db.prepare('SELECT * FROM announcements ORDER BY announcement_id DESC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): DbAnnouncement => ({
      announcement_id: Number(row.announcement_id),
      title: String(row.title),
      content: String(row.content),
      category: String(row.category),
      priority: String(row.priority) as DbAnnouncement['priority'],
      target_type: String(row.target_type) as DbAnnouncement['target_type'],
      target_value:
        row.target_value !== null && row.target_value !== undefined ? String(row.target_value) : null,
      status: String(row.status) as DbAnnouncement['status'],
      publish_at:
        row.publish_at !== null && row.publish_at !== undefined ? String(row.publish_at) : null,
      expires_at:
        row.expires_at !== null && row.expires_at !== undefined ? String(row.expires_at) : null,
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      notifications_sent: Boolean(row.notifications_sent),
      notifications_created: Number(row.notifications_created),
      recipients_count: Number(row.recipients_count),
    }));

    const categories = (
      this.db.prepare('SELECT * FROM categories ORDER BY category_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): CatalogCategoryRecord => ({
      category_id: Number(row.category_id),
      name: String(row.name),
      description: String(row.description),
      status: String(row.status) as CatalogCategoryRecord['status'],
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const subjects = (
      this.db.prepare('SELECT * FROM subjects ORDER BY subject_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): CatalogSubjectRecord => ({
      subject_id: Number(row.subject_id),
      name: String(row.name),
      code: String(row.code),
      description: String(row.description),
      status: String(row.status) as CatalogSubjectRecord['status'],
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const branches = (
      this.db.prepare('SELECT * FROM branches ORDER BY branch_id ASC').all() as Array<
        Record<string, unknown>
      >
    ).map((row): LibraryBranchRecord => ({
      branch_id: Number(row.branch_id),
      name: String(row.name),
      code: String(row.code),
      address: String(row.address),
      contact_info: String(row.contact_info),
      status: String(row.status) as LibraryBranchRecord['status'],
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));

    const roles = (
      this.db.prepare('SELECT * FROM roles').all() as Array<Record<string, unknown>>
    ).map((row): RolePermissionDefinition => ({
      role_key: String(row.role_key) as RolePermissionDefinition['role_key'],
      display_name: String(row.display_name),
      description: String(row.description),
      permissions: parseJsonOr(row.permissions_json, {} as RolePermissionDefinition['permissions']),
      updated_at: String(row.updated_at),
    }));

    const settingsRow = this.db
      .prepare('SELECT settings_json FROM library_settings WHERE id = 1')
      .get() as { settings_json: string } | undefined;

    const auditLogs = (
      this.db.prepare('SELECT payload_json FROM audit_logs ORDER BY seq ASC').all() as Array<{
        payload_json: string;
      }>
    )
      .map((row) => parseJsonOr<AdminAuditLogEntry | null>(row.payload_json, null))
      .filter((entry): entry is AdminAuditLogEntry => entry !== null);

    return {
      version: parseJsonOr<number>(versionRow?.value_json, defaults.version),
      nextIds: parseJsonOr<LibraryDbState['nextIds']>(nextIdsRow?.value_json, defaults.nextIds),
      users,
      sessions,
      books,
      copies,
      borrowings,
      reservations,
      reviews,
      recommendationFeedback,
      notifications,
      announcements,
      categories,
      subjects,
      branches,
      librarySettings: parseJsonOr<LibraryPolicySettings>(
        settingsRow?.settings_json,
        defaults.librarySettings
      ),
      roles: roles.length > 0 ? roles : defaults.roles,
      auditLogs,
    };
  }

  saveState(state: LibraryDbState): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec(`
        DELETE FROM sessions;
        DELETE FROM users;
        DELETE FROM book_copies;
        DELETE FROM books;
        DELETE FROM borrowings;
        DELETE FROM reservations;
        DELETE FROM reviews;
        DELETE FROM recommendation_feedback;
        DELETE FROM notifications;
        DELETE FROM announcements;
        DELETE FROM categories;
        DELETE FROM subjects;
        DELETE FROM branches;
        DELETE FROM roles;
        DELETE FROM library_settings;
        DELETE FROM audit_logs;
        DELETE FROM db_meta;
      `);

      const insertMeta = this.db.prepare('INSERT INTO db_meta (key, value_json) VALUES (?, ?)');
      insertMeta.run('version', JSON.stringify(state.version));
      insertMeta.run('nextIds', JSON.stringify(state.nextIds));

      const insertUser = this.db.prepare(`
        INSERT INTO users (
          user_id, role, full_name, email, code, password_hash, firebase_uid, account_status,
          avatar_url, must_change_password, created_at, updated_at, department, program,
          institution, academic_year, semester, mobile, interests_json, preferred_subjects_json,
          preferred_authors_json, restriction_reason, recommendation_preferences_json,
          notification_preferences_json, designation, branch, joining_date, invitation_pending,
          invitation_sent_at, librarian_notification_preferences_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      for (const u of state.users) {
        insertUser.run(
          u.user_id,
          u.role,
          u.full_name,
          u.email,
          u.code,
          u.password_hash,
          u.firebase_uid ?? null,
          u.account_status,
          u.avatar_url,
          u.must_change_password ? 1 : 0,
          u.created_at,
          u.updated_at,
          u.department ?? null,
          u.program ?? null,
          u.institution ?? null,
          u.academic_year ?? null,
          u.semester ?? null,
          u.mobile ?? null,
          u.interests ? JSON.stringify(u.interests) : null,
          u.preferred_subjects ? JSON.stringify(u.preferred_subjects) : null,
          u.preferred_authors ? JSON.stringify(u.preferred_authors) : null,
          u.restriction_reason ?? null,
          u.recommendation_preferences ? JSON.stringify(u.recommendation_preferences) : null,
          u.notification_preferences ? JSON.stringify(u.notification_preferences) : null,
          u.designation ?? null,
          u.branch ?? null,
          u.joining_date ?? null,
          u.invitation_pending === undefined ? null : u.invitation_pending ? 1 : 0,
          u.invitation_sent_at ?? null,
          u.librarian_notification_preferences
            ? JSON.stringify(u.librarian_notification_preferences)
            : null
        );
      }

      const insertSession = this.db.prepare(`
        INSERT INTO sessions (
          session_id, user_id, role, device_label, ip_address, created_at, last_active_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of state.sessions) {
        insertSession.run(
          s.session_id,
          s.user_id,
          s.role,
          s.device_label,
          s.ip_address,
          s.created_at,
          s.last_active_at,
          s.expires_at
        );
      }

      const insertBook = this.db.prepare(`
        INSERT INTO books (
          book_id, slug, isbn, title, subtitle, authors, publisher, publication_year, edition,
          language, pages, category, subject, description, keywords_json, format, catalog_format,
          cover_image, status, branch, floor, section, shelf, total_copies, available_copies,
          issued_copies, reserved_copies, unavailable_copies, rating_average, rating_count,
          review_count, borrow_count, created_at, updated_at, added_by, updated_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);
      for (const b of state.books) {
        insertBook.run(
          b.book_id,
          b.slug,
          b.isbn,
          b.title,
          b.subtitle,
          b.authors,
          b.publisher,
          b.publication_year,
          b.edition,
          b.language,
          b.pages,
          b.category,
          b.subject,
          b.description,
          JSON.stringify(b.keywords ?? []),
          b.format,
          b.catalog_format,
          b.cover_image,
          b.status,
          b.branch,
          b.floor,
          b.section,
          b.shelf,
          b.total_copies,
          b.available_copies,
          b.issued_copies,
          b.reserved_copies,
          b.unavailable_copies,
          b.rating_average,
          b.rating_count,
          b.review_count,
          b.borrow_count,
          b.created_at,
          b.updated_at,
          b.added_by ?? null,
          b.updated_by ?? null
        );
      }

      const insertCopy = this.db.prepare(`
        INSERT INTO book_copies (
          copy_id, book_id, accession_number, barcode, status, condition, branch, floor, section, shelf, added_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of state.copies) {
        insertCopy.run(
          c.copy_id,
          c.book_id,
          c.accession_number,
          c.barcode ?? null,
          c.status,
          c.condition,
          c.branch,
          c.floor,
          c.section,
          c.shelf,
          c.added_at,
          c.updated_at
        );
      }

      const insertBorrowing = this.db.prepare(`
        INSERT INTO borrowings (
          borrowing_id, transaction_code, student_id, book_id, copy_id, issue_date, due_date,
          return_date, status, renewals_used, progress_percent, issued_by_staff_name,
          returned_condition, condition_notes, fine_amount, fine_payment_status,
          fine_outstanding_balance, last_reminder_at, reminder_history_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const br of state.borrowings) {
        insertBorrowing.run(
          br.borrowing_id,
          br.transaction_code,
          br.student_id,
          br.book_id,
          br.copy_id,
          br.issue_date,
          br.due_date,
          br.return_date ?? null,
          br.status,
          br.renewals_used,
          br.progress_percent,
          br.issued_by_staff_name ?? null,
          br.returned_condition ?? null,
          br.condition_notes ?? null,
          br.fine_amount ?? null,
          br.fine_payment_status ?? null,
          br.fine_outstanding_balance ?? null,
          br.last_reminder_at ?? null,
          JSON.stringify(br.reminder_history ?? []),
          br.created_at,
          br.updated_at
        );
      }

      const insertReservation = this.db.prepare(`
        INSERT INTO reservations (
          reservation_id, reservation_code, student_id, book_id, reservation_date, status,
          ready_date, pickup_deadline, assigned_copy_id, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const resv of state.reservations) {
        insertReservation.run(
          resv.reservation_id,
          resv.reservation_code,
          resv.student_id,
          resv.book_id,
          resv.reservation_date,
          resv.status,
          resv.ready_date ?? null,
          resv.pickup_deadline ?? null,
          resv.assigned_copy_id ?? null,
          resv.notes ?? null,
          resv.created_at,
          resv.updated_at
        );
      }

      const insertReview = this.db.prepare(`
        INSERT INTO reviews (rating_id, student_id, book_id, rating, review, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const rev of state.reviews) {
        insertReview.run(
          rev.rating_id,
          rev.student_id,
          rev.book_id,
          rev.rating,
          rev.review,
          rev.created_at,
          rev.updated_at
        );
      }

      const insertFeedback = this.db.prepare(`
        INSERT INTO recommendation_feedback (student_id, book_id, feedback, updated_at)
        VALUES (?, ?, ?, ?)
      `);
      for (const fb of state.recommendationFeedback) {
        insertFeedback.run(fb.student_id, fb.book_id, fb.feedback, fb.updated_at);
      }

      const insertNotification = this.db.prepare(`
        INSERT INTO notifications (
          notification_id, user_id, title, message, category, priority, is_read,
          related_entity_type, related_entity_id, related_book_id, related_book_title,
          action_label, action_url, created_at, read_at, can_delete, is_mandatory,
          announcement_author, dedupe_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const n of state.notifications) {
        insertNotification.run(
          n.notification_id,
          n.user_id,
          n.title,
          n.message,
          n.category,
          n.priority,
          n.is_read ? 1 : 0,
          n.related_entity_type,
          n.related_entity_id ?? null,
          n.related_book_id ?? null,
          n.related_book_title ?? null,
          n.action_label ?? null,
          n.action_url ?? null,
          n.created_at,
          n.read_at ?? null,
          n.can_delete ? 1 : 0,
          n.is_mandatory ? 1 : 0,
          n.announcement_author ?? null,
          n.dedupe_key ?? null
        );
      }

      const insertAnnouncement = this.db.prepare(`
        INSERT INTO announcements (
          announcement_id, title, content, category, priority, target_type, target_value,
          status, publish_at, expires_at, created_by, created_at, updated_at,
          notifications_sent, notifications_created, recipients_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const a of state.announcements) {
        insertAnnouncement.run(
          a.announcement_id,
          a.title,
          a.content,
          a.category,
          a.priority,
          a.target_type,
          a.target_value ?? null,
          a.status,
          a.publish_at ?? null,
          a.expires_at ?? null,
          a.created_by,
          a.created_at,
          a.updated_at,
          a.notifications_sent ? 1 : 0,
          a.notifications_created,
          a.recipients_count
        );
      }

      const insertCategory = this.db.prepare(`
        INSERT INTO categories (category_id, name, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const cat of state.categories) {
        insertCategory.run(
          cat.category_id,
          cat.name,
          cat.description,
          cat.status,
          cat.created_at,
          cat.updated_at
        );
      }

      const insertSubject = this.db.prepare(`
        INSERT INTO subjects (subject_id, name, code, description, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sub of state.subjects) {
        insertSubject.run(
          sub.subject_id,
          sub.name,
          sub.code,
          sub.description,
          sub.status,
          sub.created_at,
          sub.updated_at
        );
      }

      const insertBranch = this.db.prepare(`
        INSERT INTO branches (branch_id, name, code, address, contact_info, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const brn of state.branches) {
        insertBranch.run(
          brn.branch_id,
          brn.name,
          brn.code,
          brn.address,
          brn.contact_info,
          brn.status,
          brn.created_at,
          brn.updated_at
        );
      }

      const insertRole = this.db.prepare(`
        INSERT INTO roles (role_key, display_name, description, permissions_json, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const role of state.roles) {
        insertRole.run(
          role.role_key,
          role.display_name,
          role.description,
          JSON.stringify(role.permissions),
          role.updated_at
        );
      }

      this.db
        .prepare('INSERT INTO library_settings (id, settings_json) VALUES (1, ?)')
        .run(JSON.stringify(state.librarySettings));

      const insertAudit = this.db.prepare(`
        INSERT INTO audit_logs (log_id, timestamp, payload_json) VALUES (?, ?, ?)
      `);
      for (const log of state.auditLogs) {
        insertAudit.run(log.log_id, log.timestamp, JSON.stringify(log));
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    this.db.close();
  }
}

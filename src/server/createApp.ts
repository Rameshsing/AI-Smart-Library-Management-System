import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { HttpError, LibraryService } from './libraryService.ts';
import {
  clearSessionCookie,
  hashPassword,
  parseCookieHeader,
  sanitizePlainText,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyPassword,
  verifySignedSessionToken,
} from './security.ts';
import { reconcileBookCounts } from './seedData.ts';
import type { DbAnnouncement, DbSession, DbUser, UserRole } from './types.ts';
import type { PermissionKey } from '../utils/adminManagement.ts';
import type { CopyCondition, CopyStatus } from '../utils/librarianInventory.ts';
import type { ReturnCopyCondition } from '../utils/librarianCirculation.ts';
import type { RecommendationFeedbackValue } from '../utils/recommendationsPage.ts';
import type {
  ExpectedReturnsPayload,
  InventoryOverviewPayload,
  LibrarianAlertsPayload,
  LibrarianAnalyticsPayload,
  LibrarianAnnouncementRecord,
  LibrarianProfile,
  LibrarianReservationsOverviewPayload,
  LibrarianReservationStatus,
  LibrarianSummaryPayload,
  RecentBorrowingsPayload,
  StudentActivityPayload,
} from '../utils/librarianDashboard.ts';
import type { ReportsSourceDataset } from '../utils/librarianReports.ts';

interface AuthenticatedRequest extends Request {
  currentUser?: DbUser;
  currentSession?: DbSession;
}

function getOptionalSession(
  service: LibraryService,
  req: AuthenticatedRequest
): { session: DbSession; user: DbUser } | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sessionId = verifySignedSessionToken(cookies[SESSION_COOKIE_NAME]);
  const found = service.getSessionUser(sessionId);
  if (found) {
    req.currentUser = found.user;
    req.currentSession = found.session;
  }
  return found;
}

export function createLibraryApp(service: LibraryService) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  const requireAuth = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const found = getOptionalSession(service, req);
    if (!found) {
      next(new HttpError(401, 'Authentication required. Please log in to continue.', 'UNAUTHORIZED'));
      return;
    }
    next();
  };

  const requireRole =
    (roles: UserRole[], requiredPerm?: PermissionKey) =>
    (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
      const user = req.currentUser;
      if (!user) {
        next(new HttpError(401, 'Authentication required.', 'UNAUTHORIZED'));
        return;
      }
      if (!roles.includes(user.role)) {
        next(
          new HttpError(
            403,
            `Access denied: role "${user.role}" cannot access this resource.`,
            'FORBIDDEN'
          )
        );
        return;
      }
      if (requiredPerm && !service.hasPermission(user, requiredPerm)) {
        next(
          new HttpError(
            403,
            `Permission "${requiredPerm}" is required for this operation.`,
            'MISSING_PERMISSION'
          )
        );
        return;
      }
      next();
    };

  const asyncHandler =
    (fn: (req: AuthenticatedRequest, res: Response) => Promise<void> | void) =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res)).catch(next);
    };

  // ==================== HEALTH & PUBLIC ====================

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ai-smart-library-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/public/overview', (_req, res) => {
    res.json(service.getPublicOverview());
  });

  // ==================== AUTHENTICATION ====================

  app.post(
    '/api/auth/login',
    asyncHandler((req, res) => {
      const { identifier, password, requested_role, remember_me } = req.body ?? {};
      const user = service.authenticateUser(
        String(identifier ?? ''),
        String(password ?? ''),
        requested_role ? (String(requested_role) as UserRole) : undefined
      );
      const userAgent = String(req.headers['user-agent'] ?? 'Web Browser').slice(0, 60);
      const { session, maxAgeMs } = service.createSession(
        user,
        userAgent,
        req.ip || '127.0.0.1',
        Boolean(remember_me)
      );
      setSessionCookie(req, res, session.session_id, maxAgeMs);
      res.json(service.buildSessionPayload(user));
    })
  );

  app.post(
    '/api/auth/register',
    asyncHandler((req, res) => {
      const body = req.body ?? {};
      const user = service.registerStudent({
        full_name: String(body.full_name ?? ''),
        email: String(body.email ?? ''),
        student_id: String(body.student_id ?? body.student_code ?? ''),
        department: String(body.department ?? 'Computer Science'),
        academic_year: String(body.academic_year ?? '1st Year'),
        password: String(body.password ?? ''),
        interests: Array.isArray(body.interests) ? body.interests.map(String) : [],
      });
      res.status(201).json({
        registered: true,
        user_id: user.user_id,
        student_code: user.code,
        email: user.email,
        message: 'Student registration successful. You can now sign in with your credentials.',
      });
    })
  );

  app.post('/api/auth/forgot-password', (req, res) => {
    res.json({
      sent: true,
      message: `If an account exists for ${String(req.body?.email ?? 'that email')}, reset instructions have been prepared by your institution administrator.`,
    });
  });

  const handleSessionMe = (req: AuthenticatedRequest, res: Response) => {
    const found = getOptionalSession(service, req);
    if (!found) {
      res.status(401).json({
        authenticated: false,
        message: 'No active authenticated session.',
      });
      return;
    }
    res.json(service.buildSessionPayload(found.user));
  };

  app.get('/api/auth/me', handleSessionMe);
  app.get('/api/auth/session', handleSessionMe);

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const found = getOptionalSession(service, req);
    if (found) {
      service.destroySession(found.session.session_id);
    }
    clearSessionCookie(req, res);
    res.json({ authenticated: false, logged_out: true });
  });

  // ==================== SHARED CATALOG & REVIEWS ====================

  app.get('/api/books', (req: AuthenticatedRequest, res) => {
    const query = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])
    );
    res.json(service.queryCatalogBooks(query));
  });

  app.get(
    '/api/books/:identifier',
    asyncHandler((req, res) => {
      const found = getOptionalSession(service, req);
      const details = service.getBookDetails(String(req.params.identifier), found?.user ?? null);
      res.json(details);
    })
  );

  const handleUpsertReview = asyncHandler((req, res) => {
    const user = req.currentUser!;
    const bookId = Number.parseInt(String(req.params.id), 10);
    const { rating, review } = req.body ?? {};
    const result = service.upsertReview(user, bookId, Number(rating), String(review ?? ''));
    res.json(result);
  });

  app.post('/api/books/:id/reviews', requireAuth, requireRole(['student']), handleUpsertReview);
  app.put('/api/books/:id/reviews', requireAuth, requireRole(['student']), handleUpsertReview);

  // ==================== STUDENT BORROWING, RESERVATIONS & PROFILE ====================

  app.post(
    '/api/borrowings',
    requireAuth,
    requireRole(['student'], 'borrow_reserve'),
    asyncHandler(async (req, res) => {
      const user = req.currentUser!;
      const bookId = Number.parseInt(String(req.body?.book_id), 10);
      if (!Number.isFinite(bookId)) {
        throw new HttpError(400, 'Valid book_id is required.', 'INVALID_INPUT');
      }
      const result = await service.issueBookTransaction({
        studentId: user.user_id,
        bookId,
        actorName: `${user.full_name} (Self-Checkout)`,
      });
      res.status(201).json(result);
    })
  );

  app.get('/api/student/borrowings', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    res.json(service.getStudentBorrowingsList(req.currentUser!));
  });

  app.post(
    '/api/student/borrowings/:id/renew',
    requireAuth,
    requireRole(['student']),
    asyncHandler(async (req, res) => {
      const borrowingId = Number.parseInt(String(req.params.id), 10);
      const result = await service.renewBorrowing(req.currentUser!.user_id, borrowingId);
      res.json(result);
    })
  );

  app.post(
    '/api/reservations',
    requireAuth,
    requireRole(['student'], 'borrow_reserve'),
    asyncHandler(async (req, res) => {
      const bookId = Number.parseInt(String(req.body?.book_id), 10);
      if (!Number.isFinite(bookId)) {
        throw new HttpError(400, 'Valid book_id is required.', 'INVALID_INPUT');
      }
      const result = await service.createReservation(req.currentUser!.user_id, bookId);
      res.status(201).json(result);
    })
  );

  app.post(
    '/api/reservations/:id/cancel',
    requireAuth,
    requireRole(['student']),
    asyncHandler(async (req, res) => {
      const resId = Number.parseInt(String(req.params.id), 10);
      const result = await service.cancelReservation(resId, req.currentUser!, 'Cancelled by student');
      res.json(result);
    })
  );

  app.delete(
    '/api/reservations/:id',
    requireAuth,
    requireRole(['student']),
    asyncHandler(async (req, res) => {
      const resId = Number.parseInt(String(req.params.id), 10);
      const result = await service.cancelReservation(resId, req.currentUser!, 'Cancelled by student');
      res.json(result);
    })
  );

  app.post(
    '/api/reservations/:id/fulfill',
    requireAuth,
    requireRole(['student']),
    asyncHandler(async (req, res) => {
      const resId = Number.parseInt(String(req.params.id), 10);
      const existing = service.state.reservations.find(
        (r) => r.reservation_id === resId && r.student_id === req.currentUser!.user_id
      );
      if (!existing) {
        throw new HttpError(404, 'Reservation not found.', 'RESERVATION_NOT_FOUND');
      }
      const result = await service.fulfillReservation(
        resId,
        `${req.currentUser!.full_name} (Pickup Checkout)`
      );
      res.json(result);
    })
  );

  app.get('/api/student/dashboard', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    res.json(service.getStudentDashboard(req.currentUser!));
  });

  app.get('/api/recommendations', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const query = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])
    );
    res.json(service.getStudentRecommendations(req.currentUser!, query));
  });

  app.post('/api/recommendations/feedback', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const bookId = Number.parseInt(String(req.body?.book_id), 10);
    const feedback = String(req.body?.feedback ?? '') as RecommendationFeedbackValue;
    if (!Number.isFinite(bookId) || !['useful', 'not_useful', 'not_interested'].includes(feedback)) {
      throw new HttpError(400, 'Invalid feedback payload.', 'INVALID_INPUT');
    }
    res.json(service.saveRecommendationFeedback(req.currentUser!.user_id, bookId, feedback));
  });

  app.get('/api/student/reading-history', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const query = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])
    );
    res.json(service.getStudentReadingHistory(req.currentUser!, query));
  });

  app.get('/api/student/reservations', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const query = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])
    );
    res.json(service.getStudentReservationsPayload(req.currentUser!, query));
  });

  app.get('/api/student/notifications', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const query = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, typeof v === 'string' ? v : undefined])
    );
    res.json(service.getStudentNotificationsPayload(req.currentUser!, query));
  });

  app.get('/api/student/notifications/unread-count', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const unreadCount = service.state.notifications.filter(
      (n) => n.user_id === req.currentUser!.user_id && !n.is_read
    ).length;
    res.json({ unread_count: unreadCount });
  });

  app.patch('/api/notifications/:id/read', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const notifId = Number.parseInt(String(req.params.id), 10);
    const notif = service.state.notifications.find(
      (n) => n.notification_id === notifId && n.user_id === req.currentUser!.user_id
    );
    if (!notif) {
      throw new HttpError(404, 'Notification not found.', 'NOT_FOUND');
    }
    notif.is_read = true;
    notif.read_at = new Date().toISOString();
    service.persist();
    res.json({ ok: true, notification_id: notifId });
  });

  app.patch('/api/notifications/mark-all-read', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const nowIso = new Date().toISOString();
    for (const n of service.state.notifications) {
      if (n.user_id === req.currentUser!.user_id && !n.is_read) {
        n.is_read = true;
        n.read_at = nowIso;
      }
    }
    service.persist();
    res.json({ ok: true });
  });

  app.delete('/api/notifications/:id', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const notifId = Number.parseInt(String(req.params.id), 10);
    const before = service.state.notifications.length;
    service.state.notifications = service.state.notifications.filter(
      (n) => !(n.notification_id === notifId && n.user_id === req.currentUser!.user_id)
    );
    if (service.state.notifications.length === before) {
      throw new HttpError(404, 'Notification not found.', 'NOT_FOUND');
    }
    service.persist();
    res.json({ ok: true });
  });

  app.get('/api/student/notification-preferences', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    res.json(service.getStudentProfilePayload(req.currentUser!).notification_preferences);
  });

  app.put('/api/student/notification-preferences', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    const currentPrefs = service.getStudentProfilePayload(user).notification_preferences;
    const nextPrefs = {
      ...currentPrefs,
      categories: Array.isArray(req.body?.categories)
        ? req.body.categories
        : currentPrefs.categories,
      reminder_timings: Array.isArray(req.body?.reminder_timings)
        ? req.body.reminder_timings
        : currentPrefs.reminder_timings,
    };
    user.notification_preferences = nextPrefs;
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json(nextPrefs);
  });

  app.get('/api/student/profile', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    res.json(service.getStudentProfilePayload(req.currentUser!));
  });

  app.put('/api/student/profile', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    const body = req.body ?? {};
    if (body.full_name) user.full_name = sanitizePlainText(String(body.full_name));
    if (body.department) user.department = sanitizePlainText(String(body.department));
    if (body.course_department) user.department = sanitizePlainText(String(body.course_department));
    if (body.course) user.program = sanitizePlainText(String(body.course));
    if (body.academic_year) user.academic_year = sanitizePlainText(String(body.academic_year));
    if (body.semester) user.semester = sanitizePlainText(String(body.semester));
    if (typeof body.mobile === 'string') user.mobile = sanitizePlainText(body.mobile) || null;
    if (typeof body.mobile_number === 'string') {
      user.mobile = sanitizePlainText(body.mobile_number) || null;
    }
    if (typeof body.avatar_url === 'string') {
      user.avatar_url = sanitizePlainText(body.avatar_url) || null;
    }
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json(service.getStudentProfilePayload(user));
  });

  app.put('/api/student/interests', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (!Array.isArray(req.body?.interests)) {
      throw new HttpError(400, 'Interests array is required.', 'INVALID_INPUT');
    }
    user.interests = req.body.interests.map((x: unknown) => sanitizePlainText(String(x))).filter(Boolean);
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({ interests: user.interests });
  });

  app.put('/api/student/subjects', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (!Array.isArray(req.body?.preferred_subjects)) {
      throw new HttpError(400, 'Preferred subjects array is required.', 'INVALID_INPUT');
    }
    user.preferred_subjects = req.body.preferred_subjects
      .map((x: unknown) => sanitizePlainText(String(x)))
      .filter(Boolean);
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({ preferred_subjects: user.preferred_subjects });
  });

  app.put('/api/student/recommendation-preferences', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    user.recommendation_preferences = {
      ...(user.recommendation_preferences ?? {}),
      ...(req.body ?? {}),
    };
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json(service.getStudentProfilePayload(user).recommendation_preferences);
  });

  app.post('/api/student/change-password', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    const current = String(req.body?.current_password ?? '');
    const nextPass = String(req.body?.new_password ?? '');
    if (!verifyPassword(current, user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    if (nextPass.length < 8) {
      throw new HttpError(400, 'New password must be at least 8 characters.', 'WEAK_PASSWORD');
    }
    user.password_hash = hashPassword(nextPass);
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  app.delete('/api/student/sessions/:id', requireAuth, requireRole(['student']), (req: AuthenticatedRequest, res) => {
    const sid = String(req.params.id);
    service.state.sessions = service.state.sessions.filter(
      (s) => !(s.session_id === sid && s.user_id === req.currentUser!.user_id)
    );
    service.persist();
    res.json({ ok: true });
  });

  // ==================== LIBRARIAN ROUTES ====================

  const requireStaff = [requireAuth, requireRole(['librarian', 'admin'])] as const;

  app.get('/api/librarian/dashboard/summary', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const activeBooks = service.state.books.filter((b) => b.status === 'Active');
    const overdue = service.getOverdueRecords();
    const activeLoans = service.state.borrowings.filter((b) => b.status !== 'Returned');
    const pendingRes = service.state.reservations.filter(
      (r) => r.status === 'Waiting' || r.status === 'Ready for Pickup'
    );
    const sessionUser = req.currentUser!;
    const sessionPayload = service.buildSessionPayload(sessionUser);
    const librarianProfile: LibrarianProfile = sessionPayload.librarian ?? {
      librarian_id: sessionUser.user_id,
      user_id: sessionUser.user_id,
      staff_code: sessionUser.code,
      full_name: sessionUser.full_name,
      email: sessionUser.email,
      department_title: sessionUser.designation ?? 'Library Administrator',
      role: 'librarian',
      account_status: sessionUser.account_status === 'Active' ? 'Active' : 'Suspended',
      avatar_url: sessionUser.avatar_url,
      permissions: {
        can_manage_inventory: true,
        can_issue_books: true,
        can_return_books: true,
        can_manage_reservations: true,
        can_view_student_records: true,
        can_view_new_registrations: true,
        can_manage_announcements: true,
        can_view_reports: true,
      },
    };

    const payload: LibrarianSummaryPayload = {
      is_prototype_sample: false,
      librarian: librarianProfile,
      metrics: {
        total_books_unique_titles: activeBooks.length,
        total_book_copies: activeBooks.reduce((s, b) => s + b.total_copies, 0),
        available_copies: activeBooks.reduce((s, b) => s + b.available_copies, 0),
        currently_issued: activeLoans.length,
        pending_reservations: pendingRes.length,
        overdue_books: overdue.length,
        previous_period_delta: null,
      },
      supported_borrowing_statuses: ['Issued', 'Returned', 'Overdue', 'Renewal Pending'],
    };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/recent-borrowings', ...requireStaff, (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '8'), 10) || 8));
    const totalCount = service.state.borrowings.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const safePage = Math.min(page, totalPages);

    const items = service.state.borrowings
      .slice((safePage - 1) * limit, safePage * limit)
      .map((b) => {
        const detail = service.toActiveBorrowingDetail(b);
        const book = service.state.books.find((x) => x.book_id === detail.book_id);
        const copy = service.state.copies.find((x) => x.copy_id === detail.copy_id);
        return {
          borrowing_id: detail.borrowing_id,
          transaction_code: detail.transaction_code,
          student_id: detail.student_id,
          student_name: detail.student_name,
          student_code: detail.student_code,
          book_id: detail.book_id,
          book_slug: book?.slug ?? String(detail.book_id),
          book_title: detail.book_title,
          copy_id: detail.copy_id,
          accession_number: detail.accession_number,
          shelf_location:
            copy ? `${copy.floor} · Row ${copy.shelf}` : book ? `${book.floor} · Row ${book.shelf}` : 'Main Stacks',
          issue_date: detail.issue_date,
          due_date: detail.due_date,
          return_date: detail.return_date,
          status: detail.status,
        };
      });

    const payload: RecentBorrowingsPayload = {
      items,
      page: safePage,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
    };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/expected-returns', ...requireStaff, (_req, res) => {
    const active = service.state.borrowings
      .filter((b) => b.status !== 'Returned')
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .map((b) => {
        const detail = service.toActiveBorrowingDetail(b);
        const book = service.state.books.find((x) => x.book_id === detail.book_id);
        return {
          borrowing_id: detail.borrowing_id,
          book_id: detail.book_id,
          book_slug: book?.slug ?? String(detail.book_id),
          book_title: detail.book_title,
          student_name: detail.student_name,
          student_code: detail.student_code,
          issue_date: detail.issue_date,
          due_date: detail.due_date,
          status: (detail.status === 'Returned' ? 'Issued' : detail.status) as
            | 'Issued'
            | 'Overdue'
            | 'Renewal Pending',
        };
      });

    const payload: ExpectedReturnsPayload = {
      items: active.slice(0, 8),
      total_upcoming_or_overdue: active.length,
    };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/reservations', ...requireStaff, (_req, res) => {
    const mapped = service.state.reservations.map((r) => service.toLibrarianReservationItem(r));
    const mapDashStatus = (item: (typeof mapped)[number]): LibrarianReservationStatus => {
      if (item.status === 'Ready for Pickup') {
        if (item.pickup_deadline) {
          const msLeft = new Date(item.pickup_deadline).getTime() - Date.now();
          if (msLeft > 0 && msLeft <= 12 * 3_600_000) return 'Expiring Soon';
        }
        return 'Ready for Pickup';
      }
      if (item.status === 'Completed') return 'Fulfilled';
      return 'Waiting';
    };

    const activeItems = mapped.filter(
      (r) => r.status === 'Waiting' || r.status === 'Ready for Pickup'
    );
    const items = (activeItems.length > 0 ? activeItems : mapped).slice(0, 6).map((item) => {
      const book = service.state.books.find((x) => x.book_id === item.book_id);
      return {
        reservation_id: item.reservation_id,
        book_id: item.book_id,
        book_slug: book?.slug ?? String(item.book_id),
        book_title: item.book_title,
        student_name: item.student_name,
        student_code: item.student_code,
        reservation_date: item.reservation_date.slice(0, 10),
        queue_position: item.queue_position,
        status: mapDashStatus(item),
      };
    });

    const payload: LibrarianReservationsOverviewPayload = {
      counts: {
        active_waiting: mapped.filter((r) => r.status === 'Waiting').length,
        ready_for_pickup: mapped.filter((r) => r.status === 'Ready for Pickup').length,
        expiring_soon: mapped.filter((r) => mapDashStatus(r) === 'Expiring Soon').length,
        recently_fulfilled: mapped.filter((r) => r.status === 'Completed').length,
      },
      supports_queue_position: true,
      items,
    };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/inventory-overview', ...requireStaff, (_req, res) => {
    const activeBooks = service.state.books.filter((b) => b.status === 'Active');
    const lowStockThreshold = 1;
    const cutoffMs = Date.now() - 30 * 86_400_000;
    const items = activeBooks.slice(0, 8).map((b) => ({
      book_id: b.book_id,
      slug: b.slug,
      cover_image: b.cover_image,
      title: b.title,
      author: b.authors,
      isbn: b.isbn,
      category: b.category,
      total_copies: b.total_copies,
      available_copies: b.available_copies,
      is_recently_added: new Date(b.created_at).getTime() >= cutoffMs,
    }));

    const payload: InventoryOverviewPayload = {
      configured_low_stock_threshold: lowStockThreshold,
      counts: {
        recently_added: activeBooks.filter((b) => new Date(b.created_at).getTime() >= cutoffMs).length,
        low_copy_titles: activeBooks.filter(
          (b) => b.available_copies > 0 && b.available_copies <= lowStockThreshold
        ).length,
        unavailable_titles: activeBooks.filter((b) => b.available_copies <= 0).length,
        available_titles: activeBooks.filter((b) => b.available_copies > 0).length,
      },
      items,
    };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/alerts', ...requireStaff, (_req, res) => {
    const overdueList = service.getOverdueRecords();
    const lowStockCount = service.state.books.filter(
      (b) => b.status === 'Active' && b.available_copies === 0
    ).length;
    const readyCount = service.state.reservations.filter(
      (r) => r.status === 'Ready for Pickup'
    ).length;
    const today = new Date().toISOString().slice(0, 10);
    const dueTodayCount = service.state.borrowings.filter(
      (b) => b.status !== 'Returned' && b.due_date === today
    ).length;
    const nowIso = new Date().toISOString();

    const items: LibrarianAlertsPayload['items'] = [];
    if (overdueList.length > 0) {
      items.push({
        alert_id: 'alert-overdue',
        category: 'overdue',
        title: `${overdueList.length} Overdue Borrowing${overdueList.length === 1 ? '' : 's'}`,
        description: 'Follow up with students or dispatch reminder notices.',
        priority: 'Urgent',
        timestamp: nowIso,
        action_label: 'Open Overdue Books',
        action_route: 'librarian-overdue',
      });
    }
    if (dueTodayCount > 0) {
      items.push({
        alert_id: 'alert-due-today',
        category: 'due_today',
        title: `${dueTodayCount} Book${dueTodayCount === 1 ? '' : 's'} Due Today`,
        description: 'Scheduled for circulation desk check-in today.',
        priority: 'High',
        timestamp: nowIso,
        action_label: 'Process Returns',
        action_route: 'librarian-return-books',
      });
    }
    if (readyCount > 0) {
      items.push({
        alert_id: 'alert-res-ready',
        category: 'reservation_ready',
        title: `${readyCount} Hold${readyCount === 1 ? '' : 's'} Ready for Pickup`,
        description: 'Monitor pickup deadlines at the circulation desk.',
        priority: 'High',
        timestamp: nowIso,
        action_label: 'Manage Reservations',
        action_route: 'librarian-reservations',
      });
    }
    if (lowStockCount > 0) {
      items.push({
        alert_id: 'alert-low-stock',
        category: 'low_inventory',
        title: `${lowStockCount} Title${lowStockCount === 1 ? '' : 's'} Fully Checked Out`,
        description: 'Zero shelf copies currently available; check reservation queues.',
        priority: 'Normal',
        timestamp: nowIso,
        action_label: 'Inspect Inventory',
        action_route: 'librarian-inventory',
      });
    }

    const payload: LibrarianAlertsPayload = { items };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/announcements', ...requireStaff, (_req, res) => {
    const items: LibrarianAnnouncementRecord[] = service.state.announcements
      .filter((a) => a.status !== 'Archived')
      .slice(0, 4)
      .map((a) => ({
        announcement_id: a.announcement_id,
        title: a.title,
        description: a.content,
        published_at: (a.publish_at ?? a.created_at).slice(0, 10),
        author_department: a.created_by || 'Chief Librarian Office',
        status:
          a.status === 'Published'
            ? a.priority === 'Important' || a.priority === 'Urgent'
              ? 'Attention Required'
              : 'Published'
            : a.status === 'Scheduled'
              ? 'Scheduled'
              : 'Draft',
      }));
    res.json({ items });
  });

  app.get('/api/librarian/dashboard/student-activity', ...requireStaff, (_req, res) => {
    const items: StudentActivityPayload['items'] = [];
    for (const b of service.state.borrowings.slice(0, 4)) {
      const student = service.state.users.find((u) => u.user_id === b.student_id);
      const book = service.state.books.find((bk) => bk.book_id === b.book_id);
      if (!student || !book) continue;
      items.push({
        activity_id: `act-bor-${b.borrowing_id}`,
        type: b.status === 'Returned' ? 'return' : 'borrowing',
        student_name: student.full_name,
        student_code: student.code,
        book_title: book.title,
        summary:
          b.status === 'Returned'
            ? `Returned "${book.title}" (${b.transaction_code}).`
            : `Checked out "${book.title}" (due ${b.due_date}).`,
        timestamp: b.return_date ?? b.issue_date,
      });
    }
    for (const r of service.state.reservations.slice(0, 2)) {
      const student = service.state.users.find((u) => u.user_id === r.student_id);
      const book = service.state.books.find((bk) => bk.book_id === r.book_id);
      if (!student || !book) continue;
      items.push({
        activity_id: `act-res-${r.reservation_id}`,
        type: 'reservation',
        student_name: student.full_name,
        student_code: student.code,
        book_title: book.title,
        summary: `Reservation ${r.status.toLowerCase()} for "${book.title}".`,
        timestamp: r.reservation_date,
      });
    }
    for (const u of service.state.users.filter((x) => x.role === 'student').slice(0, 2)) {
      items.push({
        activity_id: `act-reg-${u.user_id}`,
        type: 'new_registration',
        student_name: u.full_name,
        student_code: u.code,
        book_title: null,
        summary: `Registered student library profile (${u.department ?? 'Academic Program'}).`,
        timestamp: u.created_at,
      });
    }
    items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const payload: StudentActivityPayload = { items: items.slice(0, 6) };
    res.json(payload);
  });

  app.get('/api/librarian/dashboard/analytics', ...requireStaff, (_req, res) => {
    const catMap = new Map<string, number>();
    for (const b of service.state.books) {
      catMap.set(b.category, (catMap.get(b.category) ?? 0) + b.borrow_count);
    }

    const now = new Date();
    const monthPrefix = now.toISOString().slice(0, 7);
    const issuedThisMonth = service.state.borrowings.filter((b) =>
      b.issue_date.startsWith(monthPrefix)
    ).length;
    const returnedThisMonth = service.state.borrowings.filter(
      (b) => b.status === 'Returned' && (b.return_date ?? '').startsWith(monthPrefix)
    ).length;
    const reservationsThisMonth = service.state.reservations.filter((r) =>
      r.reservation_date.startsWith(monthPrefix)
    ).length;

    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyActivity: LibrarianAnalyticsPayload['monthly_borrowing_activity'] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyActivity.push({
        month: monthShort[d.getMonth()] ?? prefix,
        issued: service.state.borrowings.filter((b) => b.issue_date.startsWith(prefix)).length,
        returned: service.state.borrowings.filter(
          (b) => b.status === 'Returned' && (b.return_date ?? '').startsWith(prefix)
        ).length,
      });
    }

    const payload: LibrarianAnalyticsPayload = {
      has_sufficient_data: service.state.borrowings.length > 0 || service.state.books.length > 0,
      books_issued_this_month: issuedThisMonth || service.state.borrowings.length,
      books_returned_this_month:
        returnedThisMonth || service.state.borrowings.filter((b) => b.status === 'Returned').length,
      reservation_activity_this_month: reservationsThisMonth || service.state.reservations.length,
      most_borrowed_categories: Array.from(catMap.entries())
        .map(([category, borrow_count]) => ({ category, borrow_count }))
        .sort((a, b) => b.borrow_count - a.borrow_count)
        .slice(0, 5),
      most_borrowed_titles: [...service.state.books]
        .sort((a, b) => b.borrow_count - a.borrow_count)
        .slice(0, 5)
        .map((b) => ({ book_id: b.book_id, title: b.title, borrow_count: b.borrow_count })),
      monthly_borrowing_activity: monthlyActivity,
    };
    res.json(payload);
  });

  // Inventory & Books Management
  app.get('/api/librarian/books/metadata', ...requireStaff, (_req, res) => {
    const subjectsByCategory: Record<string, string[]> = {};
    for (const b of service.state.books) {
      if (!subjectsByCategory[b.category]) subjectsByCategory[b.category] = [];
      if (!subjectsByCategory[b.category].includes(b.subject)) {
        subjectsByCategory[b.category].push(b.subject);
      }
    }
    res.json({
      categories: service.state.categories.filter((c) => c.status === 'Active').map((c) => c.name),
      subjectsByCategory,
      allSubjects: service.state.subjects.filter((s) => s.status === 'Active').map((s) => s.name),
      languages: ['English', 'Hindi', 'Other'],
      formats: ['Hardcover', 'Paperback', 'Reference', 'E-Book'],
      branches: service.state.branches.filter((b) => b.status === 'Active').map((b) => b.name),
      floors: ['1st Floor', '2nd Floor', '3rd Floor', 'Online'],
      sections: Array.from(new Set(service.state.books.map((b) => b.section))),
      supports_barcodes: true,
      accession_prefix_format: 'ACC-0100-01',
      existingAccessionNumbers: service.state.copies.map((c) => c.accession_number),
      existingBarcodes: service.state.copies.map((c) => c.barcode).filter(Boolean),
    });
  });

  app.get('/api/librarian/books', ...requireStaff, (req, res) => {
    const search = String(req.query.search ?? '').trim().toLowerCase();
    const category = String(req.query.category ?? '').trim().toLowerCase();
    const availability = String(req.query.availability ?? '').trim();
    const branch = String(req.query.branch ?? '').trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? '8'), 10) || 8));

    const allInventory = service.state.books.map((b) => service.toInventoryBookItem(b));
    const filtered = allInventory.filter((b) => {
      if (search && !`${b.title} ${b.authors} ${b.isbn} ${b.subject}`.toLowerCase().includes(search)) {
        return false;
      }
      if (category && b.category.toLowerCase() !== category) return false;
      if (branch && b.branch.toLowerCase() !== branch) return false;
      if (availability && b.availability_status !== availability) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    res.json({
      is_prototype_sample: false,
      items: filtered.slice((safePage - 1) * limit, safePage * limit),
      total,
      page: safePage,
      limit,
      total_pages: totalPages,
      summary: {
        total_titles: allInventory.length,
        total_copies: allInventory.reduce((s, b) => s + b.total_copies, 0),
        available_copies: allInventory.reduce((s, b) => s + b.available_copies, 0),
        issued_copies: allInventory.reduce((s, b) => s + b.issued_copies, 0),
        reserved_copies: allInventory.reduce((s, b) => s + b.reserved_copies, 0),
        unavailable_copies: allInventory.reduce((s, b) => s + b.unavailable_copies, 0),
      },
      facets: {
        categories: Array.from(new Set(allInventory.map((b) => b.category))).sort(),
        subjects: Array.from(new Set(allInventory.map((b) => b.subject))).sort(),
        authors: Array.from(new Set(allInventory.map((b) => b.authors))).sort(),
        publishers: Array.from(new Set(allInventory.map((b) => b.publisher))).sort(),
        languages: Array.from(new Set(allInventory.map((b) => b.language))).sort(),
        formats: Array.from(new Set(allInventory.map((b) => b.format))),
        branches: Array.from(new Set(allInventory.map((b) => b.branch))).sort(),
        floors: Array.from(new Set(allInventory.map((b) => b.floor))).sort(),
        sections: Array.from(new Set(allInventory.map((b) => b.section))).sort(),
        shelves: Array.from(new Set(allInventory.map((b) => b.shelf))).sort(),
      },
      capabilities: {
        can_import_books: true,
        can_export_inventory: true,
        supports_barcodes: true,
        supports_locations: true,
        supports_staff_audit_names: true,
        accession_prefix_format: 'ACC-0100-01',
        supported_copy_statuses: [
          'Available',
          'Issued',
          'Reserved',
          'Lost',
          'Damaged',
          'Under Repair',
          'Retired',
        ],
        supported_formats: ['Hardcover', 'Paperback', 'Reference', 'E-Book'],
        supported_sort_options: [
          'recently_added',
          'title_asc',
          'most_borrowed',
          'least_available',
          'highest_rated',
        ],
      },
    });
  });

  app.get('/api/librarian/books/search', ...requireStaff, (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const matches = service.state.books
      .filter((b) => {
        if (b.status === 'Archived') return false;
        if (!q) return true;
        return (
          String(b.book_id) === q ||
          `${b.title} ${b.authors} ${b.isbn} ${b.subject}`.toLowerCase().includes(q)
        );
      })
      .slice(0, 20)
      .map((b) => service.toInventoryBookItem(b));
    res.json({ items: matches });
  });

  app.post(
    '/api/librarian/books',
    ...requireStaff,
    asyncHandler((req, res) => {
      const b = req.body ?? {};
      const authorsText = b.authors_display
        ? String(b.authors_display)
        : Array.isArray(b.authors)
          ? b.authors.map(String).join(', ')
          : String(b.authors ?? '');
      const physicalCopies = Array.isArray(b.physical_copies) ? b.physical_copies : undefined;
      const created = service.createBookWithCopies({
        title: String(b.title ?? ''),
        subtitle: b.subtitle ? String(b.subtitle) : undefined,
        authors: authorsText,
        isbn: String(b.isbn ?? ''),
        publisher: b.publisher ? String(b.publisher) : undefined,
        publication_year: Number(b.publication_year ?? 2025),
        edition: b.edition ? String(b.edition) : undefined,
        language: b.language,
        pages: b.pages ? Number(b.pages) : undefined,
        category: String(b.category ?? 'Computer Science'),
        subject: String(b.subject ?? 'Computer Science'),
        keywords: Array.isArray(b.keywords)
          ? b.keywords.map(String)
          : typeof b.keywords === 'string'
            ? b.keywords.split(',').map((s: string) => s.trim())
            : [],
        description: b.description ? String(b.description) : undefined,
        format: b.format || 'Hardcover',
        cover_image: b.cover_image ? String(b.cover_image) : undefined,
        initial_copies: Number(
          b.initial_copies ?? b.copy_count ?? (physicalCopies ? physicalCopies.length : 1)
        ),
        physical_copies: physicalCopies,
        branch: String(b.branch ?? 'Main Central Library'),
        floor: b.floor ? String(b.floor) : undefined,
        section: b.section ? String(b.section) : undefined,
        shelf: String(b.shelf ?? 'GEN-101'),
        actorName: req.currentUser!.full_name,
      });
      res.status(201).json({
        ...created,
        copies_created: created.total_copies,
        availability_status: created.available_copies > 0 ? 'Available' : 'Unavailable',
        item: created,
        book: created,
      });
    })
  );

  app.put(
    '/api/librarian/books/:id',
    ...requireStaff,
    asyncHandler((req, res) => {
      const bookId = Number.parseInt(String(req.params.id), 10);
      const book = service.state.books.find((b) => b.book_id === bookId);
      if (!book) throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
      const b = req.body ?? {};
      if (b.title) book.title = sanitizePlainText(String(b.title));
      if (typeof b.subtitle === 'string') book.subtitle = sanitizePlainText(b.subtitle);
      if (b.authors) book.authors = sanitizePlainText(String(b.authors));
      if (b.category) book.category = sanitizePlainText(String(b.category));
      if (b.subject) book.subject = sanitizePlainText(String(b.subject));
      if (b.description) book.description = sanitizePlainText(String(b.description));
      if (b.shelf) book.shelf = sanitizePlainText(String(b.shelf));
      if (b.branch) book.branch = sanitizePlainText(String(b.branch));
      if (b.floor) book.floor = sanitizePlainText(String(b.floor));
      if (b.section) book.section = sanitizePlainText(String(b.section));
      book.updated_at = new Date().toISOString();
      book.updated_by = req.currentUser!.full_name;
      service.persist();
      res.json({ item: service.toInventoryBookItem(book) });
    })
  );

  app.post('/api/librarian/books/:id/archive', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const bookId = Number.parseInt(String(req.params.id), 10);
    const book = service.state.books.find((b) => b.book_id === bookId);
    if (!book) throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
    const activeLoan = service.state.borrowings.some(
      (b) => b.book_id === bookId && b.status !== 'Returned'
    );
    if (activeLoan) {
      throw new HttpError(409, 'Cannot archive a book with active borrowings.', 'ACTIVE_LOANS_EXIST');
    }
    book.status = book.status === 'Archived' ? 'Active' : 'Archived';
    book.updated_at = new Date().toISOString();
    book.updated_by = req.currentUser!.full_name;
    service.persist();
    res.json({ item: service.toInventoryBookItem(book) });
  });

  app.get('/api/librarian/books/:id/copies', ...requireStaff, (req, res) => {
    const bookId = Number.parseInt(String(req.params.id), 10);
    const book = service.state.books.find((b) => b.book_id === bookId);
    if (!book) throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
    const copies = service.state.copies
      .filter((c) => c.book_id === bookId)
      .map((c) => service.toInventoryPhysicalCopy(c));
    res.json({
      book_id: book.book_id,
      book_title: book.title,
      isbn: book.isbn,
      supports_barcodes: true,
      accession_prefix_format: 'ACC-0100-01',
      supported_copy_statuses: ['Available', 'Issued', 'Reserved', 'Lost', 'Damaged', 'Under Repair', 'Retired'],
      items: copies,
    });
  });

  app.post('/api/librarian/books/:id/copies', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const bookId = Number.parseInt(String(req.params.id), 10);
    const book = service.state.books.find((b) => b.book_id === bookId);
    if (!book) throw new HttpError(404, 'Book not found.', 'BOOK_NOT_FOUND');
    const copyId = service.state.nextIds.copy++;
    const accession =
      String(req.body?.accession_number ?? '').trim() ||
      `ACC-${String(bookId).padStart(4, '0')}-${copyId}`;
    if (service.state.copies.some((c) => c.accession_number.toLowerCase() === accession.toLowerCase())) {
      throw new HttpError(409, `Accession number ${accession} already exists.`, 'DUPLICATE_ACCESSION');
    }
    const nowIso = new Date().toISOString();
    const newCopy = {
      copy_id: copyId,
      book_id: bookId,
      accession_number: accession,
      barcode: req.body?.barcode ? String(req.body.barcode).trim() : `BC-${bookId}-${copyId}`,
      status: (req.body?.status ?? 'Available') as CopyStatus,
      condition: (req.body?.condition ?? 'New') as CopyCondition,
      branch: String(req.body?.branch ?? book.branch),
      floor: String(req.body?.floor ?? book.floor),
      section: String(req.body?.section ?? book.section),
      shelf: String(req.body?.shelf ?? book.shelf),
      added_at: nowIso.slice(0, 10),
      updated_at: nowIso,
    };
    service.state.copies.push(newCopy);
    reconcileBookCounts(service.state, bookId);
    service.persist();
    res.status(201).json({ item: service.toInventoryPhysicalCopy(newCopy) });
  });

  app.put('/api/librarian/copies/:copyId', ...requireStaff, (req, res) => {
    const copyId = Number.parseInt(String(req.params.copyId), 10);
    const copy = service.state.copies.find((c) => c.copy_id === copyId);
    if (!copy) throw new HttpError(404, 'Copy not found.', 'COPY_NOT_FOUND');
    if (req.body?.status) copy.status = req.body.status as CopyStatus;
    if (req.body?.condition) copy.condition = req.body.condition as CopyCondition;
    if (req.body?.shelf) copy.shelf = sanitizePlainText(String(req.body.shelf));
    copy.updated_at = new Date().toISOString();
    reconcileBookCounts(service.state, copy.book_id);
    service.persist();
    res.json({ item: service.toInventoryPhysicalCopy(copy) });
  });

  app.get('/api/librarian/copies/lookup', ...requireStaff, (req, res) => {
    const code = String(req.query.code ?? '').trim().toLowerCase();
    const copy = service.state.copies.find(
      (c) =>
        c.accession_number.toLowerCase() === code ||
        (c.barcode && c.barcode.toLowerCase() === code)
    );
    if (!copy) {
      throw new HttpError(404, `No physical copy matches "${req.query.code ?? ''}".`, 'COPY_NOT_FOUND');
    }
    const book = service.state.books.find((b) => b.book_id === copy.book_id);
    res.json({
      copy: service.toInventoryPhysicalCopy(copy),
      book: book ? service.toInventoryBookItem(book) : null,
    });
  });

  app.get('/api/librarian/inventory/export', ...requireStaff, (_req, res) => {
    const header = 'Book ID,Title,Authors,ISBN,Category,Subject,Total Copies,Available Copies,Issued Copies,Reserved Copies';
    const rows = service.state.books.map((b) =>
      [
        b.book_id,
        `"${b.title.replace(/"/g, '""')}"`,
        `"${b.authors.replace(/"/g, '""')}"`,
        b.isbn,
        `"${b.category}"`,
        `"${b.subject}"`,
        b.total_copies,
        b.available_copies,
        b.issued_copies,
        b.reserved_copies,
      ].join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="library-inventory.csv"');
    res.send([header, ...rows].join('\n'));
  });

  // Circulation (Issue & Return)
  app.get('/api/librarian/circulation/policy', ...requireStaff, (_req, res) => {
    res.json(service.getCirculationPolicy());
  });

  app.get('/api/librarian/students/search', ...requireStaff, (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    const items = service.state.users
      .filter((u) => {
        if (u.role !== 'student') return false;
        if (!q) return true;
        return (
          String(u.user_id) === q ||
          `${u.full_name} ${u.code} ${u.email} ${u.department ?? ''}`.toLowerCase().includes(q)
        );
      })
      .slice(0, 20)
      .map((u) => service.toCirculationStudentRecord(u));
    res.json({ items });
  });

  app.get('/api/librarian/students/:id/eligibility', ...requireStaff, (req, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === sid && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'STUDENT_NOT_FOUND');
    const mapped = service.toCirculationStudentRecord(student);
    res.json({ ...mapped, student: mapped });
  });

  app.get('/api/librarian/books/:id/reservations', ...requireStaff, (req, res) => {
    const bookId = Number.parseInt(String(req.params.id), 10);
    const items = service.state.reservations
      .filter(
        (r) =>
          r.book_id === bookId &&
          (r.status === 'Waiting' || r.status === 'Ready for Pickup')
      )
      .map((r) => {
        const mapped = service.toLibrarianReservationItem(r);
        return {
          reservation_id: mapped.reservation_id,
          book_id: mapped.book_id,
          book_title: mapped.book_title,
          student_id: mapped.student_id,
          student_name: mapped.student_name,
          student_code: mapped.student_code,
          queue_position: mapped.queue_position,
          status: mapped.status,
          created_at: mapped.reservation_date,
          expires_at: mapped.pickup_deadline,
        };
      });
    res.json({ items });
  });

  app.post(
    '/api/librarian/borrowings',
    ...requireStaff,
    asyncHandler(async (req, res) => {
      const result = await service.issueBookTransaction({
        studentId: Number(req.body?.student_id),
        bookId: Number(req.body?.book_id),
        copyId: req.body?.copy_id ? Number(req.body.copy_id) : null,
        reservationId: req.body?.reservation_id ? Number(req.body.reservation_id) : null,
        actorName: req.currentUser!.full_name,
      });
      res.status(201).json(result);
    })
  );

  app.get('/api/librarian/borrowings/active', ...requireStaff, (req, res) => {
    const search = String(req.query.search ?? req.query.q ?? '').trim().toLowerCase();
    const statusFilter = String(req.query.status ?? 'all').trim().toLowerCase();
    const includeReturned = req.query.include_returned === '1' || req.query.include_returned === 'true';
    const today = new Date().toISOString().slice(0, 10);

    const items = service.state.borrowings
      .filter((b) => (includeReturned ? true : b.status !== 'Returned'))
      .map((b) => service.toActiveBorrowingDetail(b))
      .filter((d) => {
        if (statusFilter === 'overdue' && d.status !== 'Overdue' && d.due_date >= today) {
          return false;
        }
        if (statusFilter === 'due_today' && d.due_date !== today) {
          return false;
        }
        if (!search) return true;
        return `${d.transaction_code} ${d.student_name} ${d.student_code} ${d.book_title} ${d.accession_number} ${d.barcode ?? ''}`
          .toLowerCase()
          .includes(search);
      });
    res.json({ items });
  });

  app.post(
    '/api/librarian/returns',
    ...requireStaff,
    asyncHandler(async (req, res) => {
      const result = await service.returnBookTransaction({
        borrowingId: Number(req.body?.borrowing_id),
        condition: (req.body?.condition ?? 'Good') as ReturnCopyCondition,
        conditionNotes: req.body?.condition_notes ? String(req.body.condition_notes) : null,
        sendDamagedToRepair: Boolean(req.body?.send_damaged_to_repair),
        actorName: req.currentUser!.full_name,
      });
      res.json(result);
    })
  );

  // Librarian Reservations Management
  app.get('/api/librarian/reservations', ...requireStaff, (_req, res) => {
    const items = service.state.reservations.map((r) => service.toLibrarianReservationItem(r));
    res.json({
      items,
      policy: {
        pickup_window_hours: service.state.librarySettings.reservation_policy.pickup_window_hours,
        expiring_warning_hours: 12,
        supports_notifications: true,
        server_reference_iso: new Date().toISOString(),
      },
      supported_filters: {
        date_range: true,
        category: true,
        subject: true,
        branch: true,
        student_department: true,
        pickup_status: true,
      },
      supported_actions: {
        can_mark_ready: true,
        can_cancel: true,
        can_extend_deadline: true,
      },
    });
  });

  app.get('/api/librarian/reservations/:id', ...requireStaff, (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const r = service.state.reservations.find((x) => x.reservation_id === id);
    if (!r) throw new HttpError(404, 'Reservation not found.', 'NOT_FOUND');
    const mapped = service.toLibrarianReservationItem(r);
    const availableCopies = service.state.copies
      .filter((c) => c.book_id === r.book_id && c.status === 'Available')
      .map((c) => service.toInventoryPhysicalCopy(c));
    res.json({ reservation: mapped, item: mapped, available_copies: availableCopies });
  });

  app.post(
    '/api/librarian/reservations/:id/ready',
    ...requireStaff,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      const copyId = Number(req.body?.copy_id);
      res.json(await service.markReservationReady(id, copyId, req.currentUser!));
    })
  );

  app.post(
    '/api/librarian/reservations/:id/cancel',
    ...requireStaff,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      res.json(
        await service.cancelReservation(
          id,
          req.currentUser!,
          req.body?.reason ? String(req.body.reason) : 'Cancelled by librarian'
        )
      );
    })
  );

  app.post(
    '/api/librarian/reservations/:id/extend',
    ...requireStaff,
    asyncHandler(async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      const hours = Number(req.body?.extra_hours ?? 24);
      res.json(await service.extendReservationDeadline(id, hours));
    })
  );

  // Librarian Student Records
  app.get('/api/librarian/students', ...requireStaff, (_req, res) => {
    const students = service.state.users
      .filter((u) => u.role === 'student')
      .map((u) => service.toLibrarianStudentDirectoryItem(u));
    res.json({
      items: students,
      total_count: students.length,
      total_pages: 1,
      summary: {
        total_students: students.length,
        active_students: students.filter((s) => s.account_status === 'Active').length,
        with_active_loans: students.filter((s) => s.active_loans_count > 0).length,
        with_overdue_books: students.filter((s) => s.overdue_count > 0).length,
        with_reservations: students.filter((s) => s.active_reservations_count > 0).length,
      },
      policy: service.getCirculationPolicy(),
      capabilities: {
        can_block_unblock: true,
        can_view_ratings: true,
        supported_filters: {
          account_status: true,
          department: true,
          course: true,
          academic_year: true,
          activity_flags: true,
        },
      },
    });
  });

  app.get('/api/librarian/students/:id', ...requireStaff, (req, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === sid && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'STUDENT_NOT_FOUND');
    const reviews = service.state.reviews
      .filter((r) => r.student_id === sid)
      .map((r) => ({
        book_id: r.book_id,
        book_title: service.state.books.find((b) => b.book_id === r.book_id)?.title ?? `Book #${r.book_id}`,
        rating: r.rating,
        rated_at: r.updated_at,
      }));
    const avg =
      reviews.length > 0
        ? Number((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1))
        : null;
    res.json({
      student: service.toLibrarianStudentDirectoryItem(student),
      rating_context: {
        permitted: true,
        ratings_count: reviews.length,
        average_rating_given: avg,
        rated_books: reviews,
      },
    });
  });

  app.get('/api/librarian/students/:id/borrowings', ...requireStaff, (req, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const items = service.state.borrowings
      .filter((b) => b.student_id === sid && b.status !== 'Returned')
      .map((b) => service.toActiveBorrowingDetail(b));
    res.json({ items });
  });

  app.get('/api/librarian/students/:id/reservations', ...requireStaff, (req, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const items = service.state.reservations
      .filter((r) => r.student_id === sid)
      .map((r) => service.toLibrarianReservationItem(r));
    res.json({ items });
  });

  app.get('/api/librarian/students/:id/history', ...requireStaff, (req, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const items = service.state.borrowings
      .filter((b) => b.student_id === sid && b.status === 'Returned')
      .map((b) => {
        const book = service.state.books.find((bk) => bk.book_id === b.book_id);
        const days = Math.max(
          1,
          Math.round(
            (new Date(b.return_date ?? b.issue_date).getTime() - new Date(b.issue_date).getTime()) /
              86_400_000
          )
        );
        return {
          borrowing_id: b.borrowing_id,
          transaction_code: b.transaction_code,
          book_id: b.book_id,
          book_slug: book?.slug ?? String(b.book_id),
          book_title: book?.title ?? `Book #${b.book_id}`,
          book_author: book?.authors ?? 'Unknown',
          category: book?.category ?? 'General',
          issue_date: b.issue_date,
          return_date: b.return_date ?? b.issue_date,
          loan_duration_days: days,
          status: 'Returned',
        };
      });
    res.json({ items });
  });

  app.post('/api/librarian/students/:id/status', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const sid = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === sid && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'STUDENT_NOT_FOUND');
    const nextStatus = String(req.body?.account_status ?? req.body?.status ?? 'Active');
    if (!['Active', 'Blocked', 'Suspended'].includes(nextStatus)) {
      throw new HttpError(400, 'Invalid account status.', 'INVALID_STATUS');
    }
    student.account_status = nextStatus as DbUser['account_status'];
    student.restriction_reason =
      nextStatus === 'Active'
        ? null
        : sanitizePlainText(String(req.body?.reason ?? 'Account restricted by library staff.'));
    student.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      `Set Student Account Status to ${nextStatus}`,
      'student',
      student.code,
      student.full_name,
      `Changed account status to ${nextStatus}.`
    );
    res.json({ student: service.toLibrarianStudentDirectoryItem(student) });
  });

  // Librarian Overdue Books
  app.get('/api/librarian/overdue', ...requireStaff, (_req, res) => {
    const items = service.getOverdueRecords();
    const { fine_policy, reminder_policy } = service.state.librarySettings;
    res.json({
      items,
      policy: {
        fine_policy_enabled: fine_policy.fine_policy_enabled,
        fine_per_day_amount: fine_policy.fine_per_day_amount,
        fine_currency_symbol: fine_policy.fine_currency_symbol,
        supports_email_notifications: reminder_policy.email_notifications_enabled,
        supports_bulk_reminders: true,
        reminder_cooldown_hours: reminder_policy.overdue_reminder_frequency_days * 24,
        library_contact_info: service.state.librarySettings.general_settings.contact_email,
        overdue_restriction_policy_note: 'Overdue books must be returned before renewing additional items.',
        authoritative_date_iso: new Date().toISOString().slice(0, 10),
        authoritative_timezone: 'UTC',
      },
    });
  });

  app.get('/api/librarian/overdue/:id', ...requireStaff, (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const item = service.getOverdueRecords().find((r) => r.borrowing_id === id);
    if (!item) throw new HttpError(404, 'Overdue record not found.', 'NOT_FOUND');
    res.json({ item });
  });

  app.post('/api/librarian/overdue/:id/remind', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const log = service.sendOverdueReminder(id, req.currentUser!.full_name);
    res.json({ ok: true, reminder: log });
  });

  app.post('/api/librarian/overdue/bulk-remind', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const ids: number[] = Array.isArray(req.body?.borrowing_ids)
      ? req.body.borrowing_ids.map(Number)
      : [];
    const sent: number[] = [];
    const skipped: number[] = [];
    for (const id of ids) {
      try {
        service.sendOverdueReminder(id, req.currentUser!.full_name);
        sent.push(id);
      } catch {
        skipped.push(id);
      }
    }
    res.json({
      sent_ids: sent,
      skipped_ids: skipped,
      sent_count: sent.length,
      succeeded_count: sent.length,
      failed_count: 0,
      skipped_duplicate_count: skipped.length,
    });
  });

  // Librarian Announcements
  app.get('/api/librarian/announcements', ...requireStaff, (_req, res) => {
    const items = service.state.announcements.map((a) => ({
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
    res.json({
      items,
      capabilities: {
        categories: [
          'General Notice',
          'Library Timings',
          'New Arrivals',
          'Maintenance',
          'Events',
          'Book Return Reminder',
          'Examination Notice',
          'Policy Update',
        ],
        supports_scheduling: true,
        supports_target_options: {
          all_students: true,
          department: true,
          course: true,
          academic_year: true,
        },
        supports_email_notifications:
          service.state.librarySettings.reminder_policy.email_notifications_enabled,
        allow_edit_published: true,
        departments: Array.from(
          new Set(service.state.users.map((u) => u.department).filter(Boolean))
        ),
        courses: Array.from(new Set(service.state.users.map((u) => u.program).filter(Boolean))),
        academic_years: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'],
        timezone_label: 'UTC',
      },
    });
  });

  app.get('/api/librarian/announcements/:id', ...requireStaff, (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const ann = service.state.announcements.find((a) => a.announcement_id === id);
    if (!ann) throw new HttpError(404, 'Announcement not found.', 'NOT_FOUND');
    res.json({ item: ann });
  });

  app.post('/api/librarian/announcements', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const title = sanitizePlainText(String(b.title ?? ''));
    const content = sanitizePlainText(String(b.content ?? ''));
    if (!title || !content) {
      throw new HttpError(400, 'Announcement title and content are required.', 'INVALID_INPUT');
    }
    const mode = String(b.publish_mode ?? 'now');
    const nowIso = new Date().toISOString();
    const id = service.state.nextIds.announcement++;
    const ann: DbAnnouncement = {
      announcement_id: id,
      title,
      content,
      category: sanitizePlainText(String(b.category ?? 'General Notice')),
      priority: (b.priority ?? 'Normal') as DbAnnouncement['priority'],
      target_type: (b.target_type ?? 'all_students') as DbAnnouncement['target_type'],
      target_value: b.target_value ? sanitizePlainText(String(b.target_value)) : null,
      status: mode === 'draft' ? 'Draft' : mode === 'schedule' ? 'Scheduled' : 'Published',
      publish_at:
        mode === 'now'
          ? nowIso
          : mode === 'schedule' && b.publish_at
            ? String(b.publish_at)
            : null,
      expires_at: b.expires_at ? String(b.expires_at) : null,
      created_by: req.currentUser!.full_name,
      created_at: nowIso,
      updated_at: nowIso,
      notifications_sent: false,
      notifications_created: 0,
      recipients_count: 0,
    };
    service.state.announcements.unshift(ann);
    if (ann.status === 'Published') {
      service.publishAnnouncementRecord(ann.announcement_id, req.currentUser!.full_name);
    } else {
      service.persist();
    }
    res.status(201).json({ item: ann });
  });

  app.put('/api/librarian/announcements/:id', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const ann = service.state.announcements.find((a) => a.announcement_id === id);
    if (!ann) throw new HttpError(404, 'Announcement not found.', 'NOT_FOUND');
    const b = req.body ?? {};
    if (b.title) ann.title = sanitizePlainText(String(b.title));
    if (b.content) ann.content = sanitizePlainText(String(b.content));
    if (b.category) ann.category = sanitizePlainText(String(b.category));
    if (b.priority) ann.priority = b.priority;
    if (b.target_type) ann.target_type = b.target_type;
    if ('target_value' in b) {
      ann.target_value = b.target_value ? sanitizePlainText(String(b.target_value)) : null;
    }
    ann.updated_at = new Date().toISOString();
    service.persist();
    res.json({ item: ann });
  });

  app.post('/api/librarian/announcements/:id/publish', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const ann = service.publishAnnouncementRecord(id, req.currentUser!.full_name);
    res.json({ item: ann });
  });

  app.post('/api/librarian/announcements/:id/archive', ...requireStaff, (_req, res) => {
    const id = Number.parseInt(String(_req.params.id), 10);
    const ann = service.state.announcements.find((a) => a.announcement_id === id);
    if (!ann) throw new HttpError(404, 'Announcement not found.', 'NOT_FOUND');
    ann.status = 'Archived';
    ann.updated_at = new Date().toISOString();
    service.persist();
    res.json({ item: ann });
  });

  // Librarian Reports & Analytics
  app.get('/api/librarian/reports/summary', ...requireStaff, (_req, res) => {
    const payload: ReportsSourceDataset = {
      is_prototype_sample: false,
      books: service.state.books.map((b) => service.toInventoryBookItem(b)),
      copies: service.state.copies.map((c) => service.toInventoryPhysicalCopy(c)),
      borrowings: service.state.borrowings.map((b) => {
        const detail = service.toActiveBorrowingDetail(b);
        const book = service.state.books.find((bk) => bk.book_id === b.book_id);
        return {
          ...detail,
          category: book?.category ?? 'General',
          subject: book?.subject ?? 'General',
          branch: book?.branch ?? 'Main Central Library',
        };
      }),
      overdueRecords: service.getOverdueRecords(),
      reservations: service.state.reservations.map((r) => service.toLibrarianReservationItem(r)),
      students: service.state.users
        .filter((u) => u.role === 'student')
        .map((u) => service.toCirculationStudentRecord(u)),
      previousPeriodDeltas: null,
      capabilities: {
        can_export_csv: true,
        can_export_pdf_backend: true,
        supports_comparison_delta: false,
        supports_overdue_trends: true,
      },
    };
    res.json(payload);
  });

  app.get('/api/librarian/reports/export', ...requireStaff, (_req, res) => {
    const header = 'Transaction Code,Student,Book,Issue Date,Due Date,Return Date,Status';
    const rows = service.state.borrowings.map((b) => {
      const detail = service.toActiveBorrowingDetail(b);
      return [
        detail.transaction_code,
        `"${detail.student_name}"`,
        `"${detail.book_title}"`,
        detail.issue_date,
        detail.due_date,
        detail.return_date ?? '',
        detail.status,
      ].join(',');
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="library-circulation-report.csv"');
    res.send([header, ...rows].join('\n'));
  });

  // Librarian Profile & Sessions
  app.get('/api/librarian/profile', ...requireStaff, (req: AuthenticatedRequest, res) => {
    res.json(
      service.buildLibrarianFullProfilePayload(
        req.currentUser!,
        req.currentSession?.session_id
      )
    );
  });

  app.put('/api/librarian/profile', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (req.body?.full_name) {
      user.full_name = sanitizePlainText(String(req.body.full_name));
    }
    if (req.body?.email) {
      const nextEmail = String(req.body.email).trim().toLowerCase();
      if (
        service.state.users.some(
          (u) => u.user_id !== user.user_id && u.email.toLowerCase() === nextEmail
        )
      ) {
        throw new HttpError(
          409,
          'This email address is already linked to another account.',
          'DUPLICATE_EMAIL'
        );
      }
      user.email = nextEmail;
    }
    if (req.body?.department_title) {
      user.designation = sanitizePlainText(String(req.body.department_title));
    }
    if (typeof req.body?.mobile_number === 'string') {
      user.mobile = sanitizePlainText(req.body.mobile_number) || null;
    } else if (req.body?.mobile_number === null) {
      user.mobile = null;
    }
    if ('avatar_url' in (req.body ?? {})) {
      const av = req.body.avatar_url;
      user.avatar_url =
        typeof av === 'string' && av.trim() ? av.trim() : null;
    }
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({
      ok: true,
      full_name: user.full_name,
      librarian: service.buildSessionPayload(user).librarian,
    });
  });

  app.put('/api/librarian/notification-preferences', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (Array.isArray(req.body?.preferences)) {
      user.librarian_notification_preferences = req.body.preferences;
    } else {
      user.librarian_notification_preferences = {
        overdue_digest_enabled: Boolean(req.body?.overdue_digest_enabled ?? true),
        reservation_hold_alerts_enabled: Boolean(req.body?.reservation_hold_alerts_enabled ?? true),
        inventory_audit_alerts_enabled: Boolean(req.body?.inventory_audit_alerts_enabled ?? true),
        announcement_delivery_summary_enabled: Boolean(
          req.body?.announcement_delivery_summary_enabled ?? true
        ),
        daily_circulation_summary_enabled: Boolean(req.body?.daily_circulation_summary_enabled),
      };
    }
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({
      ok: true,
      notification_preferences: service.buildLibrarianFullProfilePayload(
        user,
        req.currentSession?.session_id
      ).notification_preferences,
    });
  });

  app.put('/api/librarian/change-password', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    const current = String(req.body?.current_password ?? '');
    const nextPass = String(req.body?.new_password ?? '');
    if (!verifyPassword(current, user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    if (nextPass.length < 8) {
      throw new HttpError(400, 'Password must be at least 8 characters.', 'WEAK_PASSWORD');
    }
    user.password_hash = hashPassword(nextPass);
    user.updated_at = new Date().toISOString();
    service.persist();
    res.json({ ok: true });
  });

  app.delete('/api/librarian/sessions/:id', ...requireStaff, (req: AuthenticatedRequest, res) => {
    const sid = String(req.params.id);
    service.state.sessions = service.state.sessions.filter(
      (s) => !(s.session_id === sid && s.user_id === req.currentUser!.user_id)
    );
    service.persist();
    res.json({ ok: true });
  });

  app.post('/api/librarian/scheduler/run', ...requireStaff, (_req, res) => {
    res.json(service.runScheduler());
  });

  // ==================== ADMIN ROUTES ====================

  const requireAdmin = [requireAuth, requireRole(['admin'])] as const;

  app.get('/api/admin/workspace', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    res.json(service.getAdminWorkspaceData(req.currentUser!));
  });

  app.post('/api/admin/scheduler/run', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const result = service.runScheduler();
    service.recordAdminAudit(
      req.currentUser!,
      'Run Automated Maintenance Scheduler',
      'settings',
      'scheduler',
      'Overdue, Reminder & Reservation Check',
      `Checked due loans (${result.overdueUpdatedCount} newly overdue), sent ${result.dueSoonRemindersSent + result.overdueRemindersSent} reminder(s), expired ${result.expiredReservationsCount} hold(s).`
    );
    res.json(result);
  });

  app.post('/api/admin/staff', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const email = String(b.email ?? '').trim().toLowerCase();
    const code = String(b.staff_code ?? '').trim().toUpperCase();
    const fullName = sanitizePlainText(String(b.full_name ?? ''));
    if (!fullName || !email || !code) {
      throw new HttpError(400, 'Full name, staff code, and email are required.', 'INVALID_INPUT');
    }
    if (service.state.users.some((u) => u.email.toLowerCase() === email || u.code.toLowerCase() === code.toLowerCase())) {
      throw new HttpError(409, 'Email or staff code already exists.', 'DUPLICATE_STAFF');
    }
    const role: UserRole = b.role === 'admin' ? 'admin' : 'librarian';
    const tempPass = String(b.temporary_password ?? 'Librarian@123');
    const nowIso = new Date().toISOString();
    const newStaff: DbUser = {
      user_id: service.state.nextIds.user++,
      role,
      full_name: fullName,
      email,
      code,
      password_hash: hashPassword(tempPass),
      account_status: 'Active',
      avatar_url: null,
      must_change_password: true,
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
      mobile: b.mobile_number ? sanitizePlainText(String(b.mobile_number)) : '',
      designation: sanitizePlainText(String(b.designation ?? 'Librarian')),
      branch: sanitizePlainText(String(b.branch ?? 'Main Central Library')),
      joining_date: nowIso.slice(0, 10),
      invitation_pending: b.onboarding_mode === 'invitation',
      invitation_sent_at: b.onboarding_mode === 'invitation' ? nowIso : null,
    };
    service.state.users.push(newStaff);
    service.recordAdminAudit(
      req.currentUser!,
      `Create ${role === 'admin' ? 'Admin' : 'Librarian'} Account`,
      'staff',
      newStaff.code,
      newStaff.full_name,
      `Provisioned staff account (${newStaff.email}) for ${newStaff.branch}.`
    );
    res.status(201).json({ item: service.toStaffAccountRecord(newStaff) });
  });

  app.put('/api/admin/staff/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const staff = service.state.users.find(
      (u) => u.user_id === id && (u.role === 'librarian' || u.role === 'admin')
    );
    if (!staff) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
    const b = req.body ?? {};
    if (b.full_name) staff.full_name = sanitizePlainText(String(b.full_name));
    if (b.email) staff.email = String(b.email).trim().toLowerCase();
    if (b.designation) staff.designation = sanitizePlainText(String(b.designation));
    if (b.branch) staff.branch = sanitizePlainText(String(b.branch));
    if (typeof b.mobile_number === 'string') staff.mobile = sanitizePlainText(b.mobile_number);
    if (b.role === 'admin' || b.role === 'librarian') staff.role = b.role;
    staff.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Staff Account',
      'staff',
      staff.code,
      staff.full_name,
      `Updated staff role/branch (${staff.role} · ${staff.branch}).`
    );
    res.json({ item: service.toStaffAccountRecord(staff) });
  });

  app.post('/api/admin/staff/:id/status', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const staff = service.state.users.find(
      (u) => u.user_id === id && (u.role === 'librarian' || u.role === 'admin')
    );
    if (!staff) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
    if (staff.user_id === req.currentUser!.user_id) {
      throw new HttpError(409, 'You cannot deactivate your own active administrator account.', 'SELF_LOCKOUT_BLOCKED');
    }
    const status = String(req.body?.status ?? 'Active');
    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      throw new HttpError(400, 'Invalid status.', 'INVALID_STATUS');
    }
    staff.account_status = status as DbUser['account_status'];
    staff.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      `Change Staff Status to ${status}`,
      'staff',
      staff.code,
      staff.full_name,
      `Staff account marked ${status}.`
    );
    res.json({ item: service.toStaffAccountRecord(staff) });
  });

  app.post('/api/admin/staff/:id/reset-password', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const staff = service.state.users.find(
      (u) => u.user_id === id && (u.role === 'librarian' || u.role === 'admin')
    );
    if (!staff) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
    const newPass = String(req.body?.temporary_password ?? 'StaffTemp@2026');
    staff.password_hash = hashPassword(newPass);
    staff.must_change_password = true;
    staff.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Reset Staff Password',
      'staff',
      staff.code,
      staff.full_name,
      'Issued temporary password reset and flagged account for password update.'
    );
    res.json({ item: service.toStaffAccountRecord(staff) });
  });

  app.put('/api/admin/students/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === id && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'NOT_FOUND');
    const b = req.body ?? {};
    if (b.full_name) student.full_name = sanitizePlainText(String(b.full_name));
    if (b.email) student.email = String(b.email).trim().toLowerCase();
    if ('mobile' in b) {
      student.mobile = b.mobile ? sanitizePlainText(String(b.mobile)) : null;
    }
    if (b.department) student.department = sanitizePlainText(String(b.department));
    if (b.program) student.program = sanitizePlainText(String(b.program));
    if (b.academic_year) student.academic_year = sanitizePlainText(String(b.academic_year));
    student.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Student Account',
      'student',
      student.code,
      student.full_name,
      `Updated student academic profile (${student.department} · ${student.academic_year}).`
    );
    res.json({ item: service.toLibrarianStudentDirectoryItem(student) });
  });

  app.post('/api/admin/students/:id/status', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === id && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'NOT_FOUND');
    const nextStatus = String(req.body?.account_status ?? req.body?.status ?? 'Active');
    if (!['Active', 'Blocked', 'Suspended'].includes(nextStatus)) {
      throw new HttpError(400, 'Invalid account status.', 'INVALID_STATUS');
    }
    student.account_status = nextStatus as DbUser['account_status'];
    student.restriction_reason =
      nextStatus === 'Active'
        ? null
        : sanitizePlainText(String(req.body?.reason ?? 'Account restricted by administrator.'));
    student.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      `Set Student Account Status to ${nextStatus}`,
      'student',
      student.code,
      student.full_name,
      student.restriction_reason ?? `Account marked ${nextStatus}.`
    );
    res.json({ item: service.toLibrarianStudentDirectoryItem(student) });
  });

  app.delete('/api/admin/students/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const student = service.state.users.find((u) => u.user_id === id && u.role === 'student');
    if (!student) throw new HttpError(404, 'Student not found.', 'NOT_FOUND');
    const hasLoans = service.state.borrowings.some(
      (b) => b.student_id === id && b.status !== 'Returned'
    );
    if (hasLoans) {
      throw new HttpError(
        409,
        'Cannot remove a student account with active unreturned books.',
        'ACTIVE_LOANS_EXIST'
      );
    }
    service.state.users = service.state.users.filter((u) => u.user_id !== id);
    service.recordAdminAudit(
      req.currentUser!,
      'Remove Student Account',
      'student',
      student.code,
      student.full_name,
      'Deleted student record with zero active borrowings.'
    );
    res.json({ deleted: true });
  });

  // Categories
  app.post('/api/admin/categories', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const name = sanitizePlainText(String(req.body?.name ?? ''));
    if (!name) throw new HttpError(400, 'Category name required.', 'INVALID_INPUT');
    if (service.state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, 'Category already exists.', 'DUPLICATE_CATEGORY');
    }
    const nowIso = new Date().toISOString();
    const created = {
      category_id: service.state.nextIds.category++,
      name,
      description: sanitizePlainText(String(req.body?.description ?? '')),
      status: (req.body?.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
    };
    service.state.categories.push(created);
    service.recordAdminAudit(
      req.currentUser!,
      'Create Category',
      'category',
      String(created.category_id),
      created.name,
      'Added new catalog category.'
    );
    res.status(201).json({ item: created });
  });

  app.put('/api/admin/categories/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const cat = service.state.categories.find((c) => c.category_id === id);
    if (!cat) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
    if (req.body?.name) cat.name = sanitizePlainText(String(req.body.name));
    if (typeof req.body?.description === 'string') {
      cat.description = sanitizePlainText(req.body.description);
    }
    if (req.body?.status === 'Active' || req.body?.status === 'Inactive') {
      cat.status = req.body.status;
    }
    cat.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Category',
      'category',
      String(cat.category_id),
      cat.name,
      `Category status: ${cat.status}.`
    );
    res.json({ item: cat });
  });

  app.delete('/api/admin/categories/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const cat = service.state.categories.find((c) => c.category_id === id);
    if (!cat) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
    const used = service.state.books.some(
      (b) => b.category.toLowerCase() === cat.name.toLowerCase()
    );
    if (used) {
      throw new HttpError(409, 'Category is currently referenced by catalog books.', 'IN_USE');
    }
    service.state.categories = service.state.categories.filter((c) => c.category_id !== id);
    service.recordAdminAudit(
      req.currentUser!,
      'Delete Category',
      'category',
      String(id),
      cat.name,
      'Removed unused category.'
    );
    res.json({ deleted: true });
  });

  // Subjects
  app.post('/api/admin/subjects', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const name = sanitizePlainText(String(req.body?.name ?? ''));
    const code = sanitizePlainText(String(req.body?.code ?? '')).toUpperCase();
    if (!name || !code) throw new HttpError(400, 'Subject name and code required.', 'INVALID_INPUT');
    const nowIso = new Date().toISOString();
    const created = {
      subject_id: service.state.nextIds.subject++,
      name,
      code,
      description: sanitizePlainText(String(req.body?.description ?? '')),
      status: (req.body?.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
    };
    service.state.subjects.push(created);
    service.recordAdminAudit(
      req.currentUser!,
      'Create Subject',
      'subject',
      created.code,
      created.name,
      'Added new subject tag.'
    );
    res.status(201).json({ item: created });
  });

  app.put('/api/admin/subjects/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const sub = service.state.subjects.find((s) => s.subject_id === id);
    if (!sub) throw new HttpError(404, 'Subject not found.', 'NOT_FOUND');
    if (req.body?.name) sub.name = sanitizePlainText(String(req.body.name));
    if (req.body?.code) sub.code = sanitizePlainText(String(req.body.code)).toUpperCase();
    if (typeof req.body?.description === 'string') {
      sub.description = sanitizePlainText(req.body.description);
    }
    if (req.body?.status === 'Active' || req.body?.status === 'Inactive') {
      sub.status = req.body.status;
    }
    sub.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Subject',
      'subject',
      sub.code,
      sub.name,
      `Subject status: ${sub.status}.`
    );
    res.json({ item: sub });
  });

  app.delete('/api/admin/subjects/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const sub = service.state.subjects.find((s) => s.subject_id === id);
    if (!sub) throw new HttpError(404, 'Subject not found.', 'NOT_FOUND');
    const used = service.state.books.some((b) => b.subject.toLowerCase() === sub.name.toLowerCase());
    if (used) throw new HttpError(409, 'Subject is referenced by catalog books.', 'IN_USE');
    service.state.subjects = service.state.subjects.filter((s) => s.subject_id !== id);
    service.recordAdminAudit(
      req.currentUser!,
      'Delete Subject',
      'subject',
      sub.code,
      sub.name,
      'Removed unused subject.'
    );
    res.json({ deleted: true });
  });

  // Branches
  app.post('/api/admin/branches', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const name = sanitizePlainText(String(req.body?.name ?? ''));
    const code = sanitizePlainText(String(req.body?.code ?? '')).toUpperCase();
    if (!name || !code) throw new HttpError(400, 'Branch name and code required.', 'INVALID_INPUT');
    const nowIso = new Date().toISOString();
    const created = {
      branch_id: service.state.nextIds.branch++,
      name,
      code,
      address: sanitizePlainText(String(req.body?.address ?? '')),
      contact_info: sanitizePlainText(String(req.body?.contact_info ?? '')),
      status: (req.body?.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
      created_at: nowIso.slice(0, 10),
      updated_at: nowIso,
    };
    service.state.branches.push(created);
    service.recordAdminAudit(
      req.currentUser!,
      'Create Branch',
      'branch',
      created.code,
      created.name,
      'Created library branch location.'
    );
    res.status(201).json({ item: created });
  });

  app.put('/api/admin/branches/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const br = service.state.branches.find((b) => b.branch_id === id);
    if (!br) throw new HttpError(404, 'Branch not found.', 'NOT_FOUND');
    if (req.body?.name) br.name = sanitizePlainText(String(req.body.name));
    if (req.body?.code) br.code = sanitizePlainText(String(req.body.code)).toUpperCase();
    if (typeof req.body?.address === 'string') br.address = sanitizePlainText(req.body.address);
    if (typeof req.body?.contact_info === 'string') {
      br.contact_info = sanitizePlainText(req.body.contact_info);
    }
    if (req.body?.status === 'Active' || req.body?.status === 'Inactive') {
      br.status = req.body.status;
    }
    br.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Branch',
      'branch',
      br.code,
      br.name,
      `Branch status: ${br.status}.`
    );
    res.json({ item: br });
  });

  app.delete('/api/admin/branches/:id', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    const br = service.state.branches.find((b) => b.branch_id === id);
    if (!br) throw new HttpError(404, 'Branch not found.', 'NOT_FOUND');
    const used =
      service.state.books.some((b) => b.branch.toLowerCase() === br.name.toLowerCase()) ||
      service.state.copies.some((c) => c.branch.toLowerCase() === br.name.toLowerCase());
    if (used) {
      throw new HttpError(409, 'Branch is currently referenced by catalog books or copies.', 'IN_USE');
    }
    service.state.branches = service.state.branches.filter((b) => b.branch_id !== id);
    service.recordAdminAudit(
      req.currentUser!,
      'Delete Branch',
      'branch',
      br.code,
      br.name,
      'Removed unused branch location.'
    );
    res.json({ deleted: true });
  });

  // Library Policy Settings
  app.get('/api/admin/settings', ...requireAdmin, (_req, res) => {
    res.json(service.state.librarySettings);
  });

  app.put('/api/admin/settings', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const b = req.body ?? {};
    const prev = service.state.librarySettings;
    const nextLoanDays = Math.max(
      1,
      Math.min(90, Number(b.loan_policy?.default_loan_duration_days ?? prev.loan_policy.default_loan_duration_days))
    );
    const nextMaxLoans = Math.max(
      1,
      Math.min(20, Number(b.loan_policy?.max_active_loans_per_student ?? prev.loan_policy.max_active_loans_per_student))
    );

    service.state.librarySettings = {
      loan_policy: {
        default_loan_duration_days: nextLoanDays,
        max_active_loans_per_student: nextMaxLoans,
        allow_renewal: Boolean(b.loan_policy?.allow_renewal ?? prev.loan_policy.allow_renewal),
        max_renewals_per_loan: Math.max(
          0,
          Number(b.loan_policy?.max_renewals_per_loan ?? prev.loan_policy.max_renewals_per_loan)
        ),
        renewal_extension_days: Math.max(
          1,
          Number(b.loan_policy?.renewal_extension_days ?? prev.loan_policy.renewal_extension_days)
        ),
      },
      reminder_policy: {
        days_before_due_reminder: Math.max(
          0,
          Number(b.reminder_policy?.days_before_due_reminder ?? prev.reminder_policy.days_before_due_reminder)
        ),
        send_due_date_reminder: Boolean(
          b.reminder_policy?.send_due_date_reminder ?? prev.reminder_policy.send_due_date_reminder
        ),
        overdue_reminder_frequency_days: Math.max(
          1,
          Number(
            b.reminder_policy?.overdue_reminder_frequency_days ??
              prev.reminder_policy.overdue_reminder_frequency_days
          )
        ),
        in_app_notifications_enabled: Boolean(
          b.reminder_policy?.in_app_notifications_enabled ??
            prev.reminder_policy.in_app_notifications_enabled
        ),
        email_notifications_enabled: Boolean(
          b.reminder_policy?.email_notifications_enabled ??
            prev.reminder_policy.email_notifications_enabled
        ),
      },
      reservation_policy: {
        reservations_enabled: Boolean(
          b.reservation_policy?.reservations_enabled ??
            prev.reservation_policy.reservations_enabled
        ),
        max_active_reservations_per_student: Math.max(
          1,
          Number(
            b.reservation_policy?.max_active_reservations_per_student ??
              prev.reservation_policy.max_active_reservations_per_student
          )
        ),
        pickup_window_hours: Math.max(
          4,
          Number(
            b.reservation_policy?.pickup_window_hours ??
              prev.reservation_policy.pickup_window_hours
          )
        ),
        expiry_behavior:
          b.reservation_policy?.expiry_behavior ?? prev.reservation_policy.expiry_behavior,
      },
      fine_policy: {
        fine_policy_enabled: Boolean(
          b.fine_policy?.fine_policy_enabled ?? prev.fine_policy.fine_policy_enabled
        ),
        fine_per_day_amount:
          b.fine_policy?.fine_per_day_amount !== undefined
            ? Number(b.fine_policy.fine_per_day_amount)
            : prev.fine_policy.fine_per_day_amount,
        grace_period_days: Math.max(
          0,
          Number(b.fine_policy?.grace_period_days ?? prev.fine_policy.grace_period_days)
        ),
        fine_currency_symbol: String(
          b.fine_policy?.fine_currency_symbol ?? prev.fine_policy.fine_currency_symbol
        ),
      },
      general_settings: {
        library_name: sanitizePlainText(
          String(b.general_settings?.library_name ?? prev.general_settings.library_name)
        ),
        contact_email: sanitizePlainText(
          String(b.general_settings?.contact_email ?? prev.general_settings.contact_email)
        ),
        contact_phone: sanitizePlainText(
          String(b.general_settings?.contact_phone ?? prev.general_settings.contact_phone)
        ),
        opening_hours: sanitizePlainText(
          String(b.general_settings?.opening_hours ?? prev.general_settings.opening_hours)
        ),
        address: sanitizePlainText(
          String(b.general_settings?.address ?? prev.general_settings.address)
        ),
      },
      updated_at: new Date().toISOString(),
      updated_by: req.currentUser!.full_name,
    };

    service.recordAdminAudit(
      req.currentUser!,
      'Update Library Policy Settings',
      'settings',
      'policy-global',
      'System Policy Configuration',
      `Updated loan duration=${nextLoanDays}d, max active loans=${nextMaxLoans}, pickup window=${service.state.librarySettings.reservation_policy.pickup_window_hours}h.`
    );
    res.json(service.state.librarySettings);
  });

  // Roles & Permissions
  app.put('/api/admin/roles/:roleKey', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const roleKey = String(req.params.roleKey);
    const role = service.state.roles.find((r) => r.role_key === roleKey);
    if (!role) throw new HttpError(404, 'Role not found.', 'NOT_FOUND');
    const perms = req.body?.permissions;
    if (!perms || typeof perms !== 'object') {
      throw new HttpError(400, 'Permissions object required.', 'INVALID_INPUT');
    }
    if (role.role_key === 'admin') {
      // Never allow admin to lock itself out of admin/role/settings permissions
      role.permissions = {
        ...role.permissions,
        ...perms,
        manage_roles: true,
        configure_settings: true,
        view_audit_logs: true,
      };
    } else {
      role.permissions = { ...role.permissions, ...perms };
    }
    role.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      req.currentUser!,
      'Update Role Permissions',
      'role',
      role.role_key,
      role.display_name,
      `Updated permission matrix for ${role.display_name}.`
    );
    res.json({ item: role });
  });

  // Admin Profile & Password
  app.put('/api/admin/profile', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    if (req.body?.full_name) user.full_name = sanitizePlainText(String(req.body.full_name));
    if (req.body?.designation) user.designation = sanitizePlainText(String(req.body.designation));
    if (req.body?.branch) user.branch = sanitizePlainText(String(req.body.branch));
    user.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      user,
      'Update Admin Profile',
      'profile',
      user.code,
      user.full_name,
      'Updated administrator profile metadata.'
    );
    res.json({ admin: service.buildSessionPayload(user).admin });
  });

  app.put('/api/admin/change-password', ...requireAdmin, (req: AuthenticatedRequest, res) => {
    const user = req.currentUser!;
    const current = String(req.body?.current_password ?? '');
    const nextPass = String(req.body?.new_password ?? '');
    if (!verifyPassword(current, user.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect.', 'INVALID_CURRENT_PASSWORD');
    }
    if (nextPass.length < 8) {
      throw new HttpError(400, 'New password must be at least 8 characters.', 'WEAK_PASSWORD');
    }
    user.password_hash = hashPassword(nextPass);
    user.updated_at = new Date().toISOString();
    service.recordAdminAudit(
      user,
      'Change Administrator Password',
      'profile',
      user.code,
      user.full_name,
      'Administrator password updated cleanly.'
    );
    res.json({ ok: true });
  });

  // Return JSON 404 for unknown /api/* routes (never fall through to HTML SPA fallback)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      error: 'API_NOT_FOUND',
      message: 'Requested API endpoint does not exist.',
    });
  });

  // Centralized JSON error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        error: err.code,
        message: err.message,
      });
      return;
    }
    console.error('Unhandled backend error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    });
  });

  return app;
}

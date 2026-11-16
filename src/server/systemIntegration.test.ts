import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createLibraryApp } from './createApp.ts';
import { LibraryService } from './libraryService.ts';
import { createSeedDatabaseState, reconcileBookCounts } from './seedData.ts';

interface ApiClient {
  baseUrl: string;
  cookie: string;
  request: <T = unknown>(
    method: string,
    urlPath: string,
    body?: unknown
  ) => Promise<{ status: number; data: T; headers: Headers }>;
}

function createApiClient(baseUrl: string): ApiClient {
  let cookie = '';
  return {
    baseUrl,
    get cookie() {
      return cookie;
    },
    async request<T = unknown>(method: string, urlPath: string, body?: unknown) {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (cookie) headers.Cookie = cookie;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const pair = setCookie.split(';')[0];
        if (pair.includes('=;') || pair.endsWith('=')) {
          cookie = '';
        } else {
          cookie = pair;
        }
      }

      const contentType = res.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json')
        ? ((await res.json()) as T)
        : ((await res.text()) as unknown as T);

      return { status: res.status, data, headers: res.headers };
    },
  };
}

async function startTestServer() {
  const service = new LibraryService({
    dbFilePath: null,
    initialState: createSeedDatabaseState(),
  });
  const app = createLibraryApp(service);
  // Mount the same static image handler as server.ts before SPA fallback
  app.use(
    '/src/assets/images',
    express.static(path.resolve(process.cwd(), 'src/assets/images'))
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    service,
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}

test('Security, RBAC, XSS sanitization, and static image asset serving', async () => {
  const { baseUrl, close } = await startTestServer();
  try {
    // 1. Static image asset verification
    for (const img of [
      '/src/assets/images/hero_smart_library_1794581525172.jpg',
      '/src/assets/images/book_cover_ai_foundations_1794581525664.jpg',
      '/src/assets/images/login_library_welcome_1794583845660.jpg',
    ]) {
      const imgRes = await fetch(`${baseUrl}${img}`);
      assert.equal(imgRes.status, 200, `Expected 200 for ${img}`);
      assert.match(imgRes.headers.get('content-type') ?? '', /image\/jpeg/);
    }

    // 2. Unauthenticated access blocked
    const anon = createApiClient(baseUrl);
    assert.equal((await anon.request('GET', '/api/student/dashboard')).status, 401);
    assert.equal((await anon.request('GET', '/api/librarian/books')).status, 401);
    assert.equal((await anon.request('GET', '/api/admin/workspace')).status, 401);

    // 3. Student role RBAC isolation
    const student = createApiClient(baseUrl);
    const sLogin = await student.request('POST', '/api/auth/login', {
      identifier: 'ananya.verma@university.edu',
      password: 'Student@123',
      requested_role: 'student',
    });
    assert.equal(sLogin.status, 200);
    assert.equal((await student.request('GET', '/api/librarian/books')).status, 403);
    assert.equal((await student.request('POST', '/api/librarian/borrowings', {})).status, 403);
    assert.equal((await student.request('GET', '/api/admin/workspace')).status, 403);
    assert.equal((await student.request('PUT', '/api/admin/settings', {})).status, 403);

    // 4. Librarian role RBAC isolation + no password_hash leaks + XSS sanitization
    const librarian = createApiClient(baseUrl);
    const lLogin = await librarian.request('POST', '/api/auth/login', {
      identifier: 'priya.nair@smartlibrary.edu',
      password: 'Librarian@123',
      requested_role: 'librarian',
    });
    assert.equal(lLogin.status, 200);
    assert.equal((await librarian.request('GET', '/api/admin/workspace')).status, 403);
    assert.equal((await librarian.request('PUT', '/api/admin/settings', {})).status, 403);

    const studentsDir = await librarian.request('GET', '/api/librarian/students');
    assert.equal(studentsDir.status, 200);
    assert.equal(JSON.stringify(studentsDir.data).includes('password_hash'), false);

    // XSS stripped in announcements & reviews
    const annRes = await librarian.request<{ item: { title: string; content: string } }>(
      'POST',
      '/api/librarian/announcements',
      {
        title: '<script>alert(1)</script>Exam Desk Hours',
        content: '<img src=x onerror=alert(1)>Library open until 10 PM.',
        category: 'Library Timings',
        priority: 'Normal',
        target_type: 'all_students',
        publish_mode: 'now',
      }
    );
    assert.equal(annRes.status, 201);
    assert.equal(annRes.data.item.title.includes('<script>'), false);
    assert.equal(annRes.data.item.content.includes('<img'), false);
  } finally {
    await close();
  }
});

test('End-to-End Scenarios 1-10 and Concurrent Last-Copy Protection', async () => {
  const { service, baseUrl, close } = await startTestServer();
  try {
    const librarian = createApiClient(baseUrl);
    assert.equal(
      (
        await librarian.request('POST', '/api/auth/login', {
          identifier: 'priya.nair@smartlibrary.edu',
          password: 'Librarian@123',
          requested_role: 'librarian',
        })
      ).status,
      200
    );

    const dashSummary = await librarian.request<{
      is_prototype_sample: boolean;
      librarian: { full_name: string; permissions: { can_issue_books: boolean } };
      metrics: { total_books_unique_titles: number; total_book_copies: number };
    }>('GET', '/api/librarian/dashboard/summary');
    assert.equal(dashSummary.status, 200);
    assert.equal(dashSummary.data.is_prototype_sample, false);
    assert.equal(typeof dashSummary.data.librarian.full_name, 'string');
    assert.equal(dashSummary.data.librarian.permissions.can_issue_books, true);
    assert.ok(dashSummary.data.metrics.total_books_unique_titles > 0);

    const [
      dashBor,
      dashRet,
      dashRes,
      dashInv,
      dashAlerts,
      dashAnn,
      dashAct,
      dashAnl,
      repSum,
    ] = await Promise.all([
      librarian.request<{ items: Array<{ shelf_location: string }> }>('GET', '/api/librarian/dashboard/recent-borrowings'),
      librarian.request<{ items: unknown[]; total_upcoming_or_overdue: number }>('GET', '/api/librarian/dashboard/expected-returns'),
      librarian.request<{ counts: { active_waiting: number }; items: unknown[] }>('GET', '/api/librarian/dashboard/reservations'),
      librarian.request<{ counts: { available_titles: number }; items: unknown[] }>('GET', '/api/librarian/dashboard/inventory-overview'),
      librarian.request<{ items: Array<{ action_route: string }> }>('GET', '/api/librarian/dashboard/alerts'),
      librarian.request<{ items: Array<{ description: string }> }>('GET', '/api/librarian/dashboard/announcements'),
      librarian.request<{ items: Array<{ activity_id: string }> }>('GET', '/api/librarian/dashboard/student-activity'),
      librarian.request<{ has_sufficient_data: boolean; most_borrowed_categories: unknown[] }>('GET', '/api/librarian/dashboard/analytics'),
      librarian.request<{ borrowings: unknown[]; capabilities: { can_export_csv: boolean } }>('GET', '/api/librarian/reports/summary'),
    ]);
    assert.equal(dashBor.status, 200);
    assert.ok(Array.isArray(dashBor.data.items));
    assert.equal(typeof dashRet.data.total_upcoming_or_overdue, 'number');
    assert.equal(typeof dashRes.data.counts.active_waiting, 'number');
    assert.equal(typeof dashInv.data.counts.available_titles, 'number');
    assert.ok(Array.isArray(dashAlerts.data.items));
    assert.ok(Array.isArray(dashAnn.data.items));
    assert.ok(Array.isArray(dashAct.data.items));
    assert.equal(dashAnl.data.has_sufficient_data, true);
    assert.ok(Array.isArray(dashAnl.data.most_borrowed_categories));
    assert.ok(Array.isArray(repSum.data.borrowings));
    assert.equal(repSum.data.capabilities.can_export_csv, true);

    const admin = createApiClient(baseUrl);
    assert.equal(
      (
        await admin.request('POST', '/api/auth/login', {
          identifier: 'arvind.mehta@smartlibrary.edu',
          password: 'Admin@123',
          requested_role: 'admin',
        })
      ).status,
      200
    );

    const rohan = createApiClient(baseUrl);
    assert.equal(
      (
        await rohan.request('POST', '/api/auth/login', {
          identifier: 'rohan.kulkarni@university.edu',
          password: 'Student@123',
          requested_role: 'student',
        })
      ).status,
      200
    );

    const kabir = createApiClient(baseUrl);
    assert.equal(
      (
        await kabir.request('POST', '/api/auth/login', {
          identifier: 'kabir.sharma@university.edu',
          password: 'Student@123',
          requested_role: 'student',
        })
      ).status,
      200
    );

    const ananya = createApiClient(baseUrl);
    assert.equal(
      (
        await ananya.request('POST', '/api/auth/login', {
          identifier: 'ananya.verma@university.edu',
          password: 'Student@123',
          requested_role: 'student',
        })
      ).status,
      200
    );

    // Scenario 7: Cold-start student Rohan recommendations (0 history/reviews -> is_cold_start = true)
    const rohanRecs = await rohan.request<{
      is_cold_start: boolean;
      because_you_read_anchor: unknown;
      items: Array<{ book_id: number; is_available: boolean }>;
    }>('GET', '/api/recommendations');
    assert.equal(rohanRecs.status, 200);
    assert.equal(rohanRecs.data.is_cold_start, true);
    assert.equal(rohanRecs.data.because_you_read_anchor, null);
    assert.ok(rohanRecs.data.items.length > 0);

    // Scenario 10: Admin updates default_loan_duration_days = 21
    const settingsRes = await admin.request('PUT', '/api/admin/settings', {
      loan_policy: { default_loan_duration_days: 21 },
    });
    assert.equal(settingsRes.status, 200);

    // Scenario 1: Librarian adds 1-copy book -> Issue -> Return -> Reading history synced
    const addBookRes = await librarian.request<{
      book_id: number;
      copies_created: number;
    }>('POST', '/api/librarian/books', {
      title: 'Distributed Systems Architecture',
      authors_display: 'Dr. Elena Brooks',
      isbn: '9780134857299',
      publication_year: 2025,
      category: 'Computer Science',
      subject: 'Systems Design',
      format: 'Hardcover',
      branch: 'Main Central Library',
      shelf: 'SYS-404',
      physical_copies: [
        {
          accession_number: 'LIB-TEST-9001',
          barcode: 'BC-LIBTEST9001',
          condition: 'New',
          status: 'Available',
        },
      ],
    });
    assert.equal(addBookRes.status, 201);
    assert.equal(addBookRes.data.copies_created, 1);
    const singleCopyBookId = addBookRes.data.book_id;

    // Issue single-copy book to Rohan -> verify due date honors updated 21-day policy
    const issueSingle = await librarian.request<{
      borrowing_id: number;
      issue_date: string;
      due_date: string;
    }>('POST', '/api/librarian/borrowings', {
      student_id: 1045,
      book_id: singleCopyBookId,
    });
    assert.equal(issueSingle.status, 201);
    const diffDays = Math.round(
      (new Date(issueSingle.data.due_date).getTime() -
        new Date(issueSingle.data.issue_date).getTime()) /
        86_400_000
    );
    assert.equal(diffDays, 21, 'Issue should use Admin-updated 21-day loan duration');

    // Return single copy -> verify copy available + Rohan reading history updated
    const retSingle = await librarian.request('POST', '/api/librarian/returns', {
      borrowing_id: issueSingle.data.borrowing_id,
      condition: 'Good',
    });
    assert.equal(retSingle.status, 200);
    const rohanHist = await rohan.request<{ items: Array<{ book_id: number }> }>(
      'GET',
      '/api/student/reading-history'
    );
    assert.ok(rohanHist.data.items.some((h) => h.book_id === singleCopyBookId));

    // Scenario 2: Book 105 has 5 copies -> issue 2 -> 3 remain available
    const book105Before = await librarian.request<{ book: { available_copies: number } }>(
      'GET',
      '/api/books/105'
    );
    assert.equal(book105Before.data.book.available_copies, 5);
    assert.equal(
      (await librarian.request('POST', '/api/librarian/borrowings', { student_id: 1045, book_id: 105 }))
        .status,
      201
    );
    assert.equal(
      (await librarian.request('POST', '/api/librarian/borrowings', { student_id: 1043, book_id: 105 }))
        .status,
      201
    );
    const book105After = await librarian.request<{ issued_copies: number; book: { available_copies: number } }>(
      'GET',
      '/api/books/105'
    );
    assert.equal(book105After.data.book.available_copies, 3);
    assert.equal(book105After.data.issued_copies, 2);

    // Scenario 3: Unavailable book 109 -> student borrow rejected (409)
    const borrow109 = await rohan.request('POST', '/api/borrowings', { book_id: 109 });
    assert.equal(borrow109.status, 409);

    // Scenario 5: Reserve unavailable book 109 -> return issued copy -> FIFO reservation promoted to Ready -> issued
    const res109 = await rohan.request<{ reservation_id: number; status: string }>(
      'POST',
      '/api/reservations',
      { book_id: 109 }
    );
    assert.equal(res109.status, 201);
    assert.equal(res109.data.status, 'Waiting');

    const activeLoansRes = await librarian.request<{
      items: Array<{ borrowing_id: number; book_id: number }>;
    }>('GET', '/api/librarian/borrowings/active');
    const loan109 = activeLoansRes.data.items.find((b) => b.book_id === 109);
    assert.ok(loan109, 'Expected an active loan for unavailable book 109');

    const return109 = await librarian.request('POST', '/api/librarian/returns', {
      borrowing_id: loan109.borrowing_id,
      condition: 'Good',
    });
    assert.equal(return109.status, 200);

    // Ananya (6002) joined queue earlier -> verify FIFO promoted 6002 first
    const ananyaResDetail = await librarian.request<{
      reservation: { status: string; assigned_copy_accession: string | null };
    }>('GET', '/api/librarian/reservations/6002');
    assert.equal(ananyaResDetail.data.reservation.status, 'Ready for Pickup');

    // When Ananya cancels her hold, the held copy advances FIFO to Rohan
    const cancelAnanya = await ananya.request('DELETE', '/api/reservations/6002');
    assert.equal(cancelAnanya.status, 200);

    const resDetail = await librarian.request<{
      reservation: { status: string; assigned_copy_accession: string | null };
    }>('GET', `/api/librarian/reservations/${res109.data.reservation_id}`);
    assert.equal(resDetail.data.reservation.status, 'Ready for Pickup');

    const issueReserved = await librarian.request('POST', '/api/librarian/borrowings', {
      student_id: 1045,
      book_id: 109,
      reservation_id: res109.data.reservation_id,
    });
    assert.equal(issueReserved.status, 201);

    // Scenario 6: Student rates/reviews book 102 -> rating recalculates
    const reviewRes = await ananya.request<{
      book_rating_average: number;
      book_rating_count: number;
    }>('POST', '/api/books/102/reviews', {
      rating: 5,
      review: 'Excellent neural networks reference!',
    });
    assert.equal(reviewRes.status, 200);
    assert.ok(reviewRes.data.book_rating_count >= 1);

    // Concurrency test: Two simultaneous borrow requests for the 1 remaining copy of singleCopyBookId
    const [raceA, raceB] = await Promise.all([
      rohan.request('POST', '/api/borrowings', { book_id: singleCopyBookId }),
      kabir.request('POST', '/api/borrowings', { book_id: singleCopyBookId }),
    ]);
    const raceStatuses = [raceA.status, raceB.status].sort((a, b) => a - b);
    assert.deepEqual(raceStatuses, [201, 409]);

    // Scenario 8: Unavailable book reflected cleanly on recommendations
    const ananyaRecs = await ananya.request<{
      items: Array<{ book_id: number; is_available: boolean; available_copies: number }>;
    }>('GET', '/api/recommendations');
    const recSingle = ananyaRecs.data.items.find((i) => i.book_id === singleCopyBookId);
    if (recSingle) {
      assert.equal(recSingle.is_available, false);
      assert.equal(recSingle.available_copies, 0);
    }

    // Scenario 4: Max active loans reached -> rejected
    // Reduce max active loans to 2 via admin settings and verify Kabir/Rohan hitting cap is rejected
    await admin.request('PUT', '/api/admin/settings', {
      loan_policy: { max_active_loans_per_student: 2 },
    });
    // Rohan currently has book 105, book 109, and possibly singleCopyBookId (>=2) -> next borrow blocked
    const overLimit = await rohan.request('POST', '/api/borrowings', { book_id: 107 });
    assert.equal(overLimit.status, 409);

    // Scenario 9: Overdue transition + scheduler reminder deduplication + bulk-remind
    const pastBorrowing = service.state.borrowings.find((b) => b.status === 'Issued');
    assert.ok(pastBorrowing);
    pastBorrowing.due_date = new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10);
    const sched1 = service.runScheduler(new Date());
    assert.ok(sched1.overdueUpdatedCount >= 1);
    const sched2 = service.runScheduler(new Date());
    assert.equal(sched2.overdueRemindersSent, 0, 'Scheduler must deduplicate overdue reminders');

    const overdueList = await librarian.request<{
      items: Array<{ borrowing_id: number }>;
    }>('GET', '/api/librarian/overdue');
    assert.ok(overdueList.data.items.length >= 1);

    // Verify Admin audit logs recorded policy update
    const ws = await admin.request<{
      auditLogs: Array<{ action: string }>;
    }>('GET', '/api/admin/workspace');
    assert.equal(ws.status, 200);
    assert.ok(ws.data.auditLogs.some((a) => a.action.includes('Policy Settings')));

    // Cleanup helper
    reconcileBookCounts(service.state, singleCopyBookId);
  } finally {
    await close();
  }
});

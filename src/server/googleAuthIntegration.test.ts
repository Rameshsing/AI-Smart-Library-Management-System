import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createLibraryApp } from './createApp.ts';
import { LibraryService } from './libraryService.ts';

async function startTestServer() {
  const authDebugLines: string[] = [];
  const service = new LibraryService({
    dbFilePath: null,
    authDebugLogger: (line) => authDebugLines.push(line),
  });
  const app = createLibraryApp(service, {
    verifyIdToken: async (idToken: string) => {
      if (idToken === 'valid_new_student') {
        return {
          uid: 'firebase_uid_new_1',
          email: 'google.student@university.edu',
          email_verified: true,
          name: 'Meera Patel',
        };
      }
      if (idToken === 'valid_existing_librarian') {
        return {
          uid: 'firebase_uid_lib_1',
          email: 'priya.nair@smartlibrary.edu',
          email_verified: true,
          name: 'Priya Nair',
        };
      }
      if (idToken === 'valid_unknown_user') {
        return {
          uid: 'firebase_uid_unknown_1',
          email: 'outsider@example.com',
          email_verified: true,
          name: 'Outsider',
        };
      }
      throw new Error('Invalid Firebase ID token');
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl, authDebugLines };
}

test('POST /api/auth/firebase-google verifies Firebase ID tokens and enforces RBAC', async () => {
  const { server, baseUrl, authDebugLines } = await startTestServer();
  try {
    // 1. Missing token rejected
    const missingRes = await fetch(`${baseUrl}/api/auth/firebase-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requested_role: 'student' }),
    });
    assert.equal(missingRes.status, 400);

    // 2. Invalid token rejected
    const badRes = await fetch(`${baseUrl}/api/auth/firebase-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'tampered', requested_role: 'student' }),
    });
    assert.equal(badRes.status, 401);

    // 3. Unknown user cannot escalate to admin or librarian via Google Sign-In
    const escalationRes = await fetch(`${baseUrl}/api/auth/firebase-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'valid_unknown_user', requested_role: 'admin' }),
    });
    assert.equal(escalationRes.status, 403);

    // 4. New Google student signs in cleanly and receives Bearer session token
    const studentRes = await fetch(`${baseUrl}/api/auth/firebase-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'valid_new_student', requested_role: 'student' }),
    });
    assert.equal(studentRes.status, 200);
    const studentPayload = (await studentRes.json()) as {
      authenticated: boolean;
      verified_role: string;
      session_token: string;
      user: { email: string; code: string };
    };
    assert.equal(studentPayload.authenticated, true);
    assert.equal(studentPayload.verified_role, 'student');
    assert.equal(studentPayload.user.email, 'google.student@university.edu');
    assert.ok(studentPayload.user.code.startsWith('STU-GGL-'));
    assert.ok(studentPayload.session_token);

    // Verify Bearer token accesses protected student endpoint
    const meRes = await fetch(`${baseUrl}/api/student/dashboard`, {
      headers: { Authorization: `Bearer ${studentPayload.session_token}` },
    });
    assert.equal(meRes.status, 200);

    // 5. Existing librarian signs in cleanly via Google email match
    const libRes = await fetch(`${baseUrl}/api/auth/firebase-google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: 'valid_existing_librarian', requested_role: 'librarian' }),
    });
    assert.equal(libRes.status, 200);
    const libPayload = (await libRes.json()) as { verified_role: string };
    assert.equal(libPayload.verified_role, 'librarian');

    assert.ok(authDebugLines.some((l) => l.includes('outcome=student_created_google')));
    assert.ok(authDebugLines.some((l) => l.includes('outcome=authenticated_google')));
  } finally {
    server.close();
  }
});

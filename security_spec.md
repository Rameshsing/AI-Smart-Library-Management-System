# Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Identity Integrity**: Every document in `/users/{userId}` and `/users/{userId}/private/{docId}` MUST bind its `uid` field strictly to `request.auth.uid` on creation and preserve `uid` immutably on update.
2. **Email Verification Mandate**: All mutations (`create`, `update`, `delete`) require `request.auth.token.email_verified == true`.
3. **Parent Integrity (Master Gate)**:
   - `/users/{userId}/private/{docId}` cannot exist without a valid parent document at `/users/{userId}`.
4. **PII Isolation (Split Collection)**: `email` and `studentCode` live exclusively in `/users/{userId}/private/contact`, never exposed on `/users/{userId}` and readable only by the owner or a verified admin.
5. **No Self-Assigned Admin Roles**: Regular users cannot create or modify `/admins/{adminUid}` or inject `role`/`isAdmin` shadow keys into `/users/{userId}`.
6. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and remain immutable on update; `updatedAt` must equal `request.time` on both create and update.

## 2. Attack Payloads (All Must Fail with PERMISSION_DENIED)

1. **Unauthenticated Read/Write**: Read `/users/user_1` or write `/users/user_1` with `request.auth == null`.
2. **Unverified Email Mutation**: Create `/users/user_1` with `request.auth.token.email_verified == false`.
3. **Spoofed Bootstrapped Admin**: Access another user's `/users/user_2/private/contact` with `email: "ramesh.s812758@gmail.com"` and `email_verified: false`.
4. **Cross-Tenant Profile Hijack**: Authenticated as `user_1`, create `/users/user_2` or set `uid: "user_2"`.
5. **Shadow Key / Privilege Escalation**: Create `/users/user_1` containing an extra key `isAdmin: true` or `role: "admin"` (`hasOnly` rejects).
6. **Self-Promotion in `/admins`**: Authenticated as non-admin `user_1`, create `/admins/user_1`.
7. **Orphaned Subcollection Write**: Create `/users/user_1/private/contact` before `/users/user_1` exists.
8. **ID Poisoning**: Create `/users/<200-char-invalid-id$!>` (fails `isValidId`).
9. **String/Array Resource Exhaustion**: Create `/users/user_1` with a 1,000-char `displayName` or 20-item `interests` array.
10. **Backdated Timestamp Tampering**: Create `/users/user_1` with `createdAt` set to a client-chosen timestamp instead of `request.time`, or alter `createdAt` during an `update`.

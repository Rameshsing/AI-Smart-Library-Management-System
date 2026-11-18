import path from 'node:path';
import type { LibraryDbState, UserRole } from './types.ts';

export type DatabaseEngine = 'sqlite' | 'local-json-store' | 'in-memory';

export interface DatabaseConnectionConfig {
  engine: DatabaseEngine;
  resolvedFilePath: string | null;
  sanitizedTarget: string;
  connectionSource: 'LIBRARY_DB_PATH' | 'default (.data/library.db)' | 'in-memory';
  externalDatabaseUrlConfigured: boolean;
  sanitizedDatabaseUrl: string | null;
  isEphemeralLocalStorage: boolean;
}

export const REQUIRED_DATABASE_MODELS = [
  'users',
  'sessions',
  'books',
  'copies',
  'borrowings',
  'reservations',
  'reviews',
  'recommendationFeedback',
  'notifications',
  'announcements',
  'categories',
  'subjects',
  'branches',
  'librarySettings',
  'roles',
  'auditLogs',
] as const;

export function sanitizeConnectionString(rawUrl: string | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.password) {
      parsed.password = '__REDACTED_PW__';
      return parsed.toString().replace(':__REDACTED_PW__@', ':[REDACTED]@');
    }
    return parsed.toString();
  } catch {
    return trimmed.replace(/:\/\/([^:@/]+):([^@/]+)@/g, '://$1:[REDACTED]@');
  }
}

export function resolveDatabaseConnectionConfig(
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd(),
  explicitDbFilePath?: string | null
): DatabaseConnectionConfig {
  const rawDatabaseUrl = env.DATABASE_URL?.trim();
  const sanitizedDatabaseUrl = sanitizeConnectionString(rawDatabaseUrl);

  if (explicitDbFilePath === null) {
    return {
      engine: 'in-memory',
      resolvedFilePath: null,
      sanitizedTarget: 'memory://library-db',
      connectionSource: 'in-memory',
      externalDatabaseUrlConfigured: Boolean(rawDatabaseUrl),
      sanitizedDatabaseUrl,
      isEphemeralLocalStorage: true,
    };
  }

  const configuredPath = explicitDbFilePath?.trim() || env.LIBRARY_DB_PATH?.trim();
  const resolvedFilePath = configuredPath
    ? path.resolve(cwd, configuredPath)
    : path.resolve(cwd, '.data/library.db');
  const engine: DatabaseEngine = resolvedFilePath.toLowerCase().endsWith('.json')
    ? 'local-json-store'
    : 'sqlite';

  return {
    engine,
    resolvedFilePath,
    sanitizedTarget: path.relative(cwd, resolvedFilePath) || resolvedFilePath,
    connectionSource: configuredPath ? 'LIBRARY_DB_PATH' : 'default (.data/library.db)',
    externalDatabaseUrlConfigured: Boolean(rawDatabaseUrl),
    sanitizedDatabaseUrl,
    isEphemeralLocalStorage: !rawDatabaseUrl,
  };
}

export interface DatabaseModelVerificationResult {
  valid: boolean;
  missingModels: string[];
  invalidUserIds: number[];
  modelCounts: Record<string, number>;
}

const ARRAY_MODELS: Array<Exclude<keyof LibraryDbState, 'version' | 'nextIds' | 'librarySettings'>> = [
  'users',
  'sessions',
  'books',
  'copies',
  'borrowings',
  'reservations',
  'reviews',
  'recommendationFeedback',
  'notifications',
  'announcements',
  'categories',
  'subjects',
  'branches',
  'roles',
  'auditLogs',
];

export function verifyDatabaseModels(state: Partial<LibraryDbState> | null | undefined): DatabaseModelVerificationResult {
  const missingModels: string[] = [];
  const invalidUserIds: number[] = [];
  const modelCounts: Record<string, number> = {};

  if (!state || typeof state !== 'object') {
    return {
      valid: false,
      missingModels: [...REQUIRED_DATABASE_MODELS],
      invalidUserIds,
      modelCounts,
    };
  }

  for (const modelName of ARRAY_MODELS) {
    const collection = state[modelName];
    if (!Array.isArray(collection)) {
      missingModels.push(modelName);
      modelCounts[modelName] = 0;
    } else {
      modelCounts[modelName] = collection.length;
    }
  }

  if (!state.librarySettings || typeof state.librarySettings !== 'object') {
    missingModels.push('librarySettings');
    modelCounts.librarySettings = 0;
  } else {
    modelCounts.librarySettings = 1;
  }

  if (Array.isArray(state.users)) {
    for (const user of state.users) {
      const hasValidId = typeof user?.user_id === 'number' && Number.isFinite(user.user_id);
      const hasValidRole =
        user?.role === 'student' || user?.role === 'librarian' || user?.role === 'admin';
      const hasValidEmail = typeof user?.email === 'string' && user.email.includes('@');
      const hasValidCode = typeof user?.code === 'string' && user.code.trim().length > 0;
      const hasScryptHash =
        typeof user?.password_hash === 'string' && user.password_hash.includes(':');
      if (!hasValidId || !hasValidRole || !hasValidEmail || !hasValidCode || !hasScryptHash) {
        if (hasValidId) {
          invalidUserIds.push(user.user_id);
        } else {
          invalidUserIds.push(-1);
        }
      }
    }
  }

  return {
    valid: missingModels.length === 0 && invalidUserIds.length === 0,
    missingModels,
    invalidUserIds,
    modelCounts,
  };
}

export interface AuthDbDebugEvent {
  operation: 'login_query' | 'register_query' | 'session_lookup' | 'startup_check';
  connected: boolean;
  engine: DatabaseEngine;
  target: string;
  identifier?: string;
  usersScanned: number;
  recordFound: boolean;
  userId?: number;
  role?: UserRole;
  accountStatus?: string;
  passwordVerified?: boolean;
  persisted?: boolean;
  queryDurationMs: number;
  outcome: string;
}

export function formatAuthDbDebugLog(event: AuthDbDebugEvent): string {
  const parts = [
    `[AUTH DEBUG]`,
    `op=${event.operation}`,
    `db_connected=${event.connected}`,
    `engine=${event.engine}`,
    `target=${event.target}`,
    `users_scanned=${event.usersScanned}`,
    `record_found=${event.recordFound}`,
    `query_ms=${event.queryDurationMs.toFixed(2)}`,
    `outcome=${event.outcome}`,
  ];

  if (event.identifier) {
    parts.push(`identifier=${JSON.stringify(event.identifier.trim().toLowerCase())}`);
  }
  if (event.userId !== undefined) {
    parts.push(`user_id=${event.userId}`);
  }
  if (event.role) {
    parts.push(`role=${event.role}`);
  }
  if (event.accountStatus) {
    parts.push(`status=${event.accountStatus}`);
  }
  if (event.passwordVerified !== undefined) {
    parts.push(`password_verified=${event.passwordVerified}`);
  }
  if (event.persisted !== undefined) {
    parts.push(`persisted=${event.persisted}`);
  }

  return parts.join(' ');
}

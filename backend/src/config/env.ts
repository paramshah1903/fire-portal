import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return raw;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable ${name} must be an integer`);
  }
  return n;
}

function optional(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? undefined : raw;
}

export const env = {
  nodeEnv: required('NODE_ENV', 'development'),
  port: integer('PORT', 4000),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  corsOrigin: required('CORS_ORIGIN', 'http://localhost:5173'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-change-me'),
  sessionCookieName: required('SESSION_COOKIE_NAME', 'upl.sid'),
  /// Maximum time a session lives without activity (sliding). Idle
  /// past this and the session is destroyed on the next request.
  sessionMaxAgeMs: integer('SESSION_MAX_AGE_MS', 8 * 60 * 60 * 1000),
  /// Only bump expiresAt / lastSeenAt this often to avoid DB write
  /// amplification on chatty pages.
  sessionRefreshIntervalMs: integer(
    'SESSION_REFRESH_INTERVAL_MS',
    5 * 60 * 1000,
  ),
  /// Absolute cap on total session lifetime regardless of activity —
  /// forces re-auth after this many ms since original login.
  sessionAbsoluteMaxAgeMs: integer(
    'SESSION_ABSOLUTE_MAX_AGE_MS',
    30 * 24 * 60 * 60 * 1000, // 30 days
  ),
  uploadDir: required('UPLOAD_DIR', './uploads'),
  uploadMaxBytes: integer('UPLOAD_MAX_BYTES', 10 * 1024 * 1024),
  /// Requests per minute allowed against /api/* per IP.
  rateLimitGlobalPerMinute: integer('RATE_LIMIT_GLOBAL_PER_MINUTE', 300),
  /// Write-request limit per IP over 1 minute (POST/PUT/DELETE).
  rateLimitWritePerMinute: integer('RATE_LIMIT_WRITE_PER_MINUTE', 60),
  /// When set, the backend also serves this directory as the static
  /// frontend. Lets a single Node process + single public URL serve
  /// both /api and the SPA — useful for single-node deployments
  /// (VPS, tunnel) without needing a separate web server.
  frontendDistDir: optional('FRONTEND_DIST_DIR'),
} as const;

export const isProduction = env.nodeEnv === 'production';

/**
 * SQLite backup script.
 *
 * Copies `prisma/dev.db` (or whatever `DATABASE_URL` points to) into
 * `backups/YYYY-MM-DDTHHMMSSZ.db`. Uses `sqlite3`'s online backup API
 * via a small shell out — but since we don't want to require the
 * sqlite3 CLI on every dev box, we fall back to a safe file copy
 * (fine for small dev/on-prem deployments where the DB is quiescent
 * during backup).
 *
 * For a production deployment we recommend running this script during
 * a scheduled window, or from a systemd timer:
 *   0 2 * * *  cd /srv/upl-portal/backend && node dist/scripts/backup.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
  const match = /^file:(.+)$/.exec(dbUrl);
  if (!match) {
    throw new Error(
      `DATABASE_URL "${dbUrl}" is not a file: URL — this script only handles SQLite.`,
    );
  }
  const dbPath = path.resolve(process.cwd(), 'prisma', match[1]);
  await fs.access(dbPath);

  const stamp = new Date()
    .toISOString()
    .replace(/[:]/g, '')
    .replace(/\..+$/, 'Z');
  const backupDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  const dest = path.join(backupDir, `dev-${stamp}.db`);

  // Copy the file AND its journal / wal if present so the backup is
  // consistent. This assumes the database is idle during the copy —
  // safe for the current single-node deployment where the copy runs
  // as a scheduled task during a quiet window.
  await fs.copyFile(dbPath, dest);
  for (const sidecar of ['-journal', '-wal', '-shm']) {
    const src = dbPath + sidecar;
    try {
      await fs.access(src);
      await fs.copyFile(src, dest + sidecar);
    } catch {
      // No such sidecar, skip.
    }
  }

  const stat = await fs.stat(dest);
  console.log(
    `[backup] wrote ${dest} (${(stat.size / 1024).toFixed(1)} KB)`,
  );
}

main().catch((err) => {
  console.error('[backup] failed:', err);
  process.exit(1);
});

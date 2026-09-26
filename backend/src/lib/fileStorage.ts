import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { badRequest } from './errors.js';

/**
 * Filesystem storage abstraction for uploaded inspection photos.
 *
 * Everything is scoped to `UPLOAD_DIR/inspections/<inspectionId>/`.
 * We never expose an absolute path to the client — attachments are
 * streamed via `GET /api/inspection-attachments/:id` which resolves
 * the row and then reads from disk. See docs/DATABASE.md for the
 * portability notes if we ever swap to object storage.
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploadDir);
const INSPECTION_SUBDIR = 'inspections';
const CORRECTIVE_ACTION_SUBDIR = 'corrective-actions';

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export interface StoredFile {
  storedFilename: string;
  absolutePath: string;
  sizeBytes: number;
}

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export function assertImageAcceptable(file: {
  mimetype: string;
  originalname: string;
  size: number;
}) {
  const mimeOk =
    ALLOWED_IMAGE_MIME.has(file.mimetype) || ALLOWED_EXT.test(file.originalname);
  if (!mimeOk) {
    throw badRequest(
      'Only JPEG, PNG, WEBP or HEIC images are accepted.',
      'UNSUPPORTED_IMAGE_TYPE',
    );
  }
  if (file.size <= 0) {
    throw badRequest('Empty file.', 'EMPTY_FILE');
  }
  if (file.size > env.uploadMaxBytes) {
    throw badRequest(
      `File exceeds the ${Math.round(env.uploadMaxBytes / 1024 / 1024)} MB limit.`,
      'FILE_TOO_LARGE',
    );
  }
}

function safeExt(originalName: string): string {
  const m = ALLOWED_EXT.exec(originalName);
  if (!m) return '.bin';
  return m[0].toLowerCase();
}

/**
 * Persist an uploaded file. `originalName` is stored on the DB row
 * for display purposes only. The on-disk filename is server-generated
 * so a malicious client cannot craft `../` or absolute paths.
 */
export async function storeInspectionAttachment(input: {
  inspectionId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<StoredFile> {
  // Basic invariant checks — the caller has usually validated via
  // assertImageAcceptable() but we defend in depth.
  if (!/^[A-Za-z0-9_-]+$/.test(input.inspectionId)) {
    throw badRequest('Invalid inspection id.', 'INVALID_INSPECTION_ID');
  }

  const dir = path.join(UPLOAD_ROOT, INSPECTION_SUBDIR, input.inspectionId);
  await ensureDir(dir);

  const ext = safeExt(input.originalName);
  const storedFilename = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${ext}`;
  const absolutePath = path.join(dir, storedFilename);

  // Ensure the resolved path is still inside the intended folder.
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    throw badRequest('Refusing to write outside upload directory.', 'PATH_TRAVERSAL');
  }

  await fs.writeFile(absolutePath, input.buffer, { mode: 0o640 });

  return {
    storedFilename,
    absolutePath,
    sizeBytes: input.buffer.length,
  };
}

/**
 * Resolve a stored file's absolute path from its row values. Never
 * accepts arbitrary paths — takes only ids/filenames stored in the DB.
 */
export function attachmentPathFor(
  inspectionId: string,
  storedFilename: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(inspectionId)) {
    throw badRequest('Invalid inspection id.', 'INVALID_INSPECTION_ID');
  }
  if (!/^[A-Za-z0-9._-]+$/.test(storedFilename)) {
    throw badRequest('Invalid stored filename.', 'INVALID_FILENAME');
  }
  const abs = path.resolve(
    path.join(UPLOAD_ROOT, INSPECTION_SUBDIR, inspectionId, storedFilename),
  );
  const expectedRoot = path.resolve(
    path.join(UPLOAD_ROOT, INSPECTION_SUBDIR, inspectionId),
  );
  if (!abs.startsWith(expectedRoot + path.sep)) {
    throw badRequest('Path traversal denied.', 'PATH_TRAVERSAL');
  }
  return abs;
}

/**
 * Corrective-action evidence storage. Same shape as the inspection
 * helpers but scoped to `uploads/corrective-actions/<caId>/`.
 */
export async function storeCorrectiveActionAttachment(input: {
  correctiveActionId: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}): Promise<StoredFile> {
  if (!/^[A-Za-z0-9_-]+$/.test(input.correctiveActionId)) {
    throw badRequest(
      'Invalid corrective action id.',
      'INVALID_CORRECTIVE_ACTION_ID',
    );
  }

  const dir = path.join(
    UPLOAD_ROOT,
    CORRECTIVE_ACTION_SUBDIR,
    input.correctiveActionId,
  );
  await ensureDir(dir);

  const ext = safeExt(input.originalName);
  const storedFilename = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}${ext}`;
  const absolutePath = path.join(dir, storedFilename);

  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(absolutePath);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    throw badRequest(
      'Refusing to write outside upload directory.',
      'PATH_TRAVERSAL',
    );
  }

  await fs.writeFile(absolutePath, input.buffer, { mode: 0o640 });

  return {
    storedFilename,
    absolutePath,
    sizeBytes: input.buffer.length,
  };
}

export function correctiveActionAttachmentPathFor(
  correctiveActionId: string,
  storedFilename: string,
): string {
  if (!/^[A-Za-z0-9_-]+$/.test(correctiveActionId)) {
    throw badRequest(
      'Invalid corrective action id.',
      'INVALID_CORRECTIVE_ACTION_ID',
    );
  }
  if (!/^[A-Za-z0-9._-]+$/.test(storedFilename)) {
    throw badRequest('Invalid stored filename.', 'INVALID_FILENAME');
  }
  const abs = path.resolve(
    path.join(
      UPLOAD_ROOT,
      CORRECTIVE_ACTION_SUBDIR,
      correctiveActionId,
      storedFilename,
    ),
  );
  const expectedRoot = path.resolve(
    path.join(UPLOAD_ROOT, CORRECTIVE_ACTION_SUBDIR, correctiveActionId),
  );
  if (!abs.startsWith(expectedRoot + path.sep)) {
    throw badRequest('Path traversal denied.', 'PATH_TRAVERSAL');
  }
  return abs;
}

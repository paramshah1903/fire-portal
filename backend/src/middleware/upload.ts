import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../lib/errors.js';

/**
 * In-memory multer for bulk-import spreadsheets. Files are small
 * (< a few MB of CSV/XLSX rows) and never persisted to disk — the
 * import controller parses them and returns a preview.
 */
const importStorage = multer.memoryStorage();

const ALLOWED_SPREADSHEET_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'text/plain',
]);

const ALLOWED_SPREADSHEET_EXT = /\.(csv|xlsx|xls)$/i;

export const equipmentImportUpload = multer({
  storage: importStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mimeOk =
      ALLOWED_SPREADSHEET_MIME.has(file.mimetype) ||
      ALLOWED_SPREADSHEET_EXT.test(file.originalname);
    if (!mimeOk) {
      cb(
        badRequest(
          'Only CSV, XLS, or XLSX files are accepted.',
          'UNSUPPORTED_FILE_TYPE',
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('file');

/**
 * In-memory multer for inspection photos. Files stream to disk via
 * fileStorage.ts after the controller has authorised the request and
 * resolved the inspection id — the upload middleware only enforces
 * a size cap and the accepted mime-types.
 */
const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export const inspectionPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = IMAGE_MIME.has(file.mimetype) || IMAGE_EXT.test(file.originalname);
    if (!ok) {
      cb(
        badRequest(
          'Only JPEG, PNG, WEBP or HEIC images are accepted.',
          'UNSUPPORTED_IMAGE_TYPE',
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single('file');

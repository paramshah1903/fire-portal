import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

/**
 * Generate a QR code payload that is:
 *   - short enough to fit densely on a printed label
 *   - URL-safe (uppercase hex)
 *   - unique in the equipment table (retries on the rare collision)
 *
 * The QR image is rendered client-side in Phase 4; this string is the
 * only thing encoded in it, together with an optional URL prefix.
 */
export async function generateUniqueQrCodeValue(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 'EQ-' + randomBytes(6).toString('hex').toUpperCase();
    const clash = await prisma.equipment.findUnique({
      where: { qrCodeValue: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error('Could not allocate a unique QR value after 5 attempts');
}

/**
 * Suggest a human-readable equipment code like FE-A-0007 based on the
 * type key, unit code, and the next sequence for that (type, unit).
 * Callers may override; the returned value is only a hint.
 */
export async function suggestEquipmentCode(
  typeKey: string,
  unitCode: string,
): Promise<string> {
  // Extract short prefix from the type key: "FIRE_EXTINGUISHER" → "FE"
  const shortType = typeKey
    .split('_')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();

  // Unit code often looks like "UNIT-A" — drop the "UNIT-" prefix if present.
  const shortUnit = unitCode.replace(/^UNIT-?/i, '').toUpperCase() || unitCode;

  const prefix = `${shortType}-${shortUnit}-`;

  const last = await prisma.equipment.findFirst({
    where: { equipmentCode: { startsWith: prefix } },
    orderBy: { equipmentCode: 'desc' },
    select: { equipmentCode: true },
  });

  const nextSeq =
    last && /\d+$/.test(last.equipmentCode)
      ? Number.parseInt(last.equipmentCode.match(/\d+$/)![0], 10) + 1
      : 1;

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

export const EQUIPMENT_STATUSES = [
  'ACTIVE',
  'UNDER_MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
] as const;

export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export function isEquipmentStatus(value: unknown): value is EquipmentStatus {
  return (
    typeof value === 'string' &&
    (EQUIPMENT_STATUSES as readonly string[]).includes(value)
  );
}

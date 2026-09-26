import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Minimal password policy for internal accounts.
 * Kept lightweight so that admins can set human-friendly demo
 * passwords; production deployments can tighten this.
 */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain a letter.';
  if (!/\d/.test(pw)) return 'Password must contain a digit.';
  return null;
}

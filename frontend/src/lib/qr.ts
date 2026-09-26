/**
 * Compute the payload that gets encoded into a QR image for a given
 * equipment `qrCodeValue`.
 *
 * By default we encode a URL of the form `${origin}/s/${value}` so that
 * any camera app opens the portal at the right equipment page. Callers
 * that want to encode just the raw value can override via
 * VITE_QR_PLAIN_PAYLOAD=true.
 */
export function qrPayload(qrCodeValue: string): string {
  if (import.meta.env.VITE_QR_PLAIN_PAYLOAD === 'true') {
    return qrCodeValue;
  }
  const prefix = import.meta.env.VITE_QR_URL_PREFIX;
  if (typeof prefix === 'string' && prefix.length > 0) {
    return `${prefix.replace(/\/$/, '')}/${qrCodeValue}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/s/${qrCodeValue}`;
  }
  return qrCodeValue;
}

/**
 * Extract the qrCodeValue from any input the scan page might receive:
 *   - "EQ-A1B2C3D4E5F6"
 *   - "https://portal.upl/s/EQ-A1B2C3D4E5F6"
 *   - "https://portal.upl/scan?value=EQ-A1B2C3D4E5F6"
 *   - "EQ-A1B2C3D4E5F6\n"
 * Returns the trimmed value, or null if it doesn't look like a QR value.
 */
export function parseScannedValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try to parse as URL.
  try {
    const url = new URL(trimmed);
    const fromQuery = url.searchParams.get('value');
    if (fromQuery) return fromQuery.trim();
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return decodeURIComponent(last);
  } catch {
    // Not a URL — fall through.
  }

  return trimmed;
}

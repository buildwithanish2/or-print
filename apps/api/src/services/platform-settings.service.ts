export const ADMIN_MANAGED_SETTING_KEYS = [
  'PRICE_CAP_A4_BW', 'PRICE_CAP_A4_COLOR', 'PLATFORM_SERVICE_FEE', 'GST_RATE',
  'STATS_SHOPS', 'STATS_DOCS', 'STATS_CUSTOMERS', 'STATS_CITIES',
] as const;

const numericKeys = new Set<string>(['PRICE_CAP_A4_BW', 'PRICE_CAP_A4_COLOR', 'PLATFORM_SERVICE_FEE', 'GST_RATE']);

export function validateAdminManagedSettings(input: unknown): { valid: true; values: Record<string, string> } | { valid: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, message: 'Settings must be a key/value object' };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) return { valid: false, message: 'Settings must not be empty' };

  const values: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (!(ADMIN_MANAGED_SETTING_KEYS as readonly string[]).includes(key) || typeof raw !== 'string' || !raw.trim() || raw.length > 120) {
      return { valid: false, message: `Invalid or unsupported platform setting: ${key}` };
    }
    if (numericKeys.has(key)) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || (key === 'GST_RATE' && value > 100)) {
        return { valid: false, message: `${key} must be a valid non-negative number${key === 'GST_RATE' ? ' no greater than 100' : ''}` };
      }
    }
    values[key] = raw.trim();
  }
  return { valid: true, values };
}

export function readStoredAdminUser(storage) {
  try {
    const source = storage || window.localStorage;
    const stored = source.getItem('printqr_admin_user');
    if (!stored) return null;

    const user = JSON.parse(stored);
    if (!user || typeof user !== 'object' || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return null;
    return user;
  } catch {
    // Corrupt or unavailable browser storage must not prevent the sign-in page from rendering.
    return null;
  }
}

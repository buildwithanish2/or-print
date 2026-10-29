export function getUsageIdentity(usage) {
  if (usage?.user && typeof usage.user.name === 'string' && usage.user.name.trim()) {
    return {
      name: usage.user.name,
      role: typeof usage.user.role === 'string' && usage.user.role ? usage.user.role : 'Customer',
    };
  }

  // Guest identity hashes are intentionally never exposed in the admin UI.
  return { name: 'Guest user', role: 'Guest' };
}

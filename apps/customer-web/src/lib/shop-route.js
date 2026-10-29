export function getShopSlugFromPath(pathname) {
  const match = /^\/print\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;

  try {
    const slug = decodeURIComponent(match[1]).trim();
    return slug && !slug.includes('/') ? slug : null;
  } catch {
    return null;
  }
}

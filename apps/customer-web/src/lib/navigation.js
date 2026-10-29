export function getNavigationPathname(path) {
  try {
    return new URL(path, 'https://customer-web.invalid').pathname;
  } catch {
    return '/';
  }
}

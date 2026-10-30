const isUsefulText = (value, minimumLength = 2) => typeof value === 'string'
  && value.trim().length >= minimumLength;

export function resolvePublicPlans(apiPlans) {
  if (!Array.isArray(apiPlans)) return [];

  const validPlans = apiPlans.filter((plan) => {
    if (!plan || !isUsefulText(plan.name) || !isUsefulText(plan.description, 10)) return false;
    if (/^(.)\1{2,}$/u.test(plan.name.trim())) return false;
    if (!Number.isFinite(Number(plan.priceMonthly)) || Number(plan.priceMonthly) <= 0) return false;
    if (!Number.isFinite(Number(plan.priceYearly)) || Number(plan.priceYearly) <= 0) return false;
    return !plan.name.toLowerCase().includes('demo');
  });

  return validPlans;
}

export function resolveAgentRelease(response) {
  const release = response?.data?.data;
  if (!response?.data?.success || !release || typeof release.latestVersion !== 'string'
    || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(release.latestVersion)
    || typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(release.sha256)
    || !Number.isSafeInteger(release.fileSize) || release.fileSize <= 0) {
    throw new Error('The Windows Agent release information is invalid. Retry or contact support.');
  }
  return release;
}

export function resolvePublicNavigation(apiItems, fallbackItems) {
  const items = Array.isArray(apiItems) && apiItems.length > 0 ? apiItems : fallbackItems;
  if (!Array.isArray(items)) return [];

  const seen = new Set();
  const uniqueItems = items.filter((item) => {
    if (!item || typeof item.label !== 'string' || !item.label.trim()) return false;
    const label = item.label.trim().toLowerCase().replace(/\s+/g, ' ');
    const identity = /\bcontact\b/.test(label)
      ? 'contact'
      : /\bpartner\b/.test(label)
        ? 'partner'
        : `${label}|${typeof item.path === 'string' ? item.path.trim().toLowerCase() : ''}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });

  return uniqueItems.length === items.length ? items : uniqueItems;
}

export function hasPublicNavigationTopic(items, topic) {
  const pattern = topic === 'contact' ? /\bcontact\b/i : topic === 'partner' ? /\bpartner\b/i : null;
  return Boolean(pattern && Array.isArray(items) && items.some((item) => pattern.test(item?.label || '')));
}

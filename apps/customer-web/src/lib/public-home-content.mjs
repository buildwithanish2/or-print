const isUsefulText = (value, minimumLength = 2) => typeof value === 'string'
  && value.trim().length >= minimumLength;

export function resolvePublicPlans(apiPlans, fallbackPlans) {
  if (!Array.isArray(apiPlans)) return fallbackPlans;

  const validPlans = apiPlans.filter((plan) => {
    if (!plan || !isUsefulText(plan.name) || !isUsefulText(plan.description, 10)) return false;
    if (/^(.)\1{2,}$/u.test(plan.name.trim())) return false;
    if (!Number.isFinite(Number(plan.priceMonthly)) || Number(plan.priceMonthly) <= 0) return false;
    if (!Number.isFinite(Number(plan.priceYearly)) || Number(plan.priceYearly) <= 0) return false;
    return !plan.name.toLowerCase().includes('demo');
  });

  return validPlans.length > 0 ? validPlans : fallbackPlans;
}

export function resolvePublicNavigation(apiItems, fallbackItems) {
  return Array.isArray(apiItems) && apiItems.length > 0 ? apiItems : fallbackItems;
}

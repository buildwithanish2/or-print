import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolvePublicNavigation, resolvePublicPlans } from '../src/lib/public-home-content.mjs';

const defaults = [
  { id: 'starter', name: 'Starter', description: 'For small print shops', priceMonthly: 649, priceYearly: 5990, features: [] },
  { id: 'pro', name: 'Pro', description: 'For growing print shops', priceMonthly: 799, priceYearly: 7490, features: [] },
];

test('invalid or empty API pricing keeps the established homepage plans visible', () => {
  const placeholder = [{ id: 'broken', name: 'fffff', description: 'geklo', priceMonthly: 0, priceYearly: 4990 }];
  assert.equal(resolvePublicPlans(placeholder, defaults), defaults);
  assert.equal(resolvePublicPlans([], defaults), defaults);
  assert.equal(resolvePublicPlans(undefined, defaults), defaults);
});

test('valid API pricing is used and demo plans are excluded', () => {
  const configured = [{ id: 'team', name: 'Team', description: 'For busy local print shops', priceMonthly: 1200, priceYearly: 12000, features: [] }];
  const result = resolvePublicPlans([...configured, { name: 'Demo', description: 'Demo plan', priceMonthly: 1, priceYearly: 1 }], defaults);
  assert.deepEqual(result, configured);
});

test('an empty public navigation response preserves the homepage navigation links', () => {
  const navigation = [{ id: 'pricing', label: 'Pricing', path: '#pricing' }];
  assert.equal(resolvePublicNavigation([], navigation), navigation);
  assert.equal(resolvePublicNavigation(undefined, navigation), navigation);
});

test('configured public navigation remains authoritative when available', () => {
  const configured = [{ id: 'features', label: 'Features', path: '#features' }];
  assert.equal(resolvePublicNavigation(configured, []), configured);
});

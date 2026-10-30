import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAgentRelease, resolvePublicNavigation, resolvePublicPlans } from '../src/lib/public-home-content.mjs';

const configured = [{ id: 'team', name: 'Team', description: 'For busy local print shops', priceMonthly: 1200, priceYearly: 12000, features: [] }];
const release = { latestVersion: '1.0.3', sha256: 'a'.repeat(64), fileSize: 2048 };

test('public pricing uses only valid API plans and never substitutes demo defaults', () => {
  assert.deepEqual(resolvePublicPlans(configured), configured);
  assert.deepEqual(resolvePublicPlans([...configured, { name: 'Demo', description: 'Demo plan', priceMonthly: 1, priceYearly: 1 }]), configured);
  assert.deepEqual(resolvePublicPlans([{ name: 'x', description: 'bad', priceMonthly: 0, priceYearly: 0 }]), []);
  assert.deepEqual(resolvePublicPlans(undefined), []);
  assert.deepEqual(resolvePublicPlans([]), []);
});

test('agent release version is taken only from validated API metadata', () => {
  assert.deepEqual(resolveAgentRelease({ data: { success: true, data: release } }), release);
  assert.throws(() => resolveAgentRelease({ data: { success: true, data: { ...release, latestVersion: 'v1.0.0' } } }), /release information is invalid/i);
  assert.throws(() => resolveAgentRelease({ data: { success: false } }), /release information is invalid/i);
  assert.throws(() => resolveAgentRelease({ data: { success: true, data: { ...release, sha256: 'old' } } }), /release information is invalid/i);
});

test('an empty public navigation response preserves the homepage navigation links', () => {
  const navigation = [{ id: 'pricing', label: 'Pricing', path: '#pricing' }];
  assert.equal(resolvePublicNavigation([], navigation), navigation);
  assert.equal(resolvePublicNavigation(undefined, navigation), navigation);
});

test('configured public navigation remains authoritative when available', () => {
  const navigation = [{ id: 'features', label: 'Features', path: '#features' }];
  assert.equal(resolvePublicNavigation(navigation, []), navigation);
});

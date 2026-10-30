import test from 'node:test';
import assert from 'node:assert/strict';
import { getShopPathForTab, getShopTabFromPath } from '../src/lib/shop-navigation.mjs';

test('shop dashboard sidebar sections have stable direct links', () => {
  for (const tab of ['overview', 'queue', 'orders', 'printers', 'qr', 'agent', 'pricing', 'staff', 'payments', 'college-free-printing', 'services', 'analytics', 'settings', 'support']) {
    assert.equal(getShopTabFromPath(getShopPathForTab(tab)), tab);
  }
});

test('direct links, refreshes, and browser history resolve the matching section', () => {
  assert.equal(getShopTabFromPath('/orders/'), 'orders');
  assert.equal(getShopTabFromPath('/college-free-printing'), 'college-free-printing');
  assert.equal(getShopTabFromPath('/'), 'overview');
});

test('unknown paths safely open the overview section', () => {
  assert.equal(getShopTabFromPath('/not-a-dashboard-page'), 'overview');
});

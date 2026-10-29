import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminPathForTab, getAdminTabFromPath } from '../src/lib/admin-navigation.mjs';
import { readStoredAdminUser } from '../src/lib/admin-session.mjs';
import { getUsageIdentity } from '../src/lib/usage-display.mjs';

test('College sidebar navigation resolves to the College management page', () => {
  assert.equal(getAdminPathForTab('college-free-printing'), '/college-free-printing');
  assert.equal(getAdminTabFromPath('/college-free-printing'), 'college-free-printing');
});

test('direct College URL and trailing slash survive route resolution for refresh and history', () => {
  assert.equal(getAdminTabFromPath('/college-free-printing/'), 'college-free-printing');
  assert.equal(getAdminTabFromPath('/'), 'overview');
});

test('unknown routes safely resolve to overview without a false College match', () => {
  assert.equal(getAdminTabFromPath('/not-a-page'), 'overview');
});

test('broken saved admin session data falls back to login instead of crashing the page', () => {
  assert.equal(readStoredAdminUser({ getItem: () => '{broken-json' }), null);
  assert.equal(readStoredAdminUser({ getItem: () => JSON.stringify({ role: 'SHOP_OWNER' }) }), null);
  assert.equal(readStoredAdminUser({ getItem: () => { throw new Error('storage unavailable'); } }), null);
});

test('valid administrator session data is restored', () => {
  assert.deepEqual(readStoredAdminUser({ getItem: () => JSON.stringify({ id: 'admin-1', role: 'SUPER_ADMIN' }) }), { id: 'admin-1', role: 'SUPER_ADMIN' });
});

test('guest allowance records render without a linked account or exposing the identity hash', () => {
  assert.deepEqual(getUsageIdentity({ user: null, guestIdentityHash: 'private-hash' }), { name: 'Guest user', role: 'Guest' });
  assert.deepEqual(getUsageIdentity({}), { name: 'Guest user', role: 'Guest' });
});

test('registered allowance records display their linked account', () => {
  assert.deepEqual(getUsageIdentity({ user: { name: 'A Student', role: 'STUDENT' } }), { name: 'A Student', role: 'STUDENT' });
});

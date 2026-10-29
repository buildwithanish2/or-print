import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminPathForTab, getAdminTabFromPath } from '../src/lib/admin-navigation.mjs';

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

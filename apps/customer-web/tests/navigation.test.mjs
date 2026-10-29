import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNavigationPathname } from '../src/lib/navigation.js';

test('tracking query token stays out of the route pathname and order reference', () => {
  assert.equal(getNavigationPathname('/track/ANP-526177?token=trk_private'), '/track/ANP-526177');
});

test('shop navigation keeps its pathname while query and fragment remain URL state', () => {
  assert.equal(getNavigationPathname('/print/hlop?source=qr#upload'), '/print/hlop');
});

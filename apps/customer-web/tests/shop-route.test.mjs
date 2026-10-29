import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getShopSlugFromPath } from '../src/lib/shop-route.js';

test('customer route preserves the supplied canonical shop slug', () => {
  assert.equal(getShopSlugFromPath('/print/hlop'), 'hlop');
  assert.equal(getShopSlugFromPath('/print/a-different-shop'), 'a-different-shop');
});

test('missing, malformed, and nested shop routes do not fall back to a demo shop', () => {
  assert.equal(getShopSlugFromPath('/print/'), null);
  assert.equal(getShopSlugFromPath('/print/%2F'), null);
  assert.equal(getShopSlugFromPath('/print/%E0%A4%A'), null);
  assert.equal(getShopSlugFromPath('/print/shop/extra'), null);
});

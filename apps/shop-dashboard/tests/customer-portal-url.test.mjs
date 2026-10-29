import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCustomerPrintUrl, PRODUCTION_CUSTOMER_PORTAL_URL, resolveCustomerPortalBaseUrl } from '../src/lib/customer-portal-url.js';

const customerBaseUrl = 'https://customer-web-six-livid.vercel.app/';

test('opens the configured shop slug on the production customer portal', () => {
  assert.equal(
    buildCustomerPrintUrl(customerBaseUrl, 'hlop', true),
    'https://customer-web-six-livid.vercel.app/print/hlop',
  );
});

test('uses a different authenticated shop slug without hardcoding a shop', () => {
  assert.equal(
    buildCustomerPrintUrl(customerBaseUrl, 'northside-print', true),
    'https://customer-web-six-livid.vercel.app/print/northside-print',
  );
});

test('does not create a customer URL when the shop slug is missing', () => {
  assert.equal(buildCustomerPrintUrl(customerBaseUrl, undefined, true), null);
  assert.equal(buildCustomerPrintUrl(customerBaseUrl, '  ', true), null);
});

test('encodes the slug and avoids duplicate slashes', () => {
  assert.equal(
    buildCustomerPrintUrl('https://customer.example///', 'north & west', true),
    'https://customer.example/print/north%20%26%20west',
  );
});

test('production URLs reject localhost while local development URLs remain usable', () => {
  assert.equal(buildCustomerPrintUrl('http://localhost:5173', 'hlop', true), null);
  assert.equal(buildCustomerPrintUrl('https://127.0.0.1:5173', 'hlop', true), null);
  assert.equal(
    buildCustomerPrintUrl('http://localhost:5173/', 'hlop', false),
    'http://localhost:5173/print/hlop',
  );
});

test('production base URL falls back from a localhost Vercel value to the deployed customer app', () => {
  assert.equal(
    resolveCustomerPortalBaseUrl('http://localhost:5173', true),
    PRODUCTION_CUSTOMER_PORTAL_URL,
  );
  assert.equal(resolveCustomerPortalBaseUrl(undefined, true), PRODUCTION_CUSTOMER_PORTAL_URL);
  assert.equal(resolveCustomerPortalBaseUrl('http://localhost:5173', false), 'http://localhost:5173');
});

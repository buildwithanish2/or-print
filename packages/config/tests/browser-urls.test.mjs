import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTION_API_BASE_URL,
  PRODUCTION_ADMIN_WEB_URL,
  PRODUCTION_CUSTOMER_WEB_URL,
  PRODUCTION_SHOP_WEB_URL,
  resolvePublicApiBaseUrl,
  resolvePublicPortalUrl,
  resolvePublicSocketUrl,
} from '../browser-urls.mjs';

test('production API URL rejects missing, local, and insecure configuration', () => {
  assert.equal(resolvePublicApiBaseUrl(undefined, true), PRODUCTION_API_BASE_URL);
  assert.equal(resolvePublicApiBaseUrl('http://localhost:5000/api', true), PRODUCTION_API_BASE_URL);
  assert.equal(resolvePublicApiBaseUrl('https://127.0.0.1/api', true), PRODUCTION_API_BASE_URL);
  assert.equal(resolvePublicApiBaseUrl('https://api.example.test/api/', true), 'https://api.example.test/api');
});

test('production socket URL falls back to the configured or production API origin', () => {
  assert.equal(resolvePublicSocketUrl(undefined, 'https://api.example.test/api', true), 'https://api.example.test');
  assert.equal(resolvePublicSocketUrl('http://localhost:5000', undefined, true), 'https://api.anishnova.com');
  assert.equal(resolvePublicSocketUrl('https://socket.example.test/path', undefined, true), 'https://socket.example.test');
});

test('local development retains explicit localhost endpoints', () => {
  assert.equal(resolvePublicApiBaseUrl('http://localhost:5000/api', false), 'http://localhost:5000/api');
  assert.equal(resolvePublicSocketUrl(undefined, undefined, false), 'http://localhost:5000');
});

test('production portal navigation rejects localhost while development can use localhost', () => {
  assert.equal(resolvePublicPortalUrl('http://localhost:5174', true, PRODUCTION_SHOP_WEB_URL, 'http://localhost:5174'), PRODUCTION_SHOP_WEB_URL);
  assert.equal(resolvePublicPortalUrl(undefined, true, PRODUCTION_CUSTOMER_WEB_URL, 'http://localhost:5173'), PRODUCTION_CUSTOMER_WEB_URL);
  assert.equal(resolvePublicPortalUrl('https://admin.example.test/', true, PRODUCTION_ADMIN_WEB_URL, 'http://localhost:5175'), 'https://admin.example.test');
  assert.equal(resolvePublicPortalUrl(undefined, false, PRODUCTION_SHOP_WEB_URL, 'http://localhost:5174'), 'http://localhost:5174');
});

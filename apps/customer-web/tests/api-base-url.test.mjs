import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRODUCTION_API_BASE_URL, resolveApiBaseUrl } from '../src/lib/api-base-url.js';

test('customer production API uses the configured HTTPS backend and trims trailing slashes', () => {
  assert.equal(resolveApiBaseUrl('https://api.anishnova.com/api/', true), 'https://api.anishnova.com/api');
});

test('customer production API falls back to the deployed API rather than localhost', () => {
  assert.equal(resolveApiBaseUrl(undefined, true), PRODUCTION_API_BASE_URL);
  assert.equal(resolveApiBaseUrl('http://localhost:5000/api', true), PRODUCTION_API_BASE_URL);
  assert.equal(resolveApiBaseUrl('https://127.0.0.1/api', true), PRODUCTION_API_BASE_URL);
});

test('local development can keep using its configured or default API URL', () => {
  assert.equal(resolveApiBaseUrl('http://localhost:5000/api', false), 'http://localhost:5000/api');
  assert.equal(resolveApiBaseUrl(undefined, false), 'http://localhost:5000/api');
});

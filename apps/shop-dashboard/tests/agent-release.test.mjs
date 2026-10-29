import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAgentReleaseRequestConfig, getAgentInstallerUrl, parseAgentReleaseResponse } from '../src/lib/agent-release.ts';

const apiBase = 'https://api.anishnova.com/api';
const releaseResponse = {
  success: true,
  data: {
    latestVersion: '1.0.2',
    minimumSupportedVersion: '1.0.2',
    downloadUrl: 'https://api.anishnova.com/api/admin/agents/download/binary/latest',
  },
};

test('dashboard release label and installer URL come from the current API release manifest', () => {
  const release = parseAgentReleaseResponse(releaseResponse, apiBase);
  assert.equal(release.latestVersion, '1.0.2');
  assert.equal(release.minimumSupportedVersion, '1.0.2');
  assert.equal(release.downloadUrl, releaseResponse.data.downloadUrl);
  assert.equal(getAgentInstallerUrl(apiBase), 'https://api.anishnova.com/api/admin/agents/download/latest');
});

test('release refresh uses a cache-busting query without CORS-blocked request headers', () => {
  const config = createAgentReleaseRequestConfig(12345);
  assert.deepEqual(config, { params: { channel: 'stable', refresh: 12345 } });
  assert.equal('headers' in config, false);
});

test('malformed, missing, and failed release manifests are rejected instead of showing a hardcoded version', () => {
  assert.throws(() => parseAgentReleaseResponse(null, apiBase), /invalid response/i);
  assert.throws(() => parseAgentReleaseResponse({ success: true, data: {} }, apiBase), /invalid version/i);
  assert.throws(() => parseAgentReleaseResponse({ success: false }, apiBase), /did not provide/i);
});

test('release manifest cannot send the dashboard download to another host or path', () => {
  assert.throws(() => parseAgentReleaseResponse({
    ...releaseResponse,
    data: { ...releaseResponse.data, downloadUrl: 'https://attacker.example/agent.exe' },
  }, apiBase), /unexpected download location/i);
});

test('production release and installer URLs must use HTTPS', () => {
  assert.throws(() => parseAgentReleaseResponse(releaseResponse, 'http://api.anishnova.com/api'), /unexpected download location/i);
  assert.equal(
    getAgentInstallerUrl('http://localhost:5000/api'),
    'http://localhost:5000/api/admin/agents/download/latest',
  );
});

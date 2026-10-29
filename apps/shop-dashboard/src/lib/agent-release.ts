export interface AgentRelease {
  latestVersion: string;
  minimumSupportedVersion: string;
  downloadUrl: string;
}

export function createAgentReleaseRequestConfig(refreshKey: number) {
  return { params: { channel: 'stable', refresh: refreshKey } };
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

export function parseAgentReleaseResponse(payload: unknown, apiBaseUrl: string): AgentRelease {
  if (!payload || typeof payload !== 'object') throw new Error('The release service returned an invalid response.');

  const response = payload as { success?: unknown; data?: Record<string, unknown> };
  const data = response.data;
  if (response.success !== true || !data || typeof data !== 'object') {
    throw new Error('The release service did not provide release information.');
  }

  const latestVersion = data.latestVersion;
  const minimumSupportedVersion = data.minimumSupportedVersion;
  if (typeof latestVersion !== 'string' || !VERSION_PATTERN.test(latestVersion)
    || typeof minimumSupportedVersion !== 'string' || !VERSION_PATTERN.test(minimumSupportedVersion)) {
    throw new Error('The release service returned invalid version information.');
  }

  const apiBase = new URL(`${apiBaseUrl.replace(/\/+$/, '')}/`);
  const downloadUrl = new URL(String(data.downloadUrl || ''));
  const expectedPath = new URL('admin/agents/download/binary/latest', apiBase);
  const allowsInsecureLoopback = apiBase.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(apiBase.hostname);

  if ((!allowsInsecureLoopback && apiBase.protocol !== 'https:')
    || downloadUrl.origin !== apiBase.origin
    || downloadUrl.pathname !== expectedPath.pathname
    || downloadUrl.search
    || downloadUrl.hash
    || downloadUrl.username
    || downloadUrl.password) {
    throw new Error('The release service returned an unexpected download location.');
  }

  return { latestVersion, minimumSupportedVersion, downloadUrl: downloadUrl.href };
}

export function getAgentInstallerUrl(apiBaseUrl: string): string {
  return new URL('admin/agents/download/latest', `${apiBaseUrl.replace(/\/+$/, '')}/`).href;
}

import fs from 'fs';
import path from 'path';

export interface AgentReleaseManifest {
  latestVersion: string;
  minimumSupportedVersion: string;
  mandatory: boolean;
  releaseDate: string;
  channel: string;
  signatureRequired?: boolean;
  releaseNotes: string[];
  installer: { fileName: string; fileSize: number; sha256: string };
  binary: { fileName: string; fileSize: number; sha256: string };
}

export interface AgentArtifact {
  filePath: string;
  fileName: string;
  fileSize: number;
}

export function agentArtifactDownloadHeaders(fileSize: number, downloadName: string): Record<string, string | number> {
  return {
    'Content-Disposition': `attachment; filename="${downloadName}"`,
    'Content-Type': 'application/vnd.microsoft.portable-executable',
    'Content-Length': fileSize,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function canDispatchPrintJob(input: { jobStatus: string; paymentStatus: string; printStatus: string; printerStatus: string }) {
  return input.jobStatus === 'QUEUED'
    && ['PAID', 'NOT_REQUIRED'].includes(input.paymentStatus)
    && !['CANCELLED', 'COMPLETED'].includes(input.printStatus)
    && input.printerStatus === 'ONLINE';
}

/** This agent can confirm spooler acceptance, not physical output completion. */
export function canAgentReportStatus(currentStatus: string, nextStatus: string) {
  if (['COMPLETED', 'FAILED'].includes(currentStatus)) return false;
  if (nextStatus === 'DOWNLOADING') return currentStatus === 'DOWNLOADING';
  if (nextStatus === 'PRINTING') return ['DOWNLOADING', 'PRINTING'].includes(currentStatus);
  if (nextStatus === 'SENT_TO_SPOOLER') return ['DOWNLOADING', 'PRINTING', 'SENT_TO_SPOOLER'].includes(currentStatus);
  if (nextStatus === 'FAILED') return ['DOWNLOADING', 'PRINTING', 'SENT_TO_SPOOLER'].includes(currentStatus);
  return false;
}

export const AGENT_JOB_CLAIM_LEASE_MS = 15 * 60 * 1000;
export const AGENT_JOB_IN_FLIGHT_STATUSES = ['DOWNLOADING', 'PRINTING', 'SENT_TO_SPOOLER'] as const;

export function getStaleAgentJobCutoff(now = new Date()): Date {
  return new Date(now.getTime() - AGENT_JOB_CLAIM_LEASE_MS);
}

export function isAgentStatusReportIdempotent(currentStatus: string, nextStatus: string): boolean {
  return currentStatus === nextStatus && ['DOWNLOADING', 'SENT_TO_SPOOLER', 'PRINTING', 'FAILED'].includes(nextStatus);
}

const DOWNLOADS_DIR = path.resolve(__dirname, '../../public/downloads');
const MINIMUM_EXECUTABLE_SIZE = 1024 * 1024;

function isPeExecutable(filePath: string): boolean {
  try {
    const descriptor = fs.openSync(filePath, 'r');
    try {
      const signature = Buffer.alloc(2);
      return fs.readSync(descriptor, signature, 0, signature.length, 0) === 2 && signature[0] === 0x4d && signature[1] === 0x5a;
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    return false;
  }
}

export function readAgentReleaseManifest(downloadsDir = DOWNLOADS_DIR): AgentReleaseManifest | null {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(downloadsDir, 'agent-release.json'), 'utf8')) as AgentReleaseManifest;
    const validVersion = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
    const validArtifact = (artifact: AgentReleaseManifest['installer'] | undefined, expectedFileName: string) =>
      !!artifact && artifact.fileName === expectedFileName && Number.isSafeInteger(artifact.fileSize) && artifact.fileSize >= MINIMUM_EXECUTABLE_SIZE && /^[a-f0-9]{64}$/i.test(artifact.sha256);

    if (!manifest || !validVersion.test(manifest.latestVersion) || !validVersion.test(manifest.minimumSupportedVersion)
      || (manifest.signatureRequired !== undefined && typeof manifest.signatureRequired !== 'boolean')
      || !validArtifact(manifest.installer, 'AnishNovaPrintAgent-Setup.exe')
      || !validArtifact(manifest.binary, 'PrintQRAgent.exe')) return null;

    return manifest;
  } catch {
    return null;
  }
}

export function resolveAgentArtifact(kind: 'installer' | 'binary', downloadsDir = DOWNLOADS_DIR): AgentArtifact | null {
  const manifest = readAgentReleaseManifest(downloadsDir);
  if (!manifest) return null;
  const metadata = manifest[kind];
  const filePath = path.join(downloadsDir, metadata.fileName);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size !== metadata.fileSize || stat.size < MINIMUM_EXECUTABLE_SIZE || !isPeExecutable(filePath)) return null;
    return { filePath, fileName: metadata.fileName, fileSize: stat.size };
  } catch {
    return null;
  }
}

export function agentReleaseMetadata(downloadsDir = DOWNLOADS_DIR) {
  const manifest = readAgentReleaseManifest(downloadsDir);
  if (!manifest || !resolveAgentArtifact('installer', downloadsDir) || !resolveAgentArtifact('binary', downloadsDir)) return null;
  return manifest;
}

export function agentDownloadsDirectoryForTests() {
  return DOWNLOADS_DIR;
}

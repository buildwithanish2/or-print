const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const expectedVersion = process.argv[2];
const directory = path.resolve(process.argv[3] || path.join(__dirname, '../public/downloads'));
const manifestPath = path.join(directory, 'agent-release.json');
if (!fs.existsSync(manifestPath)) throw new Error('Print agent release manifest is missing. Run the Windows release build before building the API image.');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.latestVersion || '')
  || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.minimumSupportedVersion || '')) {
  throw new Error('Print agent release version metadata is invalid.');
}
if (expectedVersion && manifest.latestVersion !== expectedVersion) {
  throw new Error(`Expected print agent ${expectedVersion}, found ${manifest.latestVersion}.`);
}
if (manifest.installer?.fileName !== 'AnishNovaPrintAgent-Setup.exe' || manifest.binary?.fileName !== 'PrintQRAgent.exe') {
  throw new Error('Print agent release metadata is invalid.');
}

function verifyArtifact(artifact, fileName) {
  if (!artifact || artifact.fileName !== fileName) throw new Error(`Print agent release metadata is invalid for ${fileName}.`);
  const filePath = path.join(directory, artifact.fileName);
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  try {
    const signature = Buffer.alloc(2);
    if (fs.readSync(fd, signature, 0, 2, 0) !== 2 || signature[0] !== 0x4d || signature[1] !== 0x5a) throw new Error(`Print agent artifact is not a Windows executable: ${artifact.fileName}`);
  } finally { fs.closeSync(fd); }
  if (stat.size < 1024 * 1024 || stat.size !== artifact.fileSize) throw new Error(`Print agent artifact size does not match release metadata: ${artifact.fileName}`);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  if (digest !== String(artifact.sha256).toLowerCase()) throw new Error(`Print agent artifact checksum does not match release metadata: ${artifact.fileName}`);
  return { stat, digest };
}
const installer = verifyArtifact(manifest.installer, 'AnishNovaPrintAgent-Setup.exe');
const binary = verifyArtifact(manifest.binary, 'PrintQRAgent.exe');

for (const [fileName, canonical] of [
  [`AnishNovaPrintAgent-Setup-${manifest.latestVersion}.exe`, installer],
  [`PrintQRAgent-${manifest.latestVersion}.exe`, binary],
]) {
  const versionedPath = path.join(directory, fileName);
  const stat = fs.statSync(versionedPath);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(versionedPath)).digest('hex');
  if (stat.size !== canonical.stat.size || digest !== canonical.digest) {
    throw new Error(`Versioned print agent artifact does not match its stable artifact: ${fileName}`);
  }
}

if (process.platform === 'win32') {
  const result = spawnSync(path.join(directory, manifest.installer.fileName), ['--verify-agent-payload'], {
    windowsHide: true,
    timeout: 30000,
    stdio: 'ignore',
  });
  if (result.error || result.status !== 0) throw new Error('The installer does not contain the agent payload identified by its build metadata.');
} else {
  console.warn('Embedded installer payload runtime check skipped: verify-agent-release.cjs must be run on Windows for this check.');
}
console.log(`Verified Windows print agent release ${manifest.latestVersion}.`);

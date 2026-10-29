const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const directory = path.resolve(__dirname, '../public/downloads');
const manifestPath = path.join(directory, 'agent-release.json');
if (!fs.existsSync(manifestPath)) throw new Error('Print agent release manifest is missing. Run the Windows release build before building the API image.');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
for (const artifact of [manifest.installer, manifest.binary]) {
  if (!artifact || !['AnishNovaPrintAgent-Setup.exe', 'PrintQRAgent.exe'].includes(artifact.fileName)) throw new Error('Print agent release metadata is invalid.');
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
}
console.log(`Verified Windows print agent release ${manifest.latestVersion}.`);

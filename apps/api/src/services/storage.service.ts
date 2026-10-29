import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../prisma';

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface StorageProvider {
  saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<{ key: string; url: string }>;
  getFileStream(key: string): fs.ReadStream;
  deleteFile(key: string): Promise<boolean>;
  getFilePath(key: string): string;
  startEphemeralShredder(): void;
}

class LocalStorageService implements StorageProvider {
  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<{ key: string; url: string }> {
    const ext = path.extname(originalName) || '.bin';
    const key = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, key);

    await fs.promises.writeFile(filePath, buffer);
    const url = `/api/files/download/${key}`;

    return { key, url };
  }

  getFileStream(key: string): fs.ReadStream {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on storage');
    }
    return fs.createReadStream(filePath);
  }

  getFilePath(key: string): string {
    // Sanitize key against directory traversal
    const safeKey = path.basename(key);
    return path.join(UPLOAD_DIR, safeKey);
  }

  async deleteFile(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Failed to delete storage file ${key}:`, err);
      return false;
    }
  }

  /**
   * Automated Background Worker: Ephemeral File Shredder
   * Scans and purges customer documents older than their expiration TTL
   */
  startEphemeralShredder(): void {
    const runCleanup = async () => {
      try {
        const expiredRecords = await prisma.fileRecord.findMany({
          where: {
            expiresAt: { lte: new Date() },
          },
          take: 100,
        });

        if (expiredRecords.length > 0) {
          let shreddedCount = 0;
          for (const file of expiredRecords) {
            const deleted = await this.deleteFile(file.storageKey);
            if (deleted) shreddedCount++;
          }

          console.log(`🧹 [Ephemeral Shredder] Automatically shredded ${shreddedCount} expired customer document(s) from disk.`);
        }

        const expiredGuestEvidence = await prisma.guestInstitutionVerification.findMany({
          where: { status: 'PENDING', submittedAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, evidenceStorageKey: { not: '' } },
          take: 100,
          select: { id: true, evidenceStorageKey: true },
        });
        for (const request of expiredGuestEvidence) {
          const expired = await prisma.$transaction(async (tx) => {
            const changed = await tx.guestInstitutionVerification.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'EXPIRED', active: false, evidenceStorageKey: '', rejectionReason: 'The review request expired after 30 days.' } });
            if (changed.count) await tx.guestInstitutionVerificationEvent.create({ data: { verificationId: request.id, action: 'EXPIRED', reason: 'Review request expired after 30 days.' } });
            return changed.count === 1;
          });
          if (expired) {
            const privateEvidencePath = path.resolve(process.env.COLLEGE_EVIDENCE_DIR || path.resolve(UPLOAD_DIR, '..', 'private-college-evidence'), path.basename(request.evidenceStorageKey));
            await fs.promises.unlink(privateEvidencePath).catch(() => undefined);
          }
        }
      } catch (err) {
        console.error('Ephemeral shredder error:', err);
      }
    };

    // Run initial cleanup on startup, then every 30 minutes
    runCleanup();
    setInterval(runCleanup, 30 * 60 * 1000);
  }
}

export const storageService: StorageProvider = new LocalStorageService();

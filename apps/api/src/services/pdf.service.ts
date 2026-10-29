import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';

export interface DocumentInfo {
  pageCount: number;
  width?: number;
  height?: number;
  isLandscape?: boolean;
}

export class DocumentProcessingService {
  /**
   * Analyze uploaded file to extract true page count & dimensions
   */
  static async analyzeDocument(buffer: Buffer, mimeType: string): Promise<DocumentInfo> {
    if (mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const pageCount = pages.length;
        const firstPage = pages[0];
        const { width, height } = firstPage ? firstPage.getSize() : { width: 595, height: 842 };

        return {
          pageCount: Math.max(1, pageCount),
          width,
          height,
          isLandscape: width > height,
        };
      } catch (err) {
        console.warn('PDF parsing fallback, defaulting to 1 page:', err);
        return { pageCount: 1, isLandscape: false };
      }
    }

    if (mimeType.startsWith('image/')) {
      try {
        const metadata = await sharp(buffer).metadata();
        const width = metadata.width || 800;
        const height = metadata.height || 600;
        return {
          pageCount: 1,
          width,
          height,
          isLandscape: width > height,
        };
      } catch (err) {
        return { pageCount: 1, isLandscape: false };
      }
    }

    // Office Documents (Word, Excel, PowerPoint) — Parse OpenXML app.xml metadata
    try {
      const bufferStr = buffer.toString('binary');
      const pagesMatch = bufferStr.match(/<Pages>(\d+)<\/Pages>/i);
      if (pagesMatch && pagesMatch[1]) {
        const count = parseInt(pagesMatch[1], 10);
        if (count > 0) {
          return { pageCount: count, isLandscape: false };
        }
      }

      const slidesMatch = bufferStr.match(/<Slides>(\d+)<\/Slides>/i);
      if (slidesMatch && slidesMatch[1]) {
        const count = parseInt(slidesMatch[1], 10);
        if (count > 0) {
          return { pageCount: count, isLandscape: true };
        }
      }

      // Estimate pages based on paragraph count if XML pages tag wasn't populated
      const paragraphMatches = bufferStr.match(/<w:p[ >]/g);
      if (paragraphMatches && paragraphMatches.length > 0) {
        // Approximate ~15-20 paragraphs per typical printed page
        const estimatedPages = Math.max(1, Math.ceil(paragraphMatches.length / 18));
        return { pageCount: estimatedPages, isLandscape: false };
      }
    } catch {
      // Fallback
    }

    return { pageCount: 1, isLandscape: false };
  }

  /**
   * Generates a branded test PDF for physical printer testing & sample downloads
   */
  static async generateTestPdf(printerName: string, shopName: string, testId: string): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Decorative Header Banner
    page.drawRectangle({
      x: 30,
      y: height - 120,
      width: width - 60,
      height: 80,
      color: rgb(0.35, 0.2, 0.8),
    });

    page.drawText('AnishNova Print Cloud Test Document', {
      x: 50,
      y: height - 80,
      size: 22,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Direct Spooler Diagnostic Print • Developed by AnishNova Technologies`, {
      x: 50,
      y: height - 105,
      size: 11,
      font: fontRegular,
      color: rgb(0.9, 0.95, 1),
    });

    // Content Block
    const details = [
      { label: 'Diagnostic Test ID', value: testId },
      { label: 'Target Printer', value: printerName },
      { label: 'Shop Center', value: shopName },
      { label: 'Timestamp (UTC)', value: new Date().toISOString() },
      { label: 'Windows Agent Spooler', value: 'Active / Connected (Win32 Spooler Engine)' },
      { label: 'Quality Verification', value: 'Alignment, Color Bar, Contrast & Margin Check' },
    ];

    let yPos = height - 160;
    for (const d of details) {
      page.drawText(`${d.label}:`, {
        x: 50,
        y: yPos,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.3),
      });

      page.drawText(d.value, {
        x: 200,
        y: yPos,
        size: 11,
        font: fontRegular,
        color: rgb(0.1, 0.15, 0.2),
      });

      yPos -= 24;
    }

    // Color Test Pattern
    yPos -= 20;
    page.drawText('Color Spectrum & Density Verification Bar:', {
      x: 50,
      y: yPos,
      size: 10,
      font: fontBold,
      color: rgb(0.3, 0.35, 0.4),
    });

    yPos -= 25;
    const colors = [
      { c: rgb(0, 0, 0), label: 'Black' },
      { c: rgb(0.2, 0.2, 0.2), label: 'Gray' },
      { c: rgb(0.9, 0.2, 0.2), label: 'Red' },
      { c: rgb(0.2, 0.7, 0.3), label: 'Green' },
      { c: rgb(0.1, 0.4, 0.9), label: 'Blue' },
      { c: rgb(0.9, 0.7, 0.1), label: 'Yellow' },
      { c: rgb(0.6, 0.2, 0.8), label: 'Purple' },
    ];

    const boxWidth = (width - 100) / colors.length;
    colors.forEach((col, index) => {
      page.drawRectangle({
        x: 50 + index * boxWidth,
        y: yPos,
        width: boxWidth - 4,
        height: 25,
        color: col.c,
      });
    });

    // Alignment box
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
    });

    page.drawText('PrintQR Cloud Platform • https://printqr.io • End-to-End Certified', {
      x: 120,
      y: 20,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}

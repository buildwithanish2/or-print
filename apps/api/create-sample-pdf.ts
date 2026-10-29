import { DocumentProcessingService } from './src/services/pdf.service';
import fs from 'fs';
import path from 'path';

async function generateSample() {
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const samplePdfBuffer = await DocumentProcessingService.generateTestPdf(
    'HP LaserJet Pro M404dn',
    'ABC Digital Print',
    'SAMPLE-DEMO-2026'
  );

  fs.writeFileSync(path.join(uploadDir, 'sample-project-report.pdf'), samplePdfBuffer);
  console.log('✅ Generated sample PDF in uploads/');
}

generateSample();

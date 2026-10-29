import QRCode from 'qrcode';

export class QRCodeService {
  /**
   * Generates High-Resolution Base64 Data URL (1024x1024, High Error Correction 'H')
   */
  static async generateDataUrl(url: string, colorDark = '#0f172a'): Promise<string> {
    return QRCode.toDataURL(url, {
      margin: 2,
      width: 1024,
      errorCorrectionLevel: 'H',
      color: {
        dark: colorDark,
        light: '#ffffff',
      },
    });
  }

  /**
   * Generates SVG String of the QR code for sharp vector flyers (High Error Correction 'H')
   */
  static async generateSvg(url: string, colorDark = '#0f172a'): Promise<string> {
    return QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: colorDark,
        light: '#ffffff',
      },
    });
  }
}

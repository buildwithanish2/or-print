import React, { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import {
  QrCode,
  Download,
  RefreshCw,
  Eye,
  Printer,
  Check,
  Copy,
  Sliders,
  Sparkles,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Smartphone,
  Upload,
  CreditCard,
  AlertCircle,
} from 'lucide-react';

export const QRStudioPage: React.FC = () => {
  const [qrData, setQrData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  // Standee Flyer Customizer State
  const [standeeTitle, setStandeeTitle] = useState('Scan to Print from Mobile');
  const [standeeSubtitle, setStandeeSubtitle] = useState('Contactless • Instant Auto-Spooling');
  const [startingRate, setStartingRate] = useState('2.0');
  const [themeColor, setThemeColor] = useState<'purple' | 'blue' | 'emerald' | 'gold'>('purple');
  const [footerNote, setFooterNote] = useState('Online UPI & Pay at Counter Accepted');

  const printCanvasRef = useRef<HTMLDivElement>(null);

  const fetchQR = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.get('/shops/qr/me');
      if (res.data.success && res.data.data) {
        setQrData(res.data.data);
        if (res.data.data.startingPrice) setStartingRate(String(res.data.data.startingPrice));
      } else {
        setFetchError('Failed to load shop QR data from server.');
      }
    } catch (err: any) {
      console.error('Failed to load shop QR data:', err);
      setFetchError(err.message || 'Unable to connect to QR service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
  }, []);

  const handleConfirmRegenerate = async () => {
    setShowRegenerateModal(false);
    setRegenerating(true);
    try {
      const res = await api.post('/shops/qr/regenerate');
      if (res.data.success && res.data.data) {
        setQrData(res.data.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate QR code');
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleQR = async () => {
    try {
      const res = await api.patch('/shops/qr/toggle', { isActive: !qrData?.isEnabled });
      if (res.data.success) {
        setQrData((prev: any) => ({ ...prev, isEnabled: !prev.isEnabled }));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const handleCopyLink = () => {
    if (qrData?.targetUrl) {
      navigator.clipboard.writeText(qrData.targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  /**
   * Generates High-Resolution A4 PNG (2480 x 3508 equivalent)
   */
  const handleDownloadPNG = () => {
    if (!qrData?.qrDataUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width = 2480;
    canvas.height = 3508;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (themeColor === 'purple') {
      gradient.addColorStop(0, '#3b0764');
      gradient.addColorStop(0.5, '#581c87');
      gradient.addColorStop(1, '#090d16');
    } else if (themeColor === 'blue') {
      gradient.addColorStop(0, '#1e3a8a');
      gradient.addColorStop(0.5, '#1e40af');
      gradient.addColorStop(1, '#090d16');
    } else if (themeColor === 'emerald') {
      gradient.addColorStop(0, '#064e3b');
      gradient.addColorStop(0.5, '#065f46');
      gradient.addColorStop(1, '#090d16');
    } else {
      gradient.addColorStop(0, '#451a03');
      gradient.addColorStop(0.5, '#78350f');
      gradient.addColorStop(1, '#090d16');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Decorative Top Header
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    ctx.font = 'bold 64px sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.fillText('ANISHNOVA PRINT', canvas.width / 2, 280);

    ctx.font = '900 110px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(qrData?.shopName || 'ABC Digital Print', canvas.width / 2, 420);

    ctx.font = 'bold 65px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(standeeTitle, canvas.width / 2, 540);

    ctx.font = 'normal 45px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(standeeSubtitle, canvas.width / 2, 620);

    // 3. QR Code Container Box
    const qrBoxSize = 1300;
    const qrBoxX = (canvas.width - qrBoxSize) / 2;
    const qrBoxY = 720;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 80);
    ctx.fill();

    // 4. Draw QR Code Image
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      const qrPadding = 120;
      ctx.drawImage(
        qrImg,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - qrPadding * 2,
        qrBoxSize - qrPadding * 2
      );

      // 5. Instruction Badges Below QR
      const startStepsY = 2200;
      const stepWidth = 600;
      const stepGap = 60;
      const totalWidth = 3 * stepWidth + 2 * stepGap;
      let curX = (canvas.width - totalWidth) / 2;

      const steps = [
        { num: '1', title: 'Scan Counter QR', desc: 'Use phone camera' },
        { num: '2', title: 'Upload PDF / Docs', desc: 'Select any file' },
        { num: '3', title: 'Auto Printout', desc: 'Instant tray pickup' },
      ];

      steps.forEach((st) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.roundRect(curX, startStepsY, stepWidth, 260, 40);
        ctx.fill();

        ctx.font = '900 65px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(st.num, curX + stepWidth / 2, startStepsY + 85);

        ctx.font = 'bold 45px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(st.title, curX + stepWidth / 2, startStepsY + 160);

        ctx.font = 'normal 35px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(st.desc, curX + stepWidth / 2, startStepsY + 215);

        curX += stepWidth + stepGap;
      });

      // 6. Starting Price Banner
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(canvas.width / 2 - 450, 2600, 900, 140, 70);
      ctx.fill();

      ctx.font = '900 60px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Prints Starting at ₹${startingRate} / page`, canvas.width / 2, 2695);

      // 7. Footer Note & Powered By
      ctx.font = 'normal 45px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(footerNote, canvas.width / 2, 2900);

      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Powered by AnishNova Technologies • Contactless Print Spooler', canvas.width / 2, 3350);

      // Download
      const link = document.createElement('a');
      link.download = `${qrData?.slug || 'shop'}-A4-Counter-Standee.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    };
    qrImg.src = qrData.qrDataUrl;
  };

  /**
   * Downloads SVG Standee
   */
  const handleDownloadSVG = () => {
    if (!qrData?.targetUrl) return;

    const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1700" width="1200" height="1700">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b0764" />
          <stop offset="50%" stop-color="#581c87" />
          <stop offset="100%" stop-color="#090d16" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="600" y="140" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#c084fc" text-anchor="middle">ANISHNOVA PRINT</text>
      <text x="600" y="220" font-family="Arial, sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle">${qrData?.shopName || 'ABC Digital Print'}</text>
      <text x="600" y="290" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#e2e8f0" text-anchor="middle">${standeeTitle}</text>
      <text x="600" y="340" font-family="Arial, sans-serif" font-size="24" fill="#cbd5e1" text-anchor="middle">${standeeSubtitle}</text>
      
      <rect x="250" y="400" width="700" height="700" rx="40" fill="#ffffff" />
      <image href="${qrData.qrDataUrl}" x="300" y="450" width="600" height="600" />
      
      <rect x="350" y="1250" width="500" height="80" rx="40" fill="#10b981"/>
      <text x="600" y="1305" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#ffffff" text-anchor="middle">Starting at ₹${startingRate} / page</text>
      <text x="600" y="1400" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8" text-anchor="middle">${footerNote}</text>
      <text x="600" y="1620" font-family="Arial, sans-serif" font-size="20" fill="#64748b" text-anchor="middle">Powered by AnishNova Technologies • Contactless Print Spooler</text>
    </svg>
    `;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${qrData?.slug || 'shop'}-A4-Counter-Standee.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Browser-controlled Clean A4 Single Page Print
   */
  const handlePrintStandee = () => {
    window.print();
  };

  const handleTestCustomerView = () => {
    if (qrData?.targetUrl) {
      window.open(qrData.targetUrl, '_blank');
    }
  };

  const gradientClass =
    themeColor === 'purple'
      ? 'from-purple-950 via-purple-900 to-slate-950 border-purple-500/40'
      : themeColor === 'blue'
      ? 'from-blue-950 via-blue-900 to-slate-950 border-blue-500/40'
      : themeColor === 'emerald'
      ? 'from-emerald-950 via-emerald-900 to-slate-950 border-emerald-500/40'
      : 'from-amber-950 via-yellow-900 to-slate-950 border-amber-500/40';

  return (
    <>
      {/* 1. DASHBOARD EDITING VIEW (Hidden on Print) */}
      <div className="no-print space-y-6">
        {/* Header Banner */}
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <QrCode className="w-5 h-5 text-purple-400" />
              <span>Shop QR Code Studio &amp; A4 Standee Designer</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Permanent, high-resolution QR code that never changes on page refreshes or branding edits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestCustomerView}
              className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/30 font-bold text-xs flex items-center space-x-1.5 transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Test Mobile View</span>
            </button>

            <button
              type="button"
              onClick={handleToggleQR}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                qrData?.isEnabled !== false
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
              }`}
            >
              {qrData?.isEnabled !== false ? '● QR Active' : '○ QR Disabled'}
            </button>

            <button
              type="button"
              disabled={regenerating}
              onClick={() => setShowRegenerateModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Regenerate QR Code"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              type="button"
              onClick={fetchQR}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold text-xs"
            >
              Retry Loading
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Customization Controls */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span>Standee Flyer Customizer</span>
            </h3>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Headline Text</label>
              <input
                type="text"
                value={standeeTitle}
                onChange={(e) => setStandeeTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Subtitle / Callout</label>
              <input
                type="text"
                value={standeeSubtitle}
                onChange={(e) => setStandeeSubtitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Starting Price (₹)</label>
                <input
                  type="number"
                  step="0.5"
                  value={startingRate}
                  onChange={(e) => setStartingRate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Color Palette</label>
                <select
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="purple">AnishNova Purple &amp; Pink</option>
                  <option value="blue">Royal Cyan &amp; Blue</option>
                  <option value="emerald">Eco Laser Emerald</option>
                  <option value="gold">Midnight Gold</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Footer Note</label>
              <input
                type="text"
                value={footerNote}
                onChange={(e) => setFooterNote(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            {/* Quick Actions */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handlePrintStandee}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center space-x-2 shadow-md shadow-purple-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4 Standee Flyer (1 Page Clean Print)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download A4 PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSVG}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download SVG</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold flex items-center justify-center space-x-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Customer Link Copied!' : 'Copy Customer URL'}</span>
              </button>
            </div>
          </div>

          {/* Live Preview on Dashboard */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            <div
              className={`w-full max-w-sm p-8 rounded-3xl bg-gradient-to-b ${gradientClass} border-2 shadow-2xl text-center space-y-5 text-white relative overflow-hidden`}
            >
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  <span>AnishNova Print</span>
                </div>
                <h3 className="text-xl font-black tracking-tight">{qrData?.shopName || 'ABC Digital Print'}</h3>
                <p className="text-[11px] text-slate-300 font-medium">{standeeTitle}</p>
              </div>

              {/* High-Resolution QR Card */}
              <div className="p-4 rounded-2xl bg-white shadow-2xl mx-auto inline-block ring-4 ring-white/20">
                {qrData?.qrDataUrl ? (
                  <img
                    src={qrData.qrDataUrl}
                    alt="Shop Counter QR"
                    className="w-48 h-48 md:w-56 md:h-56 object-contain rounded-lg"
                  />
                ) : loading ? (
                  <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-400 text-xs animate-pulse">
                    Loading QR...
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs p-2 text-center">
                    <span>QR Unavailable</span>
                    <button
                      type="button"
                      onClick={fetchQR}
                      className="mt-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-[10px]"
                    >
                      Reload
                    </button>
                  </div>
                )}
              </div>

              {/* 3 Step Instructions */}
              <div className="grid grid-cols-3 gap-2 text-center text-white">
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center mx-auto">
                    1
                  </div>
                  <div className="font-bold text-[10px]">Scan QR</div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center mx-auto">
                    2
                  </div>
                  <div className="font-bold text-[10px]">Upload</div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center mx-auto">
                    3
                  </div>
                  <div className="font-bold text-[10px]">Auto Print</div>
                </div>
              </div>

              {/* Price Banner */}
              <div className="p-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-lg">
                Prints Starting at ₹{startingRate} / page
              </div>

              <div className="text-[10px] text-slate-300 font-medium">{footerNote}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PRINT-ONLY CLEAN A4 CANVAS (Zero Headers/Footers, 1 Page Only) */}
      <div
        ref={printCanvasRef}
        className="hidden print:block print:w-full print:h-full print:m-0 print:p-0 bg-white text-slate-900"
        style={{ width: '210mm', height: '297mm', pageBreakInside: 'avoid' }}
      >
        <div
          className={`w-full h-full p-12 flex flex-col justify-between items-center text-center bg-gradient-to-b ${gradientClass} text-white`}
          style={{ boxSizing: 'border-box' }}
        >
          {/* Top Brand Banner */}
          <div className="space-y-2">
            <div className="inline-block px-4 py-1 rounded-full bg-white/20 text-white font-black text-sm uppercase tracking-widest">
              AnishNova Print
            </div>
            <h1 className="text-4xl font-black tracking-tight">{qrData?.shopName || 'ABC Digital Print'}</h1>
            <p className="text-xl font-bold text-slate-200">{standeeTitle}</p>
            <p className="text-sm text-slate-300">{standeeSubtitle}</p>
          </div>

          {/* Large High-Contrast QR Card */}
          <div className="p-8 rounded-3xl bg-white shadow-2xl inline-block">
            {qrData?.qrDataUrl && (
              <img src={qrData.qrDataUrl} alt="Counter QR" className="w-72 h-72 object-contain" />
            )}
          </div>

          {/* Step Badges */}
          <div className="grid grid-cols-3 gap-6 w-full max-w-xl text-center">
            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 space-y-1">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-black text-sm flex items-center justify-center mx-auto">
                1
              </div>
              <div className="font-bold text-sm">Scan QR</div>
              <div className="text-xs text-slate-300">Open mobile camera</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 space-y-1">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-black text-sm flex items-center justify-center mx-auto">
                2
              </div>
              <div className="font-bold text-sm">Upload File</div>
              <div className="text-xs text-slate-300">PDF, JPG, PNG, DOCX</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 border border-white/20 space-y-1">
              <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-900 font-black text-sm flex items-center justify-center mx-auto">
                3
              </div>
              <div className="font-bold text-sm">Auto Print</div>
              <div className="text-xs text-slate-300">Instant counter pickup</div>
            </div>
          </div>

          {/* Pricing Highlight & Disclaimers */}
          <div className="space-y-3 w-full max-w-xl">
            <div className="py-3 px-6 rounded-2xl bg-emerald-500 text-slate-950 font-black text-base shadow-xl">
              Prints Starting at ₹{startingRate} / page • UPI &amp; Cash Accepted
            </div>
            <p className="text-xs text-slate-300">{footerNote}</p>
            <p className="text-[10px] text-slate-400">
              Developed by AnishNova Technologies • Enterprise Contactless Printing
            </p>
          </div>
        </div>
      </div>

      {/* 3. CONFIRM REGENERATION MODAL */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm border-b border-slate-800 pb-3">
              <AlertTriangle className="w-5 h-5" />
              <span>Regenerate Permanent Counter QR?</span>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Your existing counter QR code will be replaced. Any previously printed standees or flyers will stop routing customers to your shop.
            </p>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
              ⚠️ Only proceed if you are replacing all physical standees at your counter.
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRegenerateModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRegenerate}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                Yes, Regenerate QR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

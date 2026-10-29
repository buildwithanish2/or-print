import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  Printer,
  ArrowLeft,
  Calendar,
  ShieldCheck,
  Store,
  RefreshCw,
  FileText,
  Lock,
  Mail,
  ExternalLink,
} from 'lucide-react';

interface LegalPageViewProps {
  slug: string;
  onBack: () => void;
  onNavigateToShopRegister: () => void;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({
  slug,
  onBack,
  onNavigateToShopRegister,
}) => {
  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
    setLoading(true);
    setError(null);

    api.get(`/legal/${encodeURIComponent(slug)}`)
      .then((res) => res.data)
      .then((data) => {
        if (data.success && data.data) {
          setPage(data.data);
          if (data.data.metaTitle) {
            document.title = data.data.metaTitle;
          }
        } else {
          throw new Error('Page not found');
        }
      })
      .catch((err) => {
        setError(err.message || 'Page unavailable');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  // Safe markdown renderer helper for structured headings, paragraphs, lists, bold text
  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    const lines = content.split('\n');

    return (
      <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-2" />;

          // H1
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={idx} className="text-xl sm:text-2xl font-black text-[#080B20] pt-4 pb-1 border-b border-slate-100">
                {trimmed.replace('# ', '')}
              </h1>
            );
          }

          // H2
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={idx} className="text-lg sm:text-xl font-bold text-[#080B20] pt-3">
                {trimmed.replace('## ', '')}
              </h2>
            );
          }

          // H3
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={idx} className="text-base sm:text-lg font-bold text-purple-900 pt-2 flex items-center space-x-2">
                <span>{trimmed.replace('### ', '')}</span>
              </h3>
            );
          }

          // HR
          if (trimmed === '---') {
            return <hr key={idx} className="border-slate-100 my-4" />;
          }

          // Bullet List
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const listText = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start space-x-2.5 pl-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5 flex-shrink-0" />
                <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(listText) }} />
              </div>
            );
          }

          // Paragraph
          return (
            <p
              key={idx}
              className="text-slate-700"
              dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
            />
          );
        })}
      </div>
    );
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#080B20]">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-slate-600">$1</em>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-mono text-[11px]">$1</code>');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#080B20] font-sans selection:bg-purple-500 selection:text-white bg-dot-pattern flex flex-col justify-between">
      {/* Sticky Header */}
      <header className="sticky top-0 z-[1100] bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 transition-colors text-xs font-bold"
              aria-label="Back to Homepage"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <span className="text-base sm:text-lg font-black tracking-tight text-[#080B20]">
                AnishNova<span className="text-purple-600 ml-0.5">Print</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToShopRegister}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 shadow-sm flex items-center space-x-1.5 hover:opacity-95 transition-opacity"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Register Shop</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200/90 shadow-xl space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-purple-600 mb-2" />
            <div className="text-sm font-bold text-slate-700">Loading document...</div>
            <p className="text-xs text-slate-400">Fetching latest compliance revision from secure registry</p>
          </div>
        ) : error || !page ? (
          <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <ShieldCheck className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-black text-[#080B20]">Document Unavailable</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              The requested legal compliance document (<code>/{slug}</code>) is currently unpublished or being updated.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500"
            >
              Return to Homepage
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-xl space-y-6">
            {/* Header Title & Date */}
            <div className="border-b border-slate-100 pb-5 space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>OFFICIAL COMPLIANCE DOCUMENT</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-[#080B20] tracking-tight">
                {page.title}
              </h1>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  Last Reviewed:{' '}
                  {new Date(page.updatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Rendered Document Content */}
            <div className="pt-2">
              {renderFormattedContent(page.content)}
            </div>

            {/* Bottom Support Banner */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-purple-600" />
                <span>Questions about this document? Contact <strong>legal@anishnova.com</strong></span>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="text-purple-600 font-bold hover:underline"
              >
                ← Back to Home
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 AnishNova Print. Developed by <strong>AnishNova Technologies</strong>.</span>
          <span className="text-[11px] text-slate-400">All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
};

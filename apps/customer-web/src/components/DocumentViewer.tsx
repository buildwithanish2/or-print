import React, { useEffect, useState } from 'react';
import { FileRecordDTO } from '@printqr/types';
import { API_BASE_URL, api } from '../lib/api';
import { LoaderCircle, RefreshCw, X } from 'lucide-react';

interface Props { file: FileRecordDTO | null; onClose: () => void; }
export const DocumentViewer: React.FC<Props> = ({ file, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!file?.url) return;
    let cancelled = false;
    let objectUrl = '';
    setPreviewUrl('');
    setFailed(false);
    setLoading(true);

    const loadPreview = async () => {
      try {
        // File records may contain an old absolute localhost URL. Keep its path,
        // but always fetch through the configured API client for this environment.
        const storedPath = /^https?:\/\//i.test(file.url)
          ? `${new URL(file.url).pathname}${new URL(file.url).search}`
          : file.url;
        const apiPath = new URL(API_BASE_URL).pathname.replace(/\/$/, '');
        // Axios combines this path with API_BASE_URL. Remove an already-present
        // API prefix (for example `/api`) to avoid requesting `/api/api/...`.
        const filePath = apiPath && storedPath.startsWith(`${apiPath}/`)
          ? storedPath.slice(apiPath.length)
          : storedPath;
        const response = await api.get<Blob>(filePath, { responseType: 'blob' });
        objectUrl = URL.createObjectURL(response.data);
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.id, file?.url, attempt]);

  if (!file) return null;
  const isPdf = file.mimeType === 'application/pdf' || file.originalName.toLowerCase().endsWith('.pdf');
  const isImage = file.mimeType.startsWith('image/');
  return <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label={`Preview ${file.originalName}`}>
    <header className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#151619] px-3"><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-white">{file.originalName}</h2><p className="text-xs text-slate-400">{file.pageCount} pages · {file.mimeType}</p></div><button type="button" aria-label="Close preview" onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"><X size={18} /></button></header>
    <div className="my-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#202124]">
      {!isPdf && !isImage ? <p className="max-w-sm p-6 text-center text-sm text-slate-300">A preview is not available for this file type. You can still print the uploaded document.</p>
        : loading ? <div className="flex items-center gap-2 text-sm text-slate-300" role="status"><LoaderCircle className="animate-spin" size={18} /> Loading preview…</div>
          : failed ? <div className="max-w-sm p-6 text-center"><p className="text-sm text-slate-300">Couldn’t load this preview. Check your connection and try again.</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"><RefreshCw size={15} /> Try again</button></div>
            : isImage ? <img src={previewUrl} alt={file.originalName} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
              : <iframe title={`PDF preview: ${file.originalName}`} src={previewUrl} onError={() => setFailed(true)} className="h-full w-full border-0 bg-white" />}
    </div>
  </div>;
};

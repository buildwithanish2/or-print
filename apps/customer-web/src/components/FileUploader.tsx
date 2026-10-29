import React, { useRef, useState } from 'react';
import { Upload, FileText, Trash2, Eye, Sliders, CheckCircle2, AlertCircle, FileSpreadsheet, Presentation } from 'lucide-react';
import { api } from '../lib/api';
import { FileRecordDTO, PrintSettingsDTO } from '@printqr/types';

const supportedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];
// Must match APP_CONFIG.MAX_FILE_SIZE_BYTES and the API Multer limit (50 MiB).
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

interface FileUploaderProps {
  shopSlug: string;
  files: { file: FileRecordDTO; settings: PrintSettingsDTO }[];
  onFileAdded: (file: FileRecordDTO) => void;
  onFileRemoved: (fileId: string) => void;
  onConfigureClick: (fileId: string) => void;
  onPreviewClick: (file: FileRecordDTO) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  shopSlug,
  files,
  onFileAdded,
  onFileRemoved,
  onConfigureClick,
  onPreviewClick,
  disabled = false,
  onBusyChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelection = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setErrorMessage(null);
    setUploading(true);
    onBusyChange?.(true);
    setUploadProgress(10);

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const extension = f.name.split('.').pop()?.toLowerCase() || '';
      if (f.size > MAX_FILE_SIZE_BYTES) { setErrorMessage(`${f.name} exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB file limit.`); continue; }
      if (!supportedExtensions.includes(extension)) { setErrorMessage(`${f.name} is not a supported file type.`); continue; }
      const formData = new FormData();
      formData.append('file', f);
      formData.append('shopSlug', shopSlug);

      try {
        setUploadProgress(40);
        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const p = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(Math.min(95, p));
            }
          },
        });

        if (res.data.success) {
          onFileAdded(res.data.data);
        }
      } catch (err: any) {
        setErrorMessage(err.message || `Failed to upload ${f.name}`);
      }
    }

    setUploadProgress(100);
    setUploading(false);
    setUploadProgress(0);
    onBusyChange?.(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string) => {
    if (mime.includes('spreadsheet') || mime.includes('excel')) {
      return <FileSpreadsheet className="w-6 h-6 text-emerald-400" />;
    }
    if (mime.includes('presentation') || mime.includes('powerpoint')) {
      return <Presentation className="w-6 h-6 text-amber-400" />;
    }
    return <FileText className="w-6 h-6 text-blue-400" />;
  };

  return (
    <div className="w-full space-y-3">
      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled && !uploading) handleFileSelection(e.dataTransfer.files);
        }}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInputRef.current?.click(); } }}
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-label="Upload documents to print"
        className={`relative border rounded-xl p-3 text-left cursor-pointer transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
            : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={supportedExtensions.map((extension) => `.${extension}`).join(',')}
          className="hidden"
          onChange={(e) => handleFileSelection(e.target.files)}
        />

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400"><Upload size={18} /></div>
          <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-white">Upload documents to print</h3><p className="mt-0.5 text-[11px] leading-4 text-slate-400">PDF, Office documents and images · up to {Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB each</p></div>
          <span className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Select files</span>
        </div>

        {uploading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-10">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Uploading & Analyzing Pages...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Uploaded File Cards */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
            <span>Documents ({files.length})</span>
            <span>Tap settings to configure copies & color</span>
          </div>

            <div className="space-y-2">
            {files.map(({ file, settings }) => (
              <div
                key={file.id}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-700/50">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-200 truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                      <span className="font-medium text-blue-400">
                        {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                      <span>•</span>
                      <span>{formatFileSize(file.sizeBytes)}</span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] uppercase font-semibold text-slate-300">
                        {settings.colorMode === 'COLOR' ? 'Color' : 'B&W'} • {settings.copies}x
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreviewClick(file)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Preview Document"
                    aria-label={`Preview ${file.originalName}`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onConfigureClick(file.id)}
                    className="p-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-colors"
                    title="Print Settings"
                    aria-label={`Configure print settings for ${file.originalName}`}
                  >
                    <Sliders className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onFileRemoved(file.id)}
                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                    title="Remove from this order"
                    aria-label={`Remove ${file.originalName} from this order`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

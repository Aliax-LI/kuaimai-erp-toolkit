import { motion } from 'framer-motion';
import { AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface DragDropZoneProps {
  fileName?: string | null;
  loading?: boolean;
  progressPercent?: number | null;
  progressText?: string | null;
  onPick: () => void;
  onFilePath?: (path: string) => void;
  resolvePathForFile?: (file: File) => string;
}

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

function isExcelFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function DragDropZone({
  fileName,
  loading,
  progressPercent,
  progressText,
  onPick,
  onFilePath,
  resolvePathForFile,
}: DragDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileTypeError, setFileTypeError] = useState(false);

  useEffect(() => {
    if (!fileTypeError) {
      return;
    }
    const timer = window.setTimeout(() => setFileTypeError(false), 3000);
    return () => window.clearTimeout(timer);
  }, [fileTypeError]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (loading || !onFilePath || !resolvePathForFile) {
      return;
    }

    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }
    if (!isExcelFileName(file.name)) {
      setFileTypeError(true);
      return;
    }

    setFileTypeError(false);
    const filePath = resolvePathForFile(file);
    if (filePath) {
      onFilePath(filePath);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: dragOver ? 1.01 : 1,
      }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex min-h-28 w-full cursor-pointer flex-col justify-between gap-3 border border-dashed bg-cream px-4 py-3 transition-colors duration-200 hover:border-brown-soft hover:bg-cream-warm',
        dragOver && 'border-amber bg-cream-warm shadow-sm',
        fileTypeError && 'border-status-danger bg-status-danger/5',
        !dragOver && !fileTypeError && 'border-beige',
        loading && 'pointer-events-none opacity-60',
      )}
      onClick={onPick}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-beige bg-cream-white text-brown-soft">
          {fileName ? <FileSpreadsheet className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
        </div>
        {fileName ? (
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-medium text-charcoal">{fileName}</p>
            <p className="mt-1 text-xs text-brown-soft">点击或拖拽可替换文件，将重新检查数据</p>
          </div>
        ) : (
          <div className="text-left">
            <p className="text-sm font-medium text-charcoal">拖入或选择上品 Excel</p>
            <p className="mt-1 text-xs text-brown-soft">
              支持 .xlsx / .xls，导入后自动检查数据
            </p>
          </div>
        )}
      </div>
      {fileTypeError && !loading && (
        <p className="flex items-center gap-1.5 text-xs text-status-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          仅支持 Excel 文件（.xlsx / .xls）
        </p>
      )}
      {loading ? (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-between text-xs text-brown-soft">
            <span className="truncate">{progressText || '正在检查数据…'}</span>
            {typeof progressPercent === 'number' && <span>{Math.round(progressPercent)}%</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-beige/70">
            <div
              className="h-full rounded-full bg-amber transition-all duration-300"
              style={{
                width: `${Math.max(4, Math.min(100, progressPercent ?? 8))}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="border-t border-beige/70 pt-2 text-xs text-warmgray">支持 .xlsx / .xls</p>
      )}
    </motion.div>
  );
}

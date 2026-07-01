import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface DragDropZoneProps {
  fileName?: string | null;
  loading?: boolean;
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
  onPick,
  onFilePath,
  resolvePathForFile,
}: DragDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);

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
      return;
    }

    const filePath = resolvePathForFile(file);
    if (filePath) {
      onFilePath(filePath);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-cream transition-all duration-200 hover:border-brown-soft hover:bg-cream-warm',
        dragOver ? 'border-amber bg-cream-warm' : 'border-beige',
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
      <Upload className="h-12 w-12 text-brown-soft" />
      <div className="text-center">
        {fileName ? (
          <>
            <p className="text-base font-medium text-charcoal">{fileName}</p>
            <p className="mt-1 text-sm text-brown-soft">点击或拖拽重新选择文件</p>
          </>
        ) : (
          <>
            <p className="text-base font-medium text-charcoal">拖拽Excel文件到此处</p>
            <p className="mt-1 text-sm text-brown-soft">
              或<span className="mx-1 text-amber">点击选择文件</span>
            </p>
          </>
        )}
      </div>
      <p className="text-xs text-warmgray">
        {loading ? '预演中…' : '支持 .xlsx, .xls 格式'}
      </p>
    </motion.div>
  );
}

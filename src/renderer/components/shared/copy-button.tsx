import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 text-xs transition-colors',
        copied ? 'text-status-success' : 'text-amber hover:text-amber-dark',
        className,
      )}
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? '复制成功' : '复制'}
    </button>
  );
}

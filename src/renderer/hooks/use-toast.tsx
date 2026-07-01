import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

interface ToastContextValue {
  toast: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const toast = useCallback((text: string) => {
    const id = Date.now();
    setMessages((prev) => [...prev, { id, text }]);
    window.setTimeout(() => {
      setMessages((prev) => prev.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex w-80 flex-col gap-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-lg border border-beige bg-cream-white px-4 py-3 text-sm text-charcoal shadow-sm"
          >
            {message.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

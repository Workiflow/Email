'use client';

import { useEffect, useState } from 'react';
import { cn } from '@ui/inbox';

type Toast = {
  id: string;
  message: string;
};

let listeners: Array<(toast: Toast) => void> = [];

export function pushToast(message: string) {
  const toast: Toast = { id: crypto.randomUUID(), message };
  listeners.forEach((listener) => listener(toast));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts((current) => [...current, toast]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== toast.id));
      }, 4000);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn('rounded-md bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg')}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

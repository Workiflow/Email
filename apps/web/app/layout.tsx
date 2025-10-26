import './globals.css';
import type { Metadata } from 'next';
import { ReactQueryProvider } from '../components/react-query-provider';
import { Toaster } from '../components/toaster';

export const metadata: Metadata = {
  title: 'Shared Inbox',
  description: 'Lean shared inbox for teams'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full bg-gray-100">
        <ReactQueryProvider>
          {children}
          <Toaster />
        </ReactQueryProvider>
      </body>
    </html>
  );
}

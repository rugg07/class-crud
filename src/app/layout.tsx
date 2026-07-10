import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth/context';
import './globals.css';

export const metadata: Metadata = {
  title: 'School Portal',
  description: 'A Canvas-style school portal platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import ClientOnlyToastContainer from '@/components/common/ClientOnlyToastContainer';
import { WebVitalsReporter } from '@/components/common/WebVitalsReporter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hangly / ツドイ — Calendar-aware group scheduling',
  description:
    'Group scheduling that reads your Google Calendar for conflicts and writes the confirmed time back when everyone is set.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
  applicationName: 'Hangly',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Hangly',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-100 text-gray-900`}>
        <WebVitalsReporter />
        <QueryProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col">
              <main className="flex-grow container mx-auto p-4">{children}</main>
              <footer className="text-center p-4 bg-gray-200 text-sm">
                © {new Date().getFullYear()} Hangly
              </footer>
            </div>
            <ClientOnlyToastContainer
              position="bottom-right"
              autoClose={4000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

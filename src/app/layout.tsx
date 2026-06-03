import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import ClientOnlyToastContainer from '@/components/common/ClientOnlyToastContainer';
import { WebVitalsReporter } from '@/components/common/WebVitalsReporter';
import { LanguageSync } from '@/components/common/LanguageSync';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Tsudoi - Calendar-aware scheduling',
  description:
    'Plan group hangouts with calendar conflicts, availability links, and confirmed event write-back.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg' },
  applicationName: 'Tsudoi',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tsudoi',
  },
};

export const viewport: Viewport = {
  themeColor: '#f4f1eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-stone-100 text-slate-900`}>
        <WebVitalsReporter />
        <QueryProvider>
          <AuthProvider>
            <LanguageSync />
            <div className="flex min-h-screen flex-col">
              <main className="flex-grow">{children}</main>
              <footer className="border-t border-stone-300 bg-stone-100 px-4 py-4 text-center text-xs text-stone-600">
                © {new Date().getFullYear()} Tsudoi
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

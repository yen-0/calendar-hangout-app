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
  title: 'ツドイ — カレンダー連携の日程調整',
  description:
    'Google カレンダーの予定を読み取り、確定した時間を全員のカレンダーへ書き戻す日程調整アプリです。',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
  applicationName: 'ツドイ',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ツドイ',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-100 text-gray-900`}>
        <WebVitalsReporter />
        <QueryProvider>
          <AuthProvider>
            <LanguageSync />
            <div className="flex min-h-screen flex-col">
              <main className="container mx-auto flex-grow p-4">{children}</main>
              <footer className="bg-gray-200 p-4 text-center text-sm">
                © {new Date().getFullYear()} ツドイ
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

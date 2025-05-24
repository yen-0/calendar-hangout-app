// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

import { ToastContainer } from 'react-toastify'; // Import
import 'react-toastify/dist/ReactToastify.css'; // Import default CSS
import ClientOnlyToastContainer from '@/components/common/ClientOnlyToastContainer'; 
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = { /* ... */ };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-100 text-gray-900`}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <main className="flex-grow container mx-auto p-4">
              {children}
            </main>
            <footer className="text-center p-4 bg-gray-200 text-sm">
              © {new Date().getFullYear()} Calendar & Hangout App
            </footer>
          </div>
          <ClientOnlyToastContainer // Use the wrapper
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
      </body>
    </html>
  );
}
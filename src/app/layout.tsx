import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "3DBRIDGE | Blender Integration",
  description: "Seamlessly export CGI assets to Blender with one click.",
  icons: {
    icon: "/logo.png",
  },
};

import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { TransferProvider } from "@/context/TransferContext";
import AppLogic from "@/components/AppLogic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-[#020617] text-slate-200`}
      >
        <AuthProvider>
          <LanguageProvider>
            <NetworkProvider>
              <TransferProvider>
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'rgba(30, 41, 59, 0.7)',
                      color: '#f1f5f9',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                    },
                  }}
                />
                <AppLogic />
                {children}
              </TransferProvider>
            </NetworkProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

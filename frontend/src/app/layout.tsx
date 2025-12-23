import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { TransitionProvider } from "@/contexts/TransitionContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Micrapor React",
  description: "Raporlama Uygulaması",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Micrapor",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <I18nProvider>
          <AuthProvider>
            <TransitionProvider>
              {children}
            </TransitionProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

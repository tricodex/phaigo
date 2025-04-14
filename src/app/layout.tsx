import "@rainbow-me/rainbowkit/styles.css";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Metadata } from "next";
import { ClientProviders } from '@/components/layouts/ClientProviders';
import { AssistantLoader } from "@/components/ai/assistant-loader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "phaigo - Payments Made Simple",
  description: "Send and receive PYUSD stablecoin payments instantly with a simple, clean interface",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <div id="app-root">
          <ClientProviders>
            <div className="h-full">
              <div className="h-full flex flex-col">
                <div className="flex-grow">
                  {children}
                </div>
                <div className="py-4 text-center text-xs text-gray-500">
                  <p>Phaigo - Payments Made Simple</p>
                  <p className="mt-1">
                    Powered by GCP Blockchain RPC service for reliable transactions
                  </p>
                </div>
              </div>
            </div>
            <Toaster />
            <AssistantLoader />
          </ClientProviders>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";

import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "finai — AI Finance Dashboard",
  description:
    "Track Indian equities across NSE & BSE with AI-powered insights, forecasts, and portfolio analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

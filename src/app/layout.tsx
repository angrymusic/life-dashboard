import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import {
  detectLanguageFromAcceptLanguage,
  LANGUAGE_COOKIE_KEY,
  normalizeLanguage,
} from "@/shared/i18n/language";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Life Dashboard",
  description: "A dashboard application for your life.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const cookieLanguage = normalizeLanguage(
    cookieStore.get(LANGUAGE_COOKIE_KEY)?.value
  );
  const initialLanguage =
    cookieLanguage ??
    detectLanguageFromAcceptLanguage(headerStore.get("accept-language"));

  return (
    <html lang={initialLanguage}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers initialLanguage={initialLanguage}>{children}</Providers>
      </body>
    </html>
  );
}

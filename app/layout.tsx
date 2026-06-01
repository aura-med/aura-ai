import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Mono, Inter, Syne } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura — Health & Performance Intelligence",
  description: "Predictive injury risk management platform for elite football",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`dark ${inter.variable} ${dmMono.variable} ${syne.variable} h-full`}
    >
      <body className="h-full antialiased">
        <Suspense fallback={null}>
          <LocaleProviders>{children}</LocaleProviders>
        </Suspense>
      </body>
    </html>
  );
}

async function LocaleProviders({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider>{children}</ThemeProvider>
    </NextIntlClientProvider>
  )
}

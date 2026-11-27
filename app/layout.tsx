import type { Metadata } from "next";
import { Suspense } from "react";
import { Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// --font-dm-mono used to load DM Mono for labels/badges/timestamps — user
// feedback: it read as "robotizado" next to the rest of the UI. Loads
// Poppins under the same CSS variable name instead, so every existing
// var(--font-dm-mono)/var(--font-mono) reference across the app becomes
// Poppins without touching each of those call sites individually.
const dmMono = Poppins({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Sophi Sports — Health & Performance Intelligence",
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
      className={`light ${poppins.variable} ${dmMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the persisted theme before first paint (default: light) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('sophi-ui')||'{}');var t=s&&s.state&&s.state.theme==='dark'?'dark':'light';var c=document.documentElement.classList;c.remove('light','dark');c.add(t);}catch(e){}`,
          }}
        />
      </head>
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

import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthGuard } from "@/components/auth-guard";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Corsfix Dashboard",
  description:
    "Manage your apps, subscription, and use the playground in the Corsfix dashboard.",
};

import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { IS_CLOUD, DISABLE_SIGNUP } from "@/config/constants";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProvider } from "@/components/app-provider";
import MSClarity from "../components/clarity";

const CrispWithNoSSR = dynamic(() => import("../components/crisp"));

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {IS_CLOUD && (
        <>
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="35d32708-fd12-4ae8-a732-5702e13fe819"
          ></Script>
          <CrispWithNoSSR />
          <MSClarity />
        </>
      )}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <AppProvider isCloud={IS_CLOUD}>
              <AuthGuard disableSignup={DISABLE_SIGNUP}>{children}</AuthGuard>
            </AppProvider>
          </SessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

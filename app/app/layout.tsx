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
import { IS_CLOUD } from "@/config/constants";

const CrispWithNoSSR = dynamic(() => import("../components/crisp"));

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {IS_CLOUD && (
        <>
          <Script
            defer
            src="https://cloud.umami.is/script.js"
            data-website-id="35d32708-fd12-4ae8-a732-5702e13fe819"
          ></Script>
          <CrispWithNoSSR />
        </>
      )}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <AuthGuard isCloud={IS_CLOUD}>{children}</AuthGuard>
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}

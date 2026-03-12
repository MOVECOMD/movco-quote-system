import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MOVCO - Instant Moving Quotes",
  description: "Get an instant AI-powered moving quote. Upload photos of your belongings and get an accurate moving estimate in minutes. Connect with trusted UK removal companies.",
  icons: {
    icon: "/movco-logo.png",
  },
  manifest: "/manifest.json",
  themeColor: "#0a0f1c",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MOVCO",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/movco-icon-192.png" />

        {/* Google Analytics 4 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-1S5CMKJBF7"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-1S5CMKJBF7');

            window.movcoTrackQuoteStarted = function() {
              gtag('event', 'quote_started', {
                event_category: 'conversion',
                event_label: 'User started creating a quote'
              });
            };

            window.movcoTrackQuoteCompleted = function(value) {
              gtag('event', 'quote_completed', {
                event_category: 'conversion',
                event_label: 'Quote generated',
                value: value || 0,
                currency: 'GBP'
              });
            };

            window.movcoTrackLeadGenerated = function() {
              gtag('event', 'generate_lead', {
                event_category: 'conversion',
                event_label: 'User requested removals company',
                value: 10.00,
                currency: 'GBP'
              });
            };

            window.movcoTrackSignUp = function() {
              gtag('event', 'sign_up', {
                event_category: 'conversion',
                event_label: 'New user registration'
              });
            };
          `}
        </Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.className} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        `}} />
      </body>
    </html>
  );
}

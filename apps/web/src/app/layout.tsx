import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TG2WA — Telegram to WhatsApp Forwarder",
  description: "Forward messages from Telegram groups directly to your own WhatsApp, 24/7.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

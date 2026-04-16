import type { Metadata } from "next";
import { Toaster } from "sonner";
import ClientProviders from "@/components/client-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reply.ai - AI Agent",
  description: "AI Agent UI Conversation powered by Cerebras LLM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}

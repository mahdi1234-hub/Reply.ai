import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}

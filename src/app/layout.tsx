import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slido Arena - Interactive Real-Time Q&A & Rapid-Fire Quiz",
  description: "Elevate event participation with live Q&A, interactive polls, timed Rapid-Fire quizzes, and live leaderboards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

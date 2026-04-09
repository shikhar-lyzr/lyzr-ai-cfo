import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lyzr AI CFO",
  description:
    "Finance Action Engine — proactive variance review and financial insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}

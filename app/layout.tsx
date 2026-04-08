import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CampusSync — VIT Bhopal",
  description:
    "Book campus resources — library, labs, sports courts — instantly at VIT Bhopal.",
  keywords: ["VIT Bhopal", "campus booking", "library", "computer lab", "sports"],
  authors: [{ name: "VIT Bhopal", url: "https://vitbhopal.ac.in" }],
  openGraph: {
    title: "CampusSync",
    description: "Smart campus resource booking for VIT Bhopal students.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}

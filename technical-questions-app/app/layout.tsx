import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as a standard font
import "./globals.css";

const inter = Inter({ subsets: ["latin"] }); // Configure Inter font

export const metadata: Metadata = {
  title: "Technical Questions App", // Updated title
  description: "Generated technical interview questions", // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}> {/* Use Inter font class */}
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "One Repair Solutions",
  description: "Field Service Management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <AuthProvider><AuthGuard>{children}</AuthGuard></AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "LeetCode Tracker",
  description: "Bulk process and track student progress on LeetCode.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${poppins.variable}`}>
        <Providers>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ flex: 1 }}>{children}</div>
            <footer style={{ 
              padding: '24px', 
              textAlign: 'center', 
              borderTop: '1px solid var(--surface-border)', 
              background: 'var(--surface)', 
              color: 'var(--muted)',
              fontSize: '0.9rem'
            }}>
              Developed by <a href="https://www.linkedin.com/in/armaan-s-paul/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Armaan</a> AI&DS 2420673 (2024-2028)
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}

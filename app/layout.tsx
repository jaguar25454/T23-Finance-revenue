import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Revenue Control Center',
  description:
    'แดชบอร์ดยอดขายและข้อมูลการดำเนินงานสำหรับ KAPPO TAKASHI, Capricci และ LAWOI',
  openGraph: {
    title: 'Revenue Control Center',
    description: 'Multi-Brand Finance Dashboard',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Revenue Control Center',
    description: 'Multi-Brand Finance Dashboard',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

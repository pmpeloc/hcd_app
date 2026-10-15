import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
});

const description = 'Tu historia clínica, bajo tu control.';
// Vercel injects VERCEL_PROJECT_PRODUCTION_URL without a scheme.
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Salua', template: '%s · Salua' },
  description,
  applicationName: 'Salua',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Salua',
    title: 'Salua',
    description,
    locale: 'es_AR',
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: 'Salua', description },
};

export const viewport: Viewport = { themeColor: '#0b91f2' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn('font-sans', inter.variable, poppins.variable)}>
      <body>{children}</body>
    </html>
  );
}

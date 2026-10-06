import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import { cn } from '@/lib/utils';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Salua',
  description: 'Tu historia clínica, bajo tu control.',
};

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

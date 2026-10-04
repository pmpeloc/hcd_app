import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

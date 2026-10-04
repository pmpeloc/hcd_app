import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-salua-navy">Salua</h1>
      <p className="text-lg text-salua-blue">Tu historia clínica, bajo tu control.</p>
      <Link href="/login" className="rounded-lg bg-salua-blue px-6 py-3 text-white">
        Ingresar
      </Link>
    </main>
  );
}

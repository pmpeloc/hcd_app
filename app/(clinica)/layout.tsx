export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-salua-turquoise p-4 text-white">Salua · Clínica</header>
      {children}
    </div>
  );
}

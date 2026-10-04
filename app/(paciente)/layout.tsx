export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-salua-navy p-4 text-white">Salua · Paciente</header>
      {children}
    </div>
  );
}

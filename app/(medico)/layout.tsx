export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-salua-blue p-4 text-white">Salua · Médico</header>
      {children}
    </div>
  );
}

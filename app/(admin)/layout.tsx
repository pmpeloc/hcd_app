export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-gray-800 p-4 text-white">Salua · Admin</header>
      {children}
    </div>
  );
}

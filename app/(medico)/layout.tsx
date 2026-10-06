import { ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/app-shell/app-shell';

const PLACEHOLDER_DOCTOR = { name: 'Dra. Lucía Ríos', subtitle: 'Cardiología · MN 112.345' };

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role="doctor"
      user={PLACEHOLDER_DOCTOR}
      note={{
        icon: <ShieldCheck />,
        title: 'Matrícula verificada',
        body: 'Avalada por Centro Médico Norte. Podés cargar estudios.',
      }}
    >
      {children}
    </AppShell>
  );
}

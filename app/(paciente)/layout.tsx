import { Lock } from 'lucide-react';
import { AppShell } from '@/components/app-shell/app-shell';

const PLACEHOLDER_PATIENT = { name: 'Ana Martínez', subtitle: 'Paciente' };

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role="patient"
      user={PLACEHOLDER_PATIENT}
      note={{
        icon: <Lock />,
        title: 'Tus estudios están cifrados',
        body: 'Solo los abre quien vos autorizás, y por el tiempo que elijas.',
      }}
    >
      {children}
    </AppShell>
  );
}

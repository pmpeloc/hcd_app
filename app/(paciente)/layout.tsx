import { Lock } from 'lucide-react';
import { AppShell } from '@/components/app-shell/app-shell';
import { PatientTopBar } from '@/components/app-shell/patient-top-bar';

const PLACEHOLDER_PATIENT = { name: 'Ana Martínez', subtitle: 'Paciente' };
const PLACEHOLDER_PENDING_REQUESTS = 1;

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role="patient"
      user={PLACEHOLDER_PATIENT}
      badges={{ '/accesos': PLACEHOLDER_PENDING_REQUESTS }}
      unreadNotifications={PLACEHOLDER_PENDING_REQUESTS}
      topBar={<PatientTopBar />}
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

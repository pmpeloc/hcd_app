import { Lock } from 'lucide-react';
import { PatientTopBar } from '@/components/app-shell/patient-top-bar';
import { AuthBoundary, SessionShell } from '@/components/app-shell/session-shell';

// Sample data until the API reports pending requests.
const PLACEHOLDER_PENDING_REQUESTS = 1;

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <SessionShell
        role="patient"
        demoUser={{ name: 'Ana Martínez', subtitle: 'Paciente' }}
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
      </SessionShell>
    </AuthBoundary>
  );
}

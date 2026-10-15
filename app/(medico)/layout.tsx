import { AuthBoundary, SessionShell } from '@/components/app-shell/session-shell';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthBoundary>
      <SessionShell role="doctor" demoUser={{ name: 'Dra. Lucía Ríos', subtitle: 'Cardiología · MN 112.345' }}>
        {children}
      </SessionShell>
    </AuthBoundary>
  );
}

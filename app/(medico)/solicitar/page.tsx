import { RequestAccessFlow } from '@/components/access/request-access-flow';
import { NeedsPatient } from '@/components/needs-patient';
import { normalizeCode } from '@/components/patient-qr/qr-session';

// Placeholder until the scanner hands over a real patient from the API.
const PLACEHOLDER_PATIENT = { name: 'Ana Martínez', since: '2026', studyCount: 4 };

export default async function RequestAccessPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  const code = paciente ? normalizeCode(paciente) : null;

  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Pedir acceso</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        El paciente decide en su app si te deja ver su historia y por cuánto tiempo.
      </p>

      {code ? <RequestAccessFlow patient={{ ...PLACEHOLDER_PATIENT, code }} /> : <NeedsPatient then="pedir acceso" />}
    </>
  );
}

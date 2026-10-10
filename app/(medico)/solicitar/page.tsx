import { RequestAccessFlow } from '@/components/access/request-access-flow';
import { NeedsPatient } from '@/components/needs-patient';
import { normalizeCode } from '@/components/patient-qr/qr-session';

export default async function RequestAccessPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  const code = paciente ? normalizeCode(paciente) : null;

  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Pedir acceso</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        El paciente decide en su app si te deja ver su historia y por cuánto tiempo.
      </p>

      {code ? <RequestAccessFlow code={code} /> : <NeedsPatient then="pedir acceso" />}
    </>
  );
}

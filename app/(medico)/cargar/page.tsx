import { normalizeCode } from '@/components/patient-qr/qr-session';
import { UploadFlow } from '@/components/doctor-upload/upload-flow';
import { NeedsPatient } from '@/components/needs-patient';

// Placeholder until the scanner hands over a real patient from the API.
const PLACEHOLDER_PATIENT_NAME = 'Ana Martínez';

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  const code = paciente ? normalizeCode(paciente) : null;

  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Cargar estudio</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        El archivo se cifra en tu navegador antes de subirse.
      </p>

      {code ? (
        <UploadFlow patient={{ name: PLACEHOLDER_PATIENT_NAME, code }} />
      ) : (
        <NeedsPatient then="cargar el estudio" />
      )}
    </>
  );
}

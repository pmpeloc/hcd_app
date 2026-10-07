import { PatientQr } from '@/components/patient-qr/patient-qr';

// Placeholder until the session from Matias' auth plumbing is available.
const PLACEHOLDER_PATIENT_NAME = 'Ana Martínez';

export default function QrPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Mi QR</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        Mostralo en la consulta para que el médico te identifique.
      </p>
      <PatientQr patientName={PLACEHOLDER_PATIENT_NAME} />
    </>
  );
}

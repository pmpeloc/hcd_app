import { PatientQr } from '@/components/patient-qr/patient-qr';

export default function QrPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Mi QR</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        Mostralo en la consulta para que el médico te identifique.
      </p>
      <PatientQr />
    </>
  );
}

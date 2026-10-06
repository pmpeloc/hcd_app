import { DoctorScanner } from '@/components/doctor-scanner/doctor-scanner';

export default function ScanPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Escanear QR</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        El código identifica al paciente. No muestra datos médicos.
      </p>
      <DoctorScanner />
    </>
  );
}

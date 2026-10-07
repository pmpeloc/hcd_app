import { StudiesList } from '@/components/patient-studies/studies-list';

export default function StudiesPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Mis estudios</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        Tu historia es tuya. Cada estudio lo firma quien lo cargó.
      </p>
      <StudiesList />
    </>
  );
}

import { AccessCenter } from '@/components/access/access-center';

export default function AccessPage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Accesos</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        Quién puede ver tus estudios y hasta cuándo. Si no respondés, la respuesta es no.
      </p>
      <AccessCenter />
    </>
  );
}

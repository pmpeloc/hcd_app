import { TimelineList } from '@/components/timeline/timeline-list';

export default function TimelinePage() {
  return (
    <>
      <h1 className="text-[28px] lg:text-[34px] lg:tracking-[-0.03em]">Historial</h1>
      <p className="mt-0.5 text-[15px] text-muted-foreground lg:mt-1">
        Quién leyó tus estudios y cuándo. Todo queda asentado en Solana.
      </p>
      <TimelineList />
    </>
  );
}

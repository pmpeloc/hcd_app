import { cn } from '@/lib/utils';

type ProgressTrackProps = {
  value: number;
  className?: string;
};

export function ProgressTrack({ value, className }: ProgressTrackProps) {
  const scale = Math.min(1, Math.max(0, value));
  return (
    <div
      aria-hidden="true"
      className={cn('relative h-1.5 overflow-hidden rounded-full bg-salua-line', className)}
    >
      <span
        className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-salua-turquoise to-salua-blue transition-transform duration-300 ease-out-soft"
        style={{ transform: `scaleX(${scale})` }}
      />
    </div>
  );
}

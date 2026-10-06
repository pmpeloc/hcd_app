import { cn } from '@/lib/utils';

type ProgressTrackProps = {
  value: number;
  thin?: boolean;
  className?: string;
};

export function ProgressTrack({ value, thin = false, className }: ProgressTrackProps) {
  const scale = Math.min(1, Math.max(0, value));
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-full bg-salua-track',
        thin ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <span
        className="absolute inset-0 origin-left rounded-full bg-linear-to-r from-salua-turquoise to-salua-blue transition-transform duration-300 ease-out-soft"
        style={{ transform: `scaleX(${scale})` }}
      />
    </div>
  );
}

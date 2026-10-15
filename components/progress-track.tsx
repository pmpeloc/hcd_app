import { cn } from '@/lib/utils';

type ProgressTrackProps = {
  value: number;
  thin?: boolean;
  tone?: 'brand' | 'error';
  /** Linear 1 s steps, for a bar that follows a live countdown. */
  live?: boolean;
  className?: string;
};

export function ProgressTrack({ value, thin = false, tone = 'brand', live = false, className }: ProgressTrackProps) {
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
        className={cn(
          'absolute inset-0 origin-left rounded-full transition-transform motion-reduce:transition-none',
          tone === 'error' ? 'bg-salua-error-ink' : 'bg-linear-to-r from-salua-turquoise to-salua-blue',
          live ? 'duration-1000 ease-linear' : 'duration-300 ease-out-soft',
        )}
        style={{ transform: `scaleX(${scale})` }}
      />
    </div>
  );
}

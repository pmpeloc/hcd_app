'use client';

import { ProgressTrack } from '@/components/progress-track';
import { cn } from '@/lib/utils';

export const ACCESS_DURATIONS = [
  { id: '1h', label: '1 h', long: '1 hora', hours: 1, track: 0.04 },
  { id: '24h', label: '24 h', long: '24 horas', hours: 24, track: 0.15 },
  { id: '7d', label: '7 días', long: '7 días', hours: 168, track: 1 },
] as const;

export type AccessDurationId = (typeof ACCESS_DURATIONS)[number]['id'];

type DurationSelectorProps = {
  value: AccessDurationId;
  onChange: (value: AccessDurationId) => void;
  disabled?: boolean;
  className?: string;
};

export function DurationSelector({ value, onChange, disabled, className }: DurationSelectorProps) {
  const index = ACCESS_DURATIONS.findIndex((d) => d.id === value);
  const selected = ACCESS_DURATIONS[index];

  return (
    <div className={className}>
      <div
        role="group"
        aria-label="Duración del acceso"
        className="relative grid max-w-[340px] grid-cols-3 rounded-full bg-salua-mute-soft p-1"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-card shadow-[0_1px_3px_rgba(13,41,80,0.18)] transition-transform duration-[220ms] ease-out-soft"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {ACCESS_DURATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === value}
            disabled={disabled}
            onClick={() => onChange(d.id)}
            className={cn(
              'relative z-10 h-10 rounded-full text-sm font-semibold transition-colors duration-[220ms] ease-out-soft disabled:cursor-default',
              d.id === value ? 'text-salua-navy' : 'text-salua-ink-muted hover:text-primary',
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="mt-[18px] flex justify-between text-xs text-muted-foreground">
        <span>Ahora</span>
        <span>7 días</span>
      </div>
      <ProgressTrack value={selected.track} className="mt-1.5 h-2" />
      <p className="mt-3 text-sm">
        El acceso dura <strong>{selected.long}</strong> y se cierra solo.
      </p>
    </div>
  );
}

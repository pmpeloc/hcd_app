'use client';

import { cn } from '@/lib/utils';

export const ACCESS_DURATIONS = [
  { id: '1h', label: '1 h', value: 1, unit: 'h', hours: 1 },
  { id: '24h', label: '24 h', value: 24, unit: 'h', hours: 24 },
  { id: '7d', label: '7 días', value: 7, unit: 'días', hours: 168 },
] as const;

export type AccessDurationId = (typeof ACCESS_DURATIONS)[number]['id'];

type DurationSelectorProps = {
  value: AccessDurationId;
  onChange: (value: AccessDurationId) => void;
  tone?: 'light' | 'navy';
  disabled?: boolean;
  className?: string;
};

export function DurationSelector({
  value,
  onChange,
  tone = 'light',
  disabled,
  className,
}: DurationSelectorProps) {
  const index = ACCESS_DURATIONS.findIndex((d) => d.id === value);
  const navy = tone === 'navy';

  return (
    <div
      role="radiogroup"
      aria-label="Duración del permiso"
      className={cn(
        'relative grid grid-cols-3 rounded-full p-1',
        navy ? 'bg-white/10' : 'bg-salua-mute-soft',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-card transition-transform duration-[220ms] ease-out-soft',
          navy ? 'shadow-[0_2px_6px_rgba(0,0,0,0.18)]' : 'shadow-[0_1px_3px_rgba(13,41,80,0.18)]',
        )}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {ACCESS_DURATIONS.map((d) => {
        const selected = d.id === value;
        return (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(d.id)}
            className={cn(
              'relative z-10 h-11 rounded-full text-[15px] font-semibold transition-colors duration-[220ms] ease-out-soft disabled:cursor-default',
              selected && 'text-salua-navy',
              !selected && (navy ? 'text-salua-navy-ink hover:text-white' : 'text-salua-ink-muted hover:text-primary'),
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

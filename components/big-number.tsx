import { cn } from '@/lib/utils';

type BigNumberProps = {
  value: number | string;
  unit?: string;
  className?: string;
  unitClassName?: string;
};

export function BigNumber({ value, unit, className, unitClassName }: BigNumberProps) {
  return (
    <p
      key={`${value}${unit ?? ''}`}
      className={cn(
        'font-heading text-[104px] leading-[0.84] font-semibold tracking-[-0.045em] text-salua-navy tabular-nums motion-safe:animate-number-swap',
        className,
      )}
    >
      {value}
      {unit && (
        <small className={cn('ml-[0.08em] text-[0.36em] font-medium tracking-[-0.01em]', unitClassName)}>
          {unit}
        </small>
      )}
    </p>
  );
}

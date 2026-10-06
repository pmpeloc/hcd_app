import { cn } from '@/lib/utils';

type IconWellProps = {
  tone?: 'blue' | 'teal' | 'amber';
  size?: number;
  className?: string;
  children: React.ReactNode;
};

const TONES = {
  blue: 'bg-salua-info-soft text-salua-blue-ink',
  teal: 'bg-salua-ok-soft text-salua-turquoise-ink',
  amber: 'bg-salua-warn-soft text-salua-warn-ink',
};

export function IconWell({ tone = 'blue', size = 44, className, children }: IconWellProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full [&_svg]:size-[45%] [&_svg]:stroke-[1.75]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

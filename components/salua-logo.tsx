import Image from 'next/image';
import { cn } from '@/lib/utils';

type SaluaLogoProps = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function SaluaLogo({ size = 38, withWordmark = false, className }: SaluaLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/salua-logo.webp"
        alt={withWordmark ? '' : 'Salua'}
        width={Math.round((size * 238) / 256)}
        height={size}
        priority
      />
      {withWordmark && (
        <span className="font-heading text-[22px] font-semibold tracking-[-0.02em] text-salua-navy">
          Salua
        </span>
      )}
    </span>
  );
}

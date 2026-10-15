import { create } from 'qrcode';
import { cn } from '@/lib/utils';

type QrCodeProps = {
  value: string;
  label: string;
  className?: string;
};

/** Crisp vector QR: one path, no canvas, no innerHTML. */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { modules } = create(value, { errorCorrectionLevel: 'M' });
  const { size } = modules;
  let d = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules.get(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-2 -2 ${size + 4} ${size + 4}`}
      shapeRendering="crispEdges"
      className={cn('block', className)}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}

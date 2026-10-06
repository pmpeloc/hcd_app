import {
  Check,
  CircleAlert,
  Clock,
  Minus,
  ShieldCheck,
  TimerOff,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ChipVariant = 'ok' | 'info' | 'warn' | 'error' | 'mute';

const STATUSES = {
  active: { label: 'Activo', icon: Check, variant: 'ok' },
  valid: { label: 'Vigente', icon: Clock, variant: 'ok' },
  verified: { label: 'Verificado', icon: ShieldCheck, variant: 'info' },
  pending: { label: 'Pendiente', icon: CircleAlert, variant: 'warn' },
  disputed: { label: 'En disputa', icon: TriangleAlert, variant: 'warn' },
  expired: { label: 'Vencido', icon: TimerOff, variant: 'error' },
  revoked: { label: 'Revocado', icon: X, variant: 'error' },
  voided: { label: 'Anulado', icon: Minus, variant: 'mute' },
  altered: { label: 'Estudio alterado', icon: TriangleAlert, variant: 'error' },
} satisfies Record<string, { label: string; icon: LucideIcon; variant: ChipVariant }>;

export type Status = keyof typeof STATUSES;

type StatusChipProps = {
  status: Status;
  label?: string;
  className?: string;
};

export function StatusChip({ status, label, className }: StatusChipProps) {
  const { label: defaultLabel, icon: Icon, variant } = STATUSES[status];
  return (
    <Badge variant={variant} className={className}>
      <Icon aria-hidden="true" />
      {label ?? defaultLabel}
    </Badge>
  );
}

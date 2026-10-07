import { Check, Clock, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type StatusDef = { label: string; variant: 'ok' | 'info' | 'warn' | 'error' | 'mute'; icon?: LucideIcon };

const STATUSES = {
  active: { label: 'Activo', variant: 'ok', icon: Check },
  verified: { label: 'Verificado', variant: 'ok', icon: Check },
  valid: { label: 'Vigente', variant: 'info', icon: Clock },
  pending: { label: 'Pendiente', variant: 'warn' },
  disputed: { label: 'En disputa', variant: 'warn' },
  expired: { label: 'Vencido', variant: 'mute' },
  revoked: { label: 'Revocado', variant: 'mute' },
  voided: { label: 'Anulado', variant: 'mute' },
  copy: { label: 'Copia', variant: 'mute' },
  altered: { label: 'Estudio alterado', variant: 'error' },
  attended: { label: 'Atendido', variant: 'ok' },
  next: { label: 'Próximo', variant: 'info' },
  later: { label: 'Más tarde', variant: 'mute' },
} satisfies Record<string, StatusDef>;

export type Status = keyof typeof STATUSES;

type StatusChipProps = {
  status: Status;
  label?: string;
  className?: string;
};

export function StatusChip({ status, label, className }: StatusChipProps) {
  const { label: defaultLabel, icon: Icon, variant }: StatusDef = STATUSES[status];
  return (
    <Badge variant={variant} className={className}>
      {Icon && <Icon aria-hidden="true" />}
      {label ?? defaultLabel}
    </Badge>
  );
}

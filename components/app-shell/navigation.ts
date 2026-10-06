import {
  Clock,
  Eye,
  FileText,
  House,
  QrCode,
  RotateCcwClock,
  ScanLine,
  Send,
  Upload,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export type ShellRole = 'patient' | 'doctor';

export const NAVIGATION: Record<ShellRole, NavItem[]> = {
  patient: [
    { href: '/inicio', label: 'Inicio', shortLabel: 'Inicio', icon: House },
    { href: '/estudios', label: 'Mis estudios', shortLabel: 'Estudios', icon: FileText },
    { href: '/qr', label: 'Mi QR', shortLabel: 'Mi QR', icon: QrCode },
    { href: '/accesos', label: 'Accesos', shortLabel: 'Accesos', icon: Clock },
    { href: '/linea-de-tiempo', label: 'Historial', shortLabel: 'Historial', icon: RotateCcwClock },
  ],
  doctor: [
    { href: '/panel', label: 'Inicio', shortLabel: 'Inicio', icon: House },
    { href: '/escanear', label: 'Escanear QR', shortLabel: 'Escanear', icon: ScanLine },
    { href: '/cargar', label: 'Cargar estudio', shortLabel: 'Cargar', icon: Upload },
    { href: '/solicitar', label: 'Pedir acceso', shortLabel: 'Pedir', icon: Send },
    { href: '/mis-accesos', label: 'Mis accesos', shortLabel: 'Accesos', icon: Eye },
  ],
};

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

'use client';

import { usePathname } from 'next/navigation';
import { NAVIGATION, isActive, type ShellRole } from './navigation';

export function Breadcrumb({ role }: { role: ShellRole }) {
  const pathname = usePathname();
  const [home, ...rest] = NAVIGATION[role];
  const current = rest.find((item) => isActive(pathname, item.href));

  return (
    <p className="text-sm text-muted-foreground">
      {current ? (
        <>
          {home.label} / <strong className="font-semibold text-salua-navy">{current.label}</strong>
        </>
      ) : (
        <strong className="font-semibold text-salua-navy">{home.label}</strong>
      )}
    </p>
  );
}

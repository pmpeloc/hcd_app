'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION, isActive, type ShellRole } from './navigation';

export function SidebarNav({ role }: { role: ShellRole }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAVIGATION[role].map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-full px-3.5 text-[15px] transition-colors duration-200 ease-out-soft',
              active
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'font-medium text-sidebar-foreground hover:bg-[#f1f4f8]',
            )}
          >
            <Icon aria-hidden="true" className="size-5 stroke-[1.75]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

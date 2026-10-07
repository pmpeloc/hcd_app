'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION, isActive, type NavBadges, type ShellRole } from './navigation';

export function SidebarNav({ role, badges }: { role: ShellRole; badges?: NavBadges }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAVIGATION[role].map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const count = badges?.[href] ?? 0;
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
            {count > 0 && (
              <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                <span className="sr-only">, </span>
                {count}
                <span className="sr-only"> pendiente{count > 1 ? 's' : ''}</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

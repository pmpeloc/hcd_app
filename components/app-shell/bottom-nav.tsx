'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION, isActive, type ShellRole } from './navigation';

export function BottomNav({ role, className }: { role: ShellRole; className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-border bg-card px-3 pt-2 pb-[max(18px,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {NAVIGATION[role].map(({ href, shortLabel, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-[3px] rounded-[14px] py-[7px] text-[11px] transition-colors duration-200 ease-out-soft',
              active
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'font-medium text-muted-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-[22px] stroke-[1.75]" />
            {shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

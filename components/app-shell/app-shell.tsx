import { Bell } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { SaluaLogo } from '@/components/salua-logo';
import { UserAvatar } from '@/components/user-avatar';
import { BottomNav } from './bottom-nav';
import type { NavBadges, ShellRole } from './navigation';
import { SidebarNav } from './sidebar-nav';

export type ShellUser = {
  name: string;
  subtitle: string;
};

export type ShellNote = {
  icon: React.ReactNode;
  title: string;
  body: string;
};

type AppShellProps = {
  role: ShellRole;
  user: ShellUser;
  note?: ShellNote;
  badges?: NavBadges;
  unreadNotifications?: number;
  topBar?: React.ReactNode;
  children: React.ReactNode;
};

function NotificationsButton({ unread = 0 }: { unread?: number }) {
  return (
    <button
      type="button"
      aria-label={unread > 0 ? `Notificaciones, ${unread} nueva${unread > 1 ? 's' : ''}` : 'Notificaciones'}
      className="relative grid size-11 place-items-center rounded-full border border-border bg-card text-salua-navy"
    >
      <Bell aria-hidden="true" className="size-5 stroke-[1.75]" />
      {unread > 0 && (
        <span className="absolute top-[9px] right-2.5 size-2 rounded-full bg-salua-error shadow-[0_0_0_2px_#fff]" />
      )}
    </button>
  );
}

export function AppShell({ role, user, note, badges, unreadNotifications, topBar, children }: AppShellProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-66 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-[18px] py-6 lg:flex">
        <SaluaLogo withWordmark className="px-1.5" />
        <SidebarNav role={role} badges={badges} />
        {note && (
          <div className="mt-auto rounded-[18px] bg-background p-4">
            <div className="flex items-center gap-2.5">
              <IconWell tone="teal" size={32}>
                {note.icon}
              </IconWell>
              <p className="text-[13px] font-semibold text-salua-navy">{note.title}</p>
            </div>
            <p className="mt-2 text-[13px] leading-normal text-muted-foreground">{note.body}</p>
          </div>
        )}
        <div className={note ? 'flex items-center gap-2.5 px-1.5' : 'mt-auto flex items-center gap-2.5 px-1.5'}>
          <UserAvatar name={user.name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-salua-navy">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.subtitle}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pt-5 lg:hidden">
          <SaluaLogo size={34} />
          <div className="flex items-center gap-2.5">
            <NotificationsButton unread={unreadNotifications} />
            <UserAvatar name={user.name} size={44} />
          </div>
        </header>
        {topBar && (
          <header className="hidden min-h-[72px] flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-8 py-3 lg:flex">
            {topBar}
          </header>
        )}
        <main className="flex-1 px-5 pt-5 pb-32 lg:px-8 lg:pt-7 lg:pb-10">
          <div className="max-w-[1180px]">{children}</div>
        </main>
      </div>

      <BottomNav role={role} className="lg:hidden" />
    </div>
  );
}

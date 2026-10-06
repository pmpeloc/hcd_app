import { Bell } from 'lucide-react';
import { IconWell } from '@/components/icon-well';
import { SaluaLogo } from '@/components/salua-logo';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { BottomNav } from './bottom-nav';
import { Breadcrumb } from './breadcrumb';
import type { ShellRole } from './navigation';
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
  note: ShellNote;
  children: React.ReactNode;
};

function NotificationsButton() {
  return (
    <Button variant="outline" size="icon" aria-label="Notificaciones">
      <Bell aria-hidden="true" className="stroke-[1.75]" />
    </Button>
  );
}

export function AppShell({ role, user, note, children }: AppShellProps) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-66 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-[18px] py-6 lg:flex">
        <SaluaLogo withWordmark className="px-1.5" />
        <SidebarNav role={role} />
        <div className="mt-auto rounded-2xl bg-background p-4">
          <div className="flex items-center gap-2.5">
            <IconWell tone="teal" size={32}>
              {note.icon}
            </IconWell>
            <p className="text-[13px] font-semibold text-salua-navy">{note.title}</p>
          </div>
          <p className="mt-2 text-[13px] leading-normal text-muted-foreground">{note.body}</p>
        </div>
        <div className="flex items-center gap-2.5 px-1.5">
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
            <NotificationsButton />
            <UserAvatar name={user.name} size={44} />
          </div>
        </header>
        <header className="hidden h-[72px] items-center justify-between border-b border-border bg-card px-8 lg:flex">
          <Breadcrumb role={role} />
          <NotificationsButton />
        </header>
        <main className="flex-1 px-5 pt-[22px] pb-32 lg:p-8">
          <div className="mx-auto max-w-[1180px] lg:mx-0">{children}</div>
        </main>
      </div>

      <BottomNav role={role} className="lg:hidden" />
    </div>
  );
}

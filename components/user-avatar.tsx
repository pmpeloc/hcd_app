import { cn } from '@/lib/utils';

export function initialsOf(name: string) {
  return name
    .replace(/^(Dra?\.)\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type UserAvatarProps = {
  name: string;
  size?: number;
  tone?: 'navy' | 'soft';
  className?: string;
};

export function UserAvatar({ name, size = 40, tone = 'navy', className }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'grid shrink-0 place-items-center rounded-full text-sm font-semibold',
        tone === 'navy' ? 'bg-salua-navy text-white' : 'bg-salua-info-soft text-salua-blue-ink',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

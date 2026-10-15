import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

const tileVariants = cva(
  'relative overflow-hidden rounded-[22px] border p-4 text-salua-ink lg:rounded-3xl lg:p-[22px] [&:is(a)]:transition-transform [&:is(a)]:duration-160 [&:is(a)]:ease-out-soft [&:is(a):active]:scale-[0.98]',
  {
    variants: {
      tone: {
        white: 'border-border bg-card shadow-tile',
        sky: 'border-salua-sky-line bg-salua-sky',
        mint: 'border-salua-mint-line bg-salua-mint',
        navy: 'border-salua-navy bg-salua-navy text-white',
      },
    },
    defaultVariants: { tone: 'white' },
  },
);

type TileProps = React.ComponentProps<'section'> &
  VariantProps<typeof tileVariants> & { asChild?: boolean };

export function Tile({ className, tone, asChild = false, ...props }: TileProps) {
  const Comp = asChild ? Slot.Root : 'section';
  return <Comp data-tone={tone ?? 'white'} className={cn(tileVariants({ tone }), className)} {...props} />;
}

export function TileDots({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -top-3 -right-3 h-[120px] w-[180px] bg-[radial-gradient(circle,#4fa9ee_1.2px,transparent_1.5px)] bg-size-[12px_12px] opacity-35',
        className,
      )}
    />
  );
}

export function TileCross({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn('pointer-events-none absolute -top-[30px] -right-[30px] w-[150px]', className)}
    >
      <path d="M38 6h24v32h32v24H62v32H38V62H6V38h32z" fill="#fff" opacity={0.75} />
    </svg>
  );
}

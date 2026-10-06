import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-200 ease-out-soft select-none active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:border-transparent disabled:bg-salua-mute-soft disabled:text-[#8d97a8] aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-salua-navy",
        outline:
          "border-salua-line-strong bg-card text-salua-navy hover:border-primary hover:text-primary aria-expanded:border-primary aria-expanded:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-salua-line aria-expanded:bg-salua-line",
        ghost:
          "text-primary hover:bg-accent aria-expanded:bg-accent",
        destructive:
          "border-[#e8b9c0] bg-card text-salua-error-ink hover:bg-salua-error-soft",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 text-[15px]",
        sm: "h-[38px] gap-1.5 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-[50px] gap-2 px-[26px] text-[15px]",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-sm": "size-[38px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

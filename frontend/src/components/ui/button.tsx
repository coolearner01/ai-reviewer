import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-gh-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: GitHub green
        default:
          'bg-gh-accent text-white border border-gh-accent-hover hover:bg-gh-accent-hover',
        // Secondary / outline: dark surface with hairline border
        outline:
          'bg-gh-surface text-gh-text border border-gh-border hover:bg-gh-border-muted hover:border-gh-border',
        secondary:
          'bg-gh-surface text-gh-text border border-gh-border hover:bg-gh-border-muted',
        ghost: 'text-gh-text-muted hover:bg-gh-border-muted hover:text-gh-text',
        link: 'text-gh-blue-muted underline-offset-4 hover:underline',
        destructive:
          'bg-gh-red text-white border border-gh-red hover:opacity-90',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-xs rounded-md',
        lg: 'h-9 px-4 text-sm rounded-md',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

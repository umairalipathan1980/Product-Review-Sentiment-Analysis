import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-copper focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-emerald-600 text-white shadow-float hover:bg-emerald-700',
        outline: 'border border-slate-300 bg-white/75 text-slate-700 shadow-sm hover:border-dashboard-copper hover:bg-amber-50 hover:text-slate-900',
        secondary: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
        ghost: 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700',
        link: 'text-dashboard-copper underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-12 px-5 py-2',
        sm: 'h-9 rounded-xl px-4',
        lg: 'h-14 rounded-[20px] px-6 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }

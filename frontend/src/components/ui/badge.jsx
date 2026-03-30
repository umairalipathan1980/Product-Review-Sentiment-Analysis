import { cn } from '../../lib/utils'

const badgeVariants = {
  positive: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  negative: 'bg-rose-100 text-rose-700 border-rose-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200'
}

export function Badge({ children, variant = 'default', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

import { motion } from 'framer-motion'
import { Card, CardContent } from '../ui/card'

const colorVariants = {
  positive: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    icon: 'text-emerald-500'
  },
  negative: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    icon: 'text-rose-500'
  },
  brand: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'text-blue-500'
  },
  insight: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'text-purple-500'
  },
  neutral: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    icon: 'text-slate-500'
  }
}

export function MetricCard({ title, value, subtitle, icon: Icon, color = 'neutral', delay = 0 }) {
  const colors = colorVariants[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
              <motion.p
                className={`text-3xl font-bold ${colors.text}`}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: delay + 0.2 }}
              >
                {value !== undefined && value !== null ? value : '—'}
              </motion.p>
              {subtitle && (
                <p className="text-sm text-slate-500 mt-2">{subtitle}</p>
              )}
            </div>
            {Icon && (
              <div className={`p-3 rounded-xl ${colors.bg}`}>
                <Icon className={`w-6 h-6 ${colors.icon}`} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

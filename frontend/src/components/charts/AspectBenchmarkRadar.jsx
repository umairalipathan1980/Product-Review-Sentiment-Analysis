import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

const COLORS = ['#2563eb', '#f59e0b', '#e11d48', '#0ea5e9', '#10b981']

export function AspectBenchmarkRadar({ categories, series, height = 430 }) {
  if (!categories?.length || !series?.length) {
    return (
      <div className="flex h-[320px] items-center justify-center text-slate-400">
        <p>No benchmark data available for selected filters</p>
      </div>
    )
  }

  const data = categories.map((aspect, idx) => {
    const row = { aspect }
    series.forEach((s) => {
      row[s.name] = Number(s.values?.[idx] || 0)
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="aspect" tick={{ fill: '#334155', fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip />
        <Legend />
        {series.map((s, idx) => (
          <Radar
            key={s.name}
            name={s.name}
            dataKey={s.name}
            stroke={COLORS[idx % COLORS.length]}
            fill={COLORS[idx % COLORS.length]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  )
}


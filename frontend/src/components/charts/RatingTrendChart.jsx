import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function rollingMean(values, windowSize) {
  const out = []
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]
    if (i >= windowSize) sum -= values[i - windowSize]
    const denom = Math.min(i + 1, windowSize)
    out.push(Number((sum / denom).toFixed(2)))
  }
  return out
}

export function RatingTrendChart({ data, mode = 'rolling', height = 240 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-slate-400">
        <p>No data available</p>
      </div>
    )
  }

  const preparedData = (() => {
    const hasRolling7 = data.some((row) => row.avg_rating_rolling_7d !== undefined && row.avg_rating_rolling_7d !== null && row.avg_rating_rolling_7d !== '')
    const hasRolling30 = data.some((row) => row.avg_rating_rolling_30d !== undefined && row.avg_rating_rolling_30d !== null && row.avg_rating_rolling_30d !== '')
    if (hasRolling7 && hasRolling30) return data

    const ratings = data.map((row) => toNumber(row.avg_rating))
    const rolling7 = rollingMean(ratings, 7)
    const rolling30 = rollingMean(ratings, 30)
    return data.map((row, idx) => ({
      ...row,
      avg_rating_rolling_7d: hasRolling7 ? toNumber(row.avg_rating_rolling_7d) : rolling7[idx],
      avg_rating_rolling_30d: hasRolling30 ? toNumber(row.avg_rating_rolling_30d) : rolling30[idx],
    }))
  })()

  if (mode === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Area type="monotone" dataKey="avg_rating" stroke="#2563eb" fill="#93c5fd" fillOpacity={0.35} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'volume') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis yAxisId="rating" domain={[0, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis yAxisId="volume" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Bar yAxisId="volume" dataKey="review_count" fill="#cbd5e1" />
          <Line yAxisId="rating" type="monotone" dataKey="avg_rating" stroke="#2563eb" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'daily') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Line type="monotone" dataKey="avg_rating" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'rolling30') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Line type="monotone" dataKey="avg_rating" stroke="#bfdbfe" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="avg_rating_rolling_30d" stroke="#1e3a8a" strokeWidth={3} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={preparedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={[0, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Line type="monotone" dataKey="avg_rating" stroke="#93c5fd" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="avg_rating_rolling_7d" stroke="#1d4ed8" strokeWidth={3} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

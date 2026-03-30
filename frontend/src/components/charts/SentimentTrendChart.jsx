import {
  Area,
  AreaChart,
  CartesianGrid,
  LineChart as RechartsLineChart,
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
    out.push(Number((sum / denom).toFixed(1)))
  }
  return out
}

export function SentimentTrendChart({ data, mode = 'composition', height = 240 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-slate-400">
        <p>No data available</p>
      </div>
    )
  }

  const preparedData = (() => {
    const hasRolling7 = data.some((row) => row.positive_rolling_7d !== undefined && row.positive_rolling_7d !== null && row.positive_rolling_7d !== '')
    const hasRolling30 = data.some((row) => row.positive_rolling_30d !== undefined && row.positive_rolling_30d !== null && row.positive_rolling_30d !== '')
    if (hasRolling7 && hasRolling30) return data

    const positives = data.map((row) => toNumber(row.positive_percent))
    const rolling7 = rollingMean(positives, 7)
    const rolling30 = rollingMean(positives, 30)
    return data.map((row, idx) => ({
      ...row,
      positive_rolling_7d: hasRolling7 ? toNumber(row.positive_rolling_7d) : rolling7[idx],
      positive_rolling_30d: hasRolling30 ? toNumber(row.positive_rolling_30d) : rolling30[idx],
    }))
  })()

  if (mode === 'rolling') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Area type="monotone" dataKey="positive_percent" stroke="#34d399" fill="#a7f3d0" fillOpacity={0.35} />
          <Line type="monotone" dataKey="positive_rolling_7d" stroke="#059669" strokeWidth={3} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'rolling30') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Area type="monotone" dataKey="positive_percent" stroke="#6ee7b7" fill="#d1fae5" fillOpacity={0.35} />
          <Line type="monotone" dataKey="positive_rolling_30d" stroke="#047857" strokeWidth={3} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'dual') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Line type="monotone" dataKey="positive_percent" stroke="#16a34a" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="negative_percent" stroke="#e11d48" strokeWidth={2.5} dot={false} />
        </RechartsLineChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'net') {
    const netData = preparedData.map((row) => ({
      ...row,
      net_sentiment: Number(row.positive_percent || 0) - Number(row.negative_percent || 0),
    }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={netData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[-100, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Area type="monotone" dataKey="net_sentiment" stroke="#0f766e" fill="#2dd4bf" fillOpacity={0.3} />
          <Line type="monotone" dataKey="net_sentiment" stroke="#0f766e" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={preparedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Area type="monotone" dataKey="positive_percent" stackId="sentiment" stroke="#10b981" fill="#10b981" fillOpacity={0.85} />
        <Area type="monotone" dataKey="neutral_percent" stackId="sentiment" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.9} />
        <Area type="monotone" dataKey="negative_percent" stackId="sentiment" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.85} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

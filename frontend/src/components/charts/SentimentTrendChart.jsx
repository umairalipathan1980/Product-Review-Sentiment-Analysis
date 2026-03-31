import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  LineChart as RechartsLineChart,
  Line,
  ReferenceLine,
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

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
}

function brush(data) {
  const startIndex = Math.max(0, data.length - Math.round(data.length * 0.35))
  return (
    <Brush
      dataKey="date"
      startIndex={startIndex}
      height={32}
      stroke="#cbd5e1"
      fill="#f8fafc"
      travellerWidth={10}
      style={{ fontSize: 11 }}
    />
  )
}

function autoYDomain(values, padding = 5) {
  const valid = values.filter((v) => v != null && Number.isFinite(v))
  if (valid.length === 0) return [0, 100]
  const min = Math.max(0, Math.floor(Math.min(...valid)) - padding)
  const max = Math.min(100, Math.ceil(Math.max(...valid)) + padding)
  return [min, max]
}

// Zoom view: clean smoothed-only chart with auto-scaled Y axis
function ZoomSentimentChart({ preparedData, mode, height }) {
  const rolling30d = preparedData.map((r) => toNumber(r.positive_rolling_30d))
  const rolling7d = preparedData.map((r) => toNumber(r.positive_rolling_7d))
  const positives = preparedData.map((r) => toNumber(r.positive_percent))
  const negatives = preparedData.map((r) => toNumber(r.negative_percent))

  if (mode === 'composition') {
    // In zoom mode, composition is cleaner as stacked areas — no change needed, it already looks good
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Area type="monotone" dataKey="positive_percent" stackId="s" stroke="#10b981" fill="#10b981" fillOpacity={0.85} name="Positive" />
          <Area type="monotone" dataKey="neutral_percent" stackId="s" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.9} name="Neutral" />
          <Area type="monotone" dataKey="negative_percent" stackId="s" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.85} name="Negative" />
          {brush(preparedData)}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'dual') {
    const domain = autoYDomain([...positives, ...negatives])
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
          <Line type="monotone" dataKey="positive_percent" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Positive" />
          <Line type="monotone" dataKey="negative_percent" stroke="#e11d48" strokeWidth={2.5} dot={false} name="Negative" />
          {brush(preparedData)}
        </RechartsLineChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'net') {
    const netData = preparedData.map((row) => ({
      ...row,
      net_sentiment: Number(row.positive_percent || 0) - Number(row.negative_percent || 0),
    }))
    const nets = netData.map((r) => r.net_sentiment)
    const domain = autoYDomain(nets, 5)
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={netData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v.toFixed(1)}%`} />
          <Area type="monotone" dataKey="net_sentiment" stroke="#0f766e" fill="#2dd4bf" fillOpacity={0.3} name="Net sentiment" />
          {brush(netData)}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // rolling / rolling30 — show ONLY the smoothed line, no raw daily noise
  const smoothKey = mode === 'rolling30' ? 'positive_rolling_30d' : 'positive_rolling_7d'
  const smoothValues = mode === 'rolling30' ? rolling30d : rolling7d
  const domain = autoYDomain(smoothValues)
  const strokeColor = mode === 'rolling30' ? '#047857' : '#059669'
  const fillColor = mode === 'rolling30' ? '#d1fae5' : '#a7f3d0'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sentZoomGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fillColor} stopOpacity={0.6} />
            <stop offset="95%" stopColor={fillColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}%`} />
        <Area
          type="monotone"
          dataKey={smoothKey}
          stroke={strokeColor}
          strokeWidth={2.5}
          fill="url(#sentZoomGrad)"
          dot={false}
          name={mode === 'rolling30' ? '30-day rolling avg' : '7-day rolling avg'}
        />
        {brush(preparedData)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function SentimentTrendChart({ data, mode = 'composition', height = 240, zoom = false }) {
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

  if (zoom) {
    return <ZoomSentimentChart preparedData={preparedData} mode={mode} height={height} />
  }

  if (mode === 'rolling') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
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
          <Tooltip contentStyle={tooltipStyle} />
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
          <Tooltip contentStyle={tooltipStyle} />
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
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="net_sentiment" stroke="#0f766e" fill="#2dd4bf" fillOpacity={0.3} />
          <Line type="monotone" dataKey="net_sentiment" stroke="#0f766e" strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // default: composition
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={preparedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="positive_percent" stackId="sentiment" stroke="#10b981" fill="#10b981" fillOpacity={0.85} />
        <Area type="monotone" dataKey="neutral_percent" stackId="sentiment" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.9} />
        <Area type="monotone" dataKey="negative_percent" stackId="sentiment" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.85} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

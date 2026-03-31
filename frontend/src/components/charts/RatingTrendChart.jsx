import {
  Area,
  AreaChart,
  Bar,
  Brush,
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

function autoYDomain(values, padding = 0.2) {
  const valid = values.filter((v) => v != null && Number.isFinite(v) && v > 0)
  if (valid.length === 0) return [1, 5]
  const min = Math.max(1, Math.floor((Math.min(...valid) - padding) * 10) / 10)
  const max = Math.min(5, Math.ceil((Math.max(...valid) + padding) * 10) / 10)
  return [min, max]
}

// Zoom view: shows only the smoothed line with auto-scaled Y, no raw daily noise
function ZoomRatingChart({ preparedData, mode, height }) {
  if (mode === 'volume') {
    // Volume mode: keep as-is, it's already readable
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis yAxisId="rating" domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis yAxisId="volume" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar yAxisId="volume" dataKey="review_count" fill="#e2e8f0" name="Reviews" />
          <Line yAxisId="rating" type="monotone" dataKey="avg_rating" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Avg rating" />
          {brush(preparedData)}
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'area') {
    const values = preparedData.map((r) => toNumber(r.avg_rating))
    const domain = autoYDomain(values)
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ratingZoomGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="avg_rating" stroke="#2563eb" strokeWidth={2.5} fill="url(#ratingZoomGrad)" dot={false} name="Avg rating" />
          {brush(preparedData)}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'daily') {
    const values = preparedData.map((r) => toNumber(r.avg_rating))
    const domain = autoYDomain(values)
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ratingZoomGradD" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="avg_rating" stroke="#3b82f6" strokeWidth={2.5} fill="url(#ratingZoomGradD)" dot={false} name="Avg rating" />
          {brush(preparedData)}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // rolling / rolling30 — show ONLY the smoothed line, no raw daily noise
  const smoothKey = mode === 'rolling30' ? 'avg_rating_rolling_30d' : 'avg_rating_rolling_7d'
  const smoothValues = preparedData.map((r) => toNumber(r[smoothKey]))
  const domain = autoYDomain(smoothValues)
  const strokeColor = mode === 'rolling30' ? '#1e3a8a' : '#1d4ed8'
  const fillId = mode === 'rolling30' ? 'ratingZoom30' : 'ratingZoom7'
  const fillStop = mode === 'rolling30' ? '#bfdbfe' : '#93c5fd'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={preparedData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fillStop} stopOpacity={0.5} />
            <stop offset="95%" stopColor={fillStop} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={domain} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey={smoothKey}
          stroke={strokeColor}
          strokeWidth={2.5}
          fill={`url(#${fillId})`}
          dot={false}
          name={mode === 'rolling30' ? '30-day rolling avg' : '7-day rolling avg'}
        />
        {brush(preparedData)}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function RatingTrendChart({ data, mode = 'rolling', height = 240, zoom = false }) {
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

  if (zoom) {
    return <ZoomRatingChart preparedData={preparedData} mode={mode} height={height} />
  }

  if (mode === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={preparedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
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
          <YAxis yAxisId="rating" domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis yAxisId="volume" orientation="right" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
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
          <YAxis domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
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
          <YAxis domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="avg_rating" stroke="#bfdbfe" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="avg_rating_rolling_30d" stroke="#1e3a8a" strokeWidth={3} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  // default: rolling 7d
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={preparedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis domain={[1, 5]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="avg_rating" stroke="#93c5fd" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="avg_rating_rolling_7d" stroke="#1d4ed8" strokeWidth={3} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

const POSITIVE_COLOR = '#22c55e'
const NEGATIVE_COLOR = '#ef4444'
const NEUTRAL_COLOR = '#94a3b8'

function CustomTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const netSentiment = Number(row.positive_percent || 0) - Number(row.negative_percent || 0)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="text-green-600">Positive: {row.positive_count ?? 0}</p>
      <p className="text-rose-600">Negative: {row.negative_count ?? 0}</p>
      {mode !== 'counts' && <p className="text-slate-600">Positive %: {row.positive_percent ?? 0}%</p>}
      {mode !== 'counts' && <p className="text-slate-600">Negative %: {row.negative_percent ?? 0}%</p>}
      {mode === 'net' && <p className="text-slate-600">Net sentiment: {netSentiment.toFixed(1)}</p>}
      <p className="text-slate-600">Total mentions: {row.total_count ?? 0}</p>
    </div>
  )
}

// Create label functions that have access to data array
function createPositiveLabel(dataArray) {
  return function PositiveLabel(props) {
    if (!props.value) return null
    const dataPoint = dataArray[props.index]
    const percent = dataPoint?.positive_percent ?? 0
    return (
      <text x={props.x + props.width + 6} y={props.y + 12} fill="#14532d" fontSize={12} fontWeight={600}>
        {`${props.value} (${percent}%)`}
      </text>
    )
  }
}

function createNegativeLabel(dataArray) {
  return function NegativeLabel(props) {
    if (!props.value) return null
    const dataPoint = dataArray[props.index]
    const percent = dataPoint?.negative_percent ?? 0
    return (
      <text x={props.x + props.width + 6} y={props.y + 12} fill="#7f1d1d" fontSize={12} fontWeight={600}>
        {`${props.value} (${percent}%)`}
      </text>
    )
  }
}

export function AspectSentimentChart({ data, mode = 'grouped', height = 400 }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center text-slate-400">
        <p>No aspect sentiment data available</p>
      </div>
    )
  }

  if (mode === 'stacked') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} layout="vertical" margin={{ top: 8, right: 28, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis type="category" dataKey="aspect" stroke="#334155" fontSize={13} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} width={170} />
          <Tooltip content={<CustomTooltip mode={mode} />} />
          <Legend />
          <Bar dataKey="positive_count" stackId="mentions" fill={POSITIVE_COLOR} name="Positive mentions" />
          <Bar dataKey="negative_count" stackId="mentions" fill={NEGATIVE_COLOR} name="Negative mentions" />
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'ratio') {
    const ratioData = data.map((row) => ({
      ...row,
      other_percent: Math.max(0, 100 - Number(row.positive_percent || 0) - Number(row.negative_percent || 0)),
    }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={ratioData} layout="vertical" margin={{ top: 8, right: 28, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis type="category" dataKey="aspect" stroke="#334155" fontSize={13} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} width={170} />
          <Tooltip content={<CustomTooltip mode={mode} />} />
          <Legend />
          <Bar dataKey="positive_percent" stackId="ratio" fill={POSITIVE_COLOR} name="Positive %" />
          <Bar dataKey="negative_percent" stackId="ratio" fill={NEGATIVE_COLOR} name="Negative %" />
          <Bar dataKey="other_percent" stackId="ratio" fill={NEUTRAL_COLOR} name="Other %" />
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  if (mode === 'net') {
    const netData = data.map((row) => ({
      ...row,
      net_sentiment: Number(row.positive_percent || 0) - Number(row.negative_percent || 0),
    }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={netData} layout="vertical" margin={{ top: 8, right: 28, left: 24, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" domain={[-100, 100]} stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
          <YAxis type="category" dataKey="aspect" stroke="#334155" fontSize={13} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} width={170} />
          <Tooltip content={<CustomTooltip mode={mode} />} />
          <Bar dataKey="net_sentiment" name="Net sentiment">
            {netData.map((entry, index) => (
              <Cell key={`net-${entry.aspect}-${index}`} fill={entry.net_sentiment >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout="vertical"
        barCategoryGap={12}
        margin={{ top: 8, right: 140, left: 24, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis
          type="category"
          dataKey="aspect"
          stroke="#334155"
          fontSize={13}
          tickLine={false}
          axisLine={{ stroke: '#cbd5e1' }}
          width={170}
        />
        <Tooltip content={<CustomTooltip mode={mode} />} />
        <Legend />

        <Bar dataKey="positive_count" name="Positive" fill={POSITIVE_COLOR} radius={[3, 3, 3, 3]}>
          <LabelList dataKey="positive_count" content={createPositiveLabel(data)} />
        </Bar>
        <Bar dataKey="negative_count" name="Negative" fill={NEGATIVE_COLOR} radius={[3, 3, 3, 3]}>
          <LabelList dataKey="negative_count" content={createNegativeLabel(data)} />
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}

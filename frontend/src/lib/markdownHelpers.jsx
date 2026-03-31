import { ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'

// Convert plain-text agent output to richer markdown before rendering
export function enrichAgentText(text) {
  if (!text) return text

  // Wrap UPPERCASE_WITH_UNDERSCORES aspect names in backticks so they render as styled chips
  let out = text.replace(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g, (m) => `\`${m}\``)

  // Convert bare "Key: value" blocks (2+ consecutive colon-separated lines) into bullet lists
  // Skip lines that are already markdown list items (start with -, *, or a digit followed by .)
  out = out.replace(/((?:^.+:.+\n?){2,})/gm, (block) => {
    const lines = block.trimEnd().split('\n')
    const allColon = lines.every((l) => l.includes(':'))
    const alreadyList = lines.some((l) => /^\s*[-*]|\s*\d+\./.test(l))
    if (!allColon || alreadyList) return block
    return lines.map((l) => `- ${l.trim()}`).join('\n') + '\n'
  })

  return out
}

// Custom ReactMarkdown component renderers for rich visual output
export const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-4 text-base font-bold text-slate-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-sm font-bold text-slate-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-700 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="mb-2 text-sm leading-7 text-slate-800 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 mt-1 space-y-1.5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 mt-1 space-y-1.5 last:mb-0 list-none">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex items-start gap-2 text-sm leading-6 text-slate-800">
      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dashboard-copper" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  code: ({ children }) => {
    const val = String(children)
    if (/^positive$/i.test(val))
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <TrendingUp className="h-3 w-3" />positive
        </span>
      )
    if (/^negative$/i.test(val))
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
          <TrendingDown className="h-3 w-3" />negative
        </span>
      )
    if (/^neutral$/i.test(val))
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
          <Minus className="h-3 w-3" />neutral
        </span>
      )
    // Aspect name chips (UPPERCASE_WITH_UNDERSCORES)
    if (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(val))
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-dashboard-copper ring-1 ring-amber-200">
          {val.replace(/_/g, ' ')}
        </span>
      )
    return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[12px] font-mono text-slate-700">{children}</code>
  },
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-4 border-dashboard-copper/30 pl-3 italic text-slate-600">
      {children}
    </blockquote>
  ),
}

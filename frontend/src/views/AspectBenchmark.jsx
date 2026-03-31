import { useEffect, useMemo, useRef, useState } from 'react'
import { Radar, Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { enrichAgentText, markdownComponents } from '../lib/markdownHelpers'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { AspectBenchmarkRadar } from '../components/charts/AspectBenchmarkRadar'
import { fetchAspectBenchmark, interpretChart } from '../lib/api'

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || 'Unknown error'
}

export function AspectBenchmark() {
  const [scope, setScope] = useState('overall')
  const [source, setSource] = useState('all')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [selectedCountries, setSelectedCountries] = useState([])
  const [selectedSources, setSelectedSources] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState({
    categories: [],
    series: [],
    available_sources: ['all'],
    available_products: [],
    available_countries: []
  })
  const latestRequestId = useRef(0)

  // Interpretation state
  const [showInterpretation, setShowInterpretation] = useState(false)
  const [interpretation, setInterpretation] = useState('')
  const [interpretLoading, setInterpretLoading] = useState(false)

  const productOptions = useMemo(() => payload.available_products || [], [payload.available_products])
  const countryOptions = useMemo(() => payload.available_countries || [], [payload.available_countries])
  const sourceOptions = useMemo(() => payload.available_sources || ['all'], [payload.available_sources])
  const benchmarkSourceOptions = useMemo(() => sourceOptions.filter((option) => option !== 'all'), [sourceOptions])

  useEffect(() => {
    setSelectedProducts((current) => {
      const next = current.filter((product) => productOptions.includes(product))
      if (next.length === current.length && next.every((value, idx) => value === current[idx])) {
        return current
      }
      return next
    })
  }, [productOptions])

  useEffect(() => {
    setSelectedCountries((current) => {
      const next = current.filter((country) => countryOptions.includes(country))
      if (next.length === current.length && next.every((value, idx) => value === current[idx])) {
        return current
      }
      return next
    })
  }, [countryOptions])

  useEffect(() => {
    setSelectedSources((current) => {
      const next = current.filter((item) => benchmarkSourceOptions.includes(item))
      if (next.length === current.length && next.every((value, idx) => value === current[idx])) {
        return current
      }
      return next
    })
  }, [benchmarkSourceOptions])

  useEffect(() => {
    const load = async () => {
      const requestId = ++latestRequestId.current
      try {
        setLoading(true)
        setError('')
        const response = await fetchAspectBenchmark({
          scope,
          source,
          products: scope === 'product' ? selectedProducts : [],
          countries: scope === 'country' ? selectedCountries : [],
          sources: scope === 'source' ? selectedSources : []
        })
        if (requestId !== latestRequestId.current) return
        setPayload(response?.data || {})
      } catch (err) {
        if (requestId !== latestRequestId.current) return
        setError(getErrorMessage(err))
      } finally {
        if (requestId !== latestRequestId.current) return
        setLoading(false)
      }
    }
    load()
  }, [scope, source, selectedProducts, selectedCountries, selectedSources])

  const toggleProduct = (value) => {
    setSelectedProducts((current) => {
      if (current.includes(value)) return current.filter((p) => p !== value)
      if (current.length >= 4) return current
      return [...current, value]
    })
  }

  const toggleCountry = (value) => {
    setSelectedCountries((current) => {
      if (current.includes(value)) return current.filter((c) => c !== value)
      if (current.length >= 4) return current
      return [...current, value]
    })
  }

  const toggleSource = (value) => {
    setSelectedSources((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value)
      if (current.length >= 4) return current
      return [...current, value]
    })
  }

  const handleInterpretBenchmark = async () => {
    if (!payload.categories || payload.categories.length === 0 || !payload.series || payload.series.length === 0) return

    setShowInterpretation(true)
    setInterpretLoading(true)
    setInterpretation('')

    try {
      // Prepare context
      const scopeContext = scope === 'overall'
        ? 'overall (all products and countries combined)'
        : scope === 'product'
        ? `product comparison: ${selectedProducts.join(', ')}`
        : scope === 'country'
        ? `country comparison: ${selectedCountries.join(', ')}`
        : `source comparison: ${selectedSources.join(', ')}`

      // Format the benchmark data
      const aspects = payload.categories
      const seriesData = payload.series.map(s => {
        const dataStr = aspects.map((aspect, idx) => `${aspect}: ${s.values[idx]}%`).join(', ')
        return `- **${s.name}**: ${dataStr}`
      }).join('\n')

      const prompt = `I'm looking at product review sentiment data showing how positive customer feedback is across different product aspects. This is a benchmark comparison for ${scopeContext} with source: ${source}.

Here's the positive sentiment percentage (0-100) for each aspect from the actual review data:

${seriesData}

Based on this sentiment analysis data, please help me understand:

1. Which product aspects are getting the most positive customer feedback? Which series is performing best overall?

2. Which aspects have lower positive sentiment and might need attention?

3. How do the different series compare? Which one is leading in which aspects?

4. What patterns do you notice in customer sentiment across these aspects?

5. What 2-3 specific actions should we take based on these sentiment scores?

Please explain in simple terms that focus on practical business insights.`

      const result = await interpretChart(prompt)
      setInterpretation(result.answer || 'No interpretation available.')
    } catch (err) {
      setInterpretation(`**Error generating interpretation:** ${err.response?.data?.detail || err.message || 'Failed to generate interpretation. Please try again.'}`)
    } finally {
      setInterpretLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Aspect Benchmark</h1>
        <p className="mt-2 text-slate-500">
          Compare aspect-level positive sentiment scores overall, product-wise, country-wise, or source-wise.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-dashboard-copper" />
            Benchmark Filters
          </CardTitle>
          <CardDescription>Score metric: positive sentiment percentage (0-100) per aspect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 gap-3 ${scope === 'source' ? '' : 'md:grid-cols-2'}`}>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700">Scope</label>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                value={scope}
                onChange={(e) => {
                  const nextScope = e.target.value
                  setScope(nextScope)
                  if (nextScope !== 'product') setSelectedProducts([])
                  if (nextScope !== 'country') setSelectedCountries([])
                  if (nextScope !== 'source') setSelectedSources([])
                  if (nextScope === 'source') setSource('all')
                }}
              >
                <option value="overall">Overall</option>
                <option value="product">Product-wise</option>
                <option value="country">Country-wise</option>
                <option value="source">Source-wise</option>
              </select>
            </div>
            {scope !== 'source' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">Source</label>
                <select
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {sourceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {scope === 'product' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Products (select up to 4 for comparison)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {productOptions.map((product) => (
                    <label key={product} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product)}
                        onChange={() => toggleProduct(product)}
                        disabled={!selectedProducts.includes(product) && selectedProducts.length >= 4}
                      />
                      <span className="truncate" title={product}>{product}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {scope === 'country' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Countries (select up to 4 for comparison)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {countryOptions.map((country) => (
                    <label key={country} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedCountries.includes(country)}
                        onChange={() => toggleCountry(country)}
                        disabled={!selectedCountries.includes(country) && selectedCountries.length >= 4}
                      />
                      <span className="truncate" title={country}>{country}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {scope === 'source' && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Sources (select up to 4 for comparison)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {benchmarkSourceOptions.map((item) => (
                    <label key={item} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedSources.includes(item)}
                        onChange={() => toggleSource(item)}
                        disabled={!selectedSources.includes(item) && selectedSources.length >= 4}
                      />
                      <span className="truncate" title={item}>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>Aspect Competitive Benchmark</CardTitle>
              <CardDescription>
                Radar chart compares positive sentiment strength across aspects.
              </CardDescription>
            </div>
            {!loading && !error && payload.categories && payload.categories.length > 0 && (
              <button
                onClick={handleInterpretBenchmark}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
              >
                <Sparkles className="h-4 w-4" />
                Interpret
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-slate-500">Loading benchmark...</p>}
          {!loading && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
          {!loading && !error && (
            scope === 'product' && selectedProducts.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
                Select one or more products to render the product-wise benchmark chart.
              </div>
            ) : scope === 'country' && selectedCountries.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
                Select one or more countries to render the country-wise benchmark chart.
              </div>
            ) : scope === 'source' && selectedSources.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-600">
                Select one or more sources to render the source-wise benchmark chart.
              </div>
            ) : (
              <div>
                <AspectBenchmarkRadar
                  categories={payload.categories || []}
                  series={payload.series || []}
                  height={460}
                />
                <p className="mt-3 text-xs text-slate-500">
                  Values show positive sentiment percentage (0-100) per aspect for the selected scope and source.
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Interpret Modal */}
      <AnimatePresence>
        {showInterpretation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInterpretation(false)}
              className="fixed inset-0 z-50 bg-dashboard-brand/60 backdrop-blur-md"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-2xl"
              >
                {/* Header */}
                <div className="rounded-t-[28px] bg-dashboard-brand px-7 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-dashboard-copper/20 ring-1 ring-dashboard-copper/40">
                        <Sparkles className="h-5 w-5 text-dashboard-copper" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-dashboard-copper">AI Interpretation</p>
                        <p className="mt-0.5 text-base font-semibold text-white">Aspect Competitive Benchmark</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowInterpretation(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="rounded-b-[28px] border border-t-0 border-slate-200/80 bg-white shadow-panel">
                  <div className="max-h-[58vh] overflow-y-auto px-7 py-6">
                    {interpretLoading ? (
                      <div className="flex flex-col items-center justify-center py-14">
                        <div className="flex gap-1.5">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              className="h-2 w-2 rounded-full bg-dashboard-copper"
                              animate={{ y: [0, -9, 0] }}
                              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                            />
                          ))}
                        </div>
                        <p className="mt-4 text-sm font-medium text-slate-700">Analyzing benchmark data</p>
                        <p className="mt-1 text-xs text-slate-400">Comparing aspect sentiment across dimensions</p>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-700 prose-p:leading-7 prose-strong:text-slate-900 prose-li:text-slate-700 prose-li:leading-7 prose-h1:text-base prose-h2:text-sm prose-h3:text-sm">
                        <ReactMarkdown components={markdownComponents}>{enrichAgentText(interpretation)}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}




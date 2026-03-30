import { useEffect, useState } from 'react'
import { Lightbulb, RefreshCw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { motion } from 'framer-motion'

import { fetchFilterSummary, generateFilterSummary } from '../../lib/api'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

export function FilterSummary({ dimension, value, label }) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!dimension || !value) {
      setLoading(false)
      setSummaryData(null)
      setError(null)
      return
    }
    loadSummary()
  }, [dimension, value])

  const loadSummary = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await fetchFilterSummary(dimension, value)
      if (result.status === 'success' && result.exists) {
        setSummaryData(result.data)
      } else {
        setSummaryData(null)
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err)
      setError('Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      const result = await generateFilterSummary(dimension, value)
      if (result.status === 'success') {
        setSummaryData(result.data)
      } else {
        setError('Failed to generate summary')
      }
    } catch (err) {
      console.error('Failed to generate summary:', err)
      setError('Failed to generate summary')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(251,247,240,0.96))] text-slate-900">
          <CardContent className="flex items-center justify-center py-6">
            <div className="text-sm text-slate-600">Loading summary...</div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="border-rose-200 bg-rose-50/90">
          <CardContent className="py-4">
            <p className="text-sm text-rose-700">{error}</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(251,247,240,0.96))] text-slate-900">
        <CardHeader className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,rgba(183,121,31,0.14),transparent_34%)] px-5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-kicker text-dashboard-copper/80">Scope summary</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-dashboard-copper" />
                <CardTitle className="text-2xl leading-none text-slate-900">Insight Summary</CardTitle>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {label}: <span className="font-semibold text-slate-900">{value}</span>
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} variant="secondary" className="h-9 min-w-[148px] text-sm">
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {summaryData ? 'Refresh Summary' : 'Generate Summary'}
                </>
              )}
            </Button>
          </div>
          {summaryData && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Last generated {new Date(summaryData.generated_at).toLocaleString()} | {summaryData.review_count} reviews
            </p>
          )}
        </CardHeader>

        <CardContent className="bg-[linear-gradient(180deg,rgba(255,252,247,0.72),rgba(255,255,255,0.92))] pt-3 pb-3">
          {!summaryData && !generating && (
            <div className="rounded-[18px] border border-dashed border-stone-300 bg-white/70 px-4 py-5 text-center">
              <Sparkles className="mx-auto mb-2 h-7 w-7 text-dashboard-copper/70" />
              <p className="text-base font-semibold text-slate-900">No summary generated yet</p>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Generate a business-ready summary for the currently selected {label.toLowerCase()} view.
              </p>
            </div>
          )}

          {generating && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-[18px] border border-stone-200 bg-white/92 p-3.5">
                  <div className="mb-3 h-4 w-1/2 rounded bg-stone-200"></div>
                  <div className="space-y-2">
                    <div className="h-3 rounded bg-stone-100"></div>
                    <div className="h-3 rounded bg-stone-100"></div>
                    <div className="h-3 w-4/5 rounded bg-stone-100"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summaryData && !generating && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.05 }}>
                <div className="h-full rounded-[18px] border border-emerald-200 bg-white/92 p-3.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-2xl bg-emerald-400/12 p-1.5 text-emerald-200">
                      <ThumbsUp className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-slate-900">What Customers Love</h3>
                  </div>
                  <p className="text-[13px] leading-5 text-slate-600">{summaryData.positive_summary}</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                <div className="h-full rounded-[18px] border border-rose-200 bg-white/92 p-3.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-2xl bg-rose-400/12 p-1.5 text-rose-200">
                      <ThumbsDown className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Common Complaints</h3>
                  </div>
                  <p className="text-[13px] leading-5 text-slate-600">{summaryData.negative_summary}</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.15 }}>
                <div className="h-full rounded-[18px] border border-amber-200 bg-white/92 p-3.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <div className="rounded-2xl bg-amber-300/12 p-1.5 text-dashboard-copper">
                      <Lightbulb className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Areas to Improve</h3>
                  </div>
                  <p className="text-[13px] leading-5 text-slate-600">{summaryData.improvements}</p>
                </div>
              </motion.div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}


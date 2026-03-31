import { useState, useEffect } from 'react'
import { Check, Copy, Info, MessageSquare, Pencil, Star, ThumbsUp, Sparkles, X, ZoomIn } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { enrichAgentText, markdownComponents } from '../lib/markdownHelpers'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { AspectSentimentChart } from '../components/charts/AspectSentimentChart'
import { RatingTrendChart } from '../components/charts/RatingTrendChart'
import { SentimentTrendChart } from '../components/charts/SentimentTrendChart'
import { FilterSummary } from '../components/dashboard/ProductSummary'
import { useAnalyticsData, useFilterOptions } from '../hooks/useAnalyticsData'
import { interpretChart } from '../lib/api'

function BannerSentimentRing({ positive, neutral, negative }) {
  const size = 88
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const gap = 2

  const positiveLen = Math.max(0, (positive / 100) * circumference - gap)
  const neutralLen = Math.max(0, (neutral / 100) * circumference - gap)
  const negativeLen = Math.max(0, (negative / 100) * circumference - gap)

  const neutralOffset = -((positive / 100) * circumference)
  const negativeOffset = -(((positive + neutral) / 100) * circumference)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#0f9f78" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${positiveLen} ${circumference}`} strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#94a3b8" strokeWidth={strokeWidth - 2} strokeLinecap="round"
          strokeDasharray={`${neutralLen} ${circumference}`} strokeDashoffset={neutralOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#d45a53" strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={`${negativeLen} ${circumference}`} strokeDashoffset={negativeOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-bold leading-none text-dashboard-positive">{Math.round(positive)}%</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">pos</span>
      </div>
    </div>
  )
}

function BannerHealthPill({ positive }) {
  let label, colorClasses
  if (positive >= 65) {
    label = 'Strong sentiment'
    colorClasses = 'bg-dashboard-positive/10 text-dashboard-positive border-dashboard-positive/20'
  } else if (positive >= 45) {
    label = 'Mixed sentiment'
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200'
  } else {
    label = 'Needs attention'
    colorClasses = 'bg-dashboard-negative/10 text-dashboard-negative border-dashboard-negative/20'
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colorClasses}`}>
      {label}
    </span>
  )
}

export function AnalyticsDashboard() {
  const [filterDimension, setFilterDimension] = useState('overall')
  const [filterValue, setFilterValue] = useState(null)
  const [ratingTrendView, setRatingTrendView] = useState('rolling')
  const [sentimentTrendView, setSentimentTrendView] = useState('rolling')
  const [aspectView, setAspectView] = useState('grouped')
  const [showInterpretModal, setShowInterpretModal] = useState(false)
  const [showDataDescription, setShowDataDescription] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [datasetDescription, setDatasetDescription] = useState(
    'This is a dataset of customer audio products and headphones. It contains 3,000 consumer electronics reviews spanning 7 years (2018–2025), comprising five retail platforms: Techmart, Shopzone, Gadgetbay, Brandsite, and Audioworld. Reviews cover headphones and audio accessories, enriched with 10 aspect-level sentiment across dimensions: Sound Quality, Noise Cancellation, Comfort & Fit, Battery Life, Build & Durability, Connectivity, Microphone Quality, Use Case, Price & Value, and Brand Trust.'
  )
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [interpretation, setInterpretation] = useState('')
  const [interpretLoading, setInterpretLoading] = useState(false)
  const [interpretChartType, setInterpretChartType] = useState('Rating Trend')
  const [interpretCopied, setInterpretCopied] = useState(false)
  const [showRatingZoomModal, setShowRatingZoomModal] = useState(false)
  const [showSentimentZoomModal, setShowSentimentZoomModal] = useState(false)

  const { options: filterOptions, loading: optionsLoading } = useFilterOptions()
  const { data: analyticsData, loading: dataLoading, error: dataError } = useAnalyticsData(
    filterDimension,
    filterValue
  )

  // Reset filterValue when dimension changes
  useEffect(() => {
    if (filterDimension === 'overall') {
      setFilterValue(null)
    } else if (filterOptions && filterOptions[filterDimension]?.length > 0) {
      setFilterValue(filterOptions[filterDimension][0])
    }
  }, [filterDimension, filterOptions])


  const openInterpretSection = (chartType) => {
    setInterpretChartType(chartType)
    setShowInterpretModal(true)
    setInterpretCopied(false)
    setInterpretLoading(true)
    setInterpretation('')
  }

  const closeInterpretation = () => {
    setShowInterpretModal(false)
    setInterpretCopied(false)
  }
  const handleInterpretRatingTrend = async () => {
    if (!analyticsData?.rating_trend || analyticsData.rating_trend.length === 0) return

    openInterpretSection('Rating Trend')

    try {
      // Prepare context for the agent
      const viewDescriptions = {
        rolling: '7-day rolling average view',
        rolling30: '30-day rolling average view',
        daily: 'daily rating line view',
        area: 'rating area view',
        volume: 'rating with volume view'
      }

      const filterContext = filterDimension === 'overall'
        ? 'all data'
        : `filtered by ${filterDimension}: ${filterValue}`

      // Sample the data (first, middle, last few points)
      const trendData = analyticsData.rating_trend
      const dataPoints = trendData.length
      const sampleSize = Math.min(10, dataPoints)
      const step = Math.floor(dataPoints / sampleSize)
      const sampledData = []
      for (let i = 0; i < dataPoints; i += step) {
        sampledData.push(trendData[i])
      }
      if (sampledData[sampledData.length - 1] !== trendData[trendData.length - 1]) {
        sampledData.push(trendData[trendData.length - 1])
      }

      const question = `You are explaining a Rating Trend Over Time chart to a business user who wants to understand their product performance in simple terms.

Context:
- Viewing: ${filterContext}
- Total reviews analyzed: ${analyticsData.total_reviews}
- Overall average rating: ${analyticsData.avg_rating?.toFixed(2)} out of 5 stars
- Chart view: ${viewDescriptions[ratingTrendView]}

Sample data points from the trend (${sampledData.length} of ${dataPoints} total):
${sampledData.map(d => `- ${d.date}: ${d.avg_rating?.toFixed(2)} stars${d.review_count ? ` (${d.review_count} reviews)` : ''}`).join('\n')}

Please provide a clear, easy-to-understand interpretation in simple language that:

1. **What the graph shows**: Explain the overall trend in plain terms (e.g., "Your ratings have been improving over time" or "Ratings are stable around 4.5 stars")

2. **Key patterns to notice**: Point out any important changes or patterns (e.g., "There was a dip in July but ratings recovered in August")

3. **What this means**: Explain why this matters for the business in practical terms

4. **Simple recommendations**: Suggest 1-2 clear actions they can take based on what you see

Use everyday language, avoid technical jargon, and keep it concise (3-4 short paragraphs). Focus on insights that help them understand customer satisfaction and make better decisions.`

      const result = await interpretChart(question)
      setInterpretation(result.answer || 'No interpretation available.')
    } catch (err) {
      setInterpretation(`**Error generating interpretation:** ${err.response?.data?.detail || err.message || 'Failed to generate interpretation. Please try again.'}`)
    } finally {
      setInterpretLoading(false)
    }
  }

  const handleInterpretSentimentTrend = async () => {
    if (!analyticsData?.sentiment_trend || analyticsData.sentiment_trend.length === 0) return

    openInterpretSection('Sentiment Trend')

    try {
      const viewDescriptions = {
        rolling: '7-day rolling positive sentiment percentage',
        rolling30: '30-day rolling positive sentiment percentage',
        composition: 'stacked sentiment composition (positive/neutral/negative)',
        dual: 'positive vs negative sentiment comparison',
        net: 'net sentiment (positive minus negative)'
      }

      const filterContext = filterDimension === 'overall'
        ? 'all data'
        : `filtered by ${filterDimension}: ${filterValue}`

      const trendData = analyticsData.sentiment_trend
      const dataPoints = trendData.length
      const sampleSize = Math.min(10, dataPoints)
      const step = Math.floor(dataPoints / sampleSize)
      const sampledData = []
      for (let i = 0; i < dataPoints; i += step) {
        sampledData.push(trendData[i])
      }
      if (sampledData[sampledData.length - 1] !== trendData[trendData.length - 1]) {
        sampledData.push(trendData[trendData.length - 1])
      }

      const question = `You are explaining a Sentiment Trend Over Time chart to a business user who wants to understand how customer feelings about their product have changed.

Context:
- Viewing: ${filterContext}
- Total reviews analyzed: ${analyticsData.total_reviews}
- Current sentiment mix: ${analyticsData.positive_percent}% positive, ${analyticsData.neutral_percent}% neutral, ${analyticsData.negative_percent}% negative
- Chart view: ${viewDescriptions[sentimentTrendView]}

Sample data points from the trend (${sampledData.length} of ${dataPoints} total):
${sampledData.map(d => `- ${d.date}: ${d.positive_percent?.toFixed(1)}% positive${d.negative_percent ? `, ${d.negative_percent.toFixed(1)}% negative` : ''}`).join('\n')}

Please provide a clear, easy-to-understand interpretation in simple language that:

1. **What the graph shows**: Explain how customer sentiment has changed over time in plain terms (e.g., "Customer feelings have been getting more positive" or "Sentiment has remained mostly positive and steady")

2. **Key patterns to notice**: Point out any important changes in how customers feel (e.g., "There was a spike in negative feedback in March but it improved after that")

3. **What this means**: Explain why these sentiment patterns matter for understanding customer satisfaction

4. **Simple recommendations**: Suggest 1-2 clear actions based on the sentiment trends you see

Use everyday language, avoid technical jargon, and keep it concise (3-4 short paragraphs). Focus on helping them understand customer emotions and satisfaction.`

      const result = await interpretChart(question)
      setInterpretation(result.answer || 'No interpretation available.')
    } catch (err) {
      setInterpretation(`**Error generating interpretation:** ${err.response?.data?.detail || err.message || 'Failed to generate interpretation. Please try again.'}`)
    } finally {
      setInterpretLoading(false)
    }
  }

  const handleInterpretAspectFrequency = async () => {
    if (!analyticsData?.aspect_frequency || analyticsData.aspect_frequency.length === 0) return

    openInterpretSection('Aspect Frequency')

    try {
      const filterContext = filterDimension === 'overall'
        ? 'all data'
        : `filtered by ${filterDimension}: ${filterValue}`

      const topAspects = analyticsData.aspect_frequency
        .slice(0, 10)
        .map(a => `- ${a.aspect}: ${a.positive_count || 0} positive, ${a.negative_count || 0} negative mentions`)
        .join('\n')

      const prompt = `Looking at the aspect frequency data for ${filterContext} across ${analyticsData.total_reviews} reviews, here are the top aspects customers mention:

${topAspects}

Based on this aspect data, please help me understand:

1. Which 2-3 product aspects do customers talk about most frequently?

2. For these top aspects, what percentage of mentions are positive vs negative? Which aspects are clear strengths (mostly positive feedback) and which ones need attention (higher negative feedback)?

3. What does this tell us about customer priorities - what features matter most to them?

4. Based on these patterns, what 1-2 specific actions should we take? Should we highlight certain strengths in marketing, or address concerns about specific aspects?

Please provide a clear, practical analysis in simple terms that a business user can understand and act on.`

      const result = await interpretChart(prompt)
      setInterpretation(result.answer || 'No interpretation available.')
    } catch (err) {
      setInterpretation(`**Error generating interpretation:** ${err.response?.data?.detail || err.message || 'Failed to generate interpretation. Please try again.'}`)
    } finally {
      setInterpretLoading(false)
    }
  }

  const filterDimensions = [
    { id: 'overall', label: 'Overall' },
    { id: 'country', label: 'Country' },
    { id: 'source', label: 'Source' },
    { id: 'reference_model', label: 'Model' },
    { id: 'product_name', label: 'Product' },
    { id: 'generation_family', label: 'Generation' },
    { id: 'region', label: 'Region' }
  ]
  const ratingTrendHelpText = {
    rolling: 'Shows daily average rating with a 7-day rolling average to smooth short-term noise.',
    rolling30: 'Shows daily average rating with a 30-day rolling average for long-horizon trend.',
    daily: 'Shows the day-by-day average rating without smoothing.',
    area: 'Shows the daily average rating as a filled area to highlight magnitude and direction.',
    volume: 'Shows daily review volume (bars) together with average rating (line).',
  }
  const sentimentTrendHelpText = {
    rolling: 'Shows daily positive sentiment with a 7-day rolling average to highlight underlying trend.',
    rolling30: 'Shows daily positive sentiment with a 30-day rolling average for long-term movement.',
    composition: 'Shows how positive, neutral, and negative sentiment percentages are distributed each day.',
    dual: 'Shows positive and negative sentiment as two lines for direct comparison over time.',
    net: 'Shows net sentiment (positive% minus negative%) to indicate overall directional sentiment.',
  }
  const aspectHelpText = {
    grouped: 'Shows positive and negative mentions side by side for each aspect.',
    stacked: 'Shows total mentions per aspect with positive and negative stacked together.',
    ratio: 'Shows percentage composition per aspect (positive, negative, and other).',
  }

  const activeDimensionLabel = filterDimensions.find((dimension) => dimension.id === filterDimension)?.label || 'Selection'


  if (dataError) {
    return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-rose-200 bg-rose-50/90">
          <CardContent className="flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">Analytics unavailable</p>
              <h2 className="mt-3 font-serif text-3xl text-slate-950">Dashboard data could not be loaded</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-700">
                {dataError.includes('not found')
                  ? 'No sentiment data available. Please run the pipeline first from Sentiment Analysis.'
                  : `Error loading analytics: ${dataError}`}
              </p>
            </div>
            <img src="/logo.png" alt="Sentiment Analysis logo" className="h-16 w-auto object-contain opacity-80" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(251,247,240,0.98))] text-slate-900">
          <CardContent className="relative py-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(183,121,31,0.16),transparent_30%)]" />
            <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left: logo + tagline */}
              <div className="space-y-2">
                <img src="/logo.png" alt="Sentiment Analysis logo" className="h-20 w-auto object-contain md:h-24" />
                <p className="max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                  Read the current state of customer sentiment, monitor rating and emotion over time, and identify which product aspects shape the story behind the numbers.
                </p>
                <button
                  onClick={() => setShowDataDescription((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs text-dashboard-copper hover:text-dashboard-copper/80 transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  {showDataDescription ? 'Hide dataset info' : 'About current dataset'}
                </button>
                <AnimatePresence>
                  {showDataDescription && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 rounded-xl border border-amber-100 bg-white/70 p-3.5 shadow-sm backdrop-blur-sm">
                        {editingDescription ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-xs leading-6 text-slate-700 outline-none focus:ring-1 focus:ring-dashboard-copper"
                              rows={5}
                              value={descriptionDraft}
                              onChange={(e) => setDescriptionDraft(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingDescription(false)}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                              <button
                                onClick={() => { setDatasetDescription(descriptionDraft); setEditingDescription(false) }}
                                className="inline-flex items-center gap-1 rounded-lg bg-dashboard-copper px-2.5 py-1 text-xs font-medium text-white hover:bg-dashboard-copper/90 transition-colors"
                              >
                                <Check className="h-3 w-3" /> Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs leading-6 text-slate-700">{datasetDescription}</p>
                            <button
                              onClick={() => { setDescriptionDraft(datasetDescription); setEditingDescription(true) }}
                              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-dashboard-copper transition-colors"
                              title="Edit description"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right: at-a-glance snapshot */}
              <div className="shrink-0 md:w-[310px]">
                {dataLoading ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-sm">
                    <div className="h-[88px] w-[88px] shrink-0 animate-pulse rounded-full bg-slate-200/70" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-slate-200/70" />
                      <div className="h-5 w-1/2 animate-pulse rounded-full bg-slate-200/70" />
                      <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-slate-200/70" />
                      <div className="h-5 w-2/5 animate-pulse rounded-full bg-slate-200/70" />
                    </div>
                  </div>
                ) : analyticsData ? (
                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 shadow-float backdrop-blur-sm"
                  >
                    <BannerSentimentRing
                      positive={analyticsData.positive_percent}
                      neutral={analyticsData.neutral_percent}
                      negative={analyticsData.negative_percent}
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="section-kicker mb-0.5">Avg. Rating</p>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-bold tracking-tight text-dashboard-copper">
                            {analyticsData.avg_rating?.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500">/ 5</span>
                        </div>
                        <div className="mt-1 flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(pip => (
                            <Star key={pip} className={`h-3 w-3 ${pip <= Math.round(analyticsData.avg_rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="h-px bg-white/60" />
                      <div>
                        <p className="section-kicker mb-0.5">Reviews</p>
                        <span className="text-2xl font-bold tracking-tight text-dashboard-brand">
                          {analyticsData.total_reviews?.toLocaleString()}
                        </span>
                      </div>
                      <BannerHealthPill positive={analyticsData.positive_percent} />
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {!dataLoading && analyticsData && (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <Card className="h-full border-sky-100">
              <CardContent className="flex min-h-[138px] flex-col p-3.5">
                <div className="mb-1.5 flex items-start justify-between">
                  <p className="text-sm font-semibold text-slate-500">Feedback Count</p>
                  <div className="rounded-xl bg-sky-50 p-1.5">
                    <MessageSquare className="h-4 w-4 text-sky-600" />
                  </div>
                </div>
                <p className="text-[2rem] font-bold tracking-tight text-slate-900">{analyticsData.total_reviews}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Scope: {filterDimension === 'overall' ? 'All data' : `${filterDimensions.find((d) => d.id === filterDimension)?.label}: ${filterValue || '-'}`}
                </p>
                <div className="mt-auto inline-flex w-fit items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  Active filtered reviews
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
            <Card className="h-full border-amber-100">
              <CardContent className="flex min-h-[138px] flex-col p-3.5">
                <div className="mb-1.5 flex items-start justify-between">
                  <p className="text-sm font-semibold text-slate-500">Average Rating</p>
                  <div className="rounded-xl bg-amber-50 p-1.5">
                    <Star className="h-4 w-4 text-amber-500" />
                  </div>
                </div>
                <p className="text-[2rem] font-bold tracking-tight text-amber-600">
                  {analyticsData.avg_rating?.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Scale: 0 to 5</p>
                <div className="mt-auto h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.max(0, Math.min(100, (Number(analyticsData.avg_rating || 0) / 5) * 100))}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
            <Card className="h-full border-violet-100">
              <CardContent className="flex min-h-[138px] flex-col p-3.5">
                <div className="mb-1.5 flex items-start justify-between">
                  <p className="text-sm font-semibold text-slate-500">Sentiment Mix</p>
                  <div className="rounded-xl bg-violet-50 p-1.5">
                    <ThumbsUp className="h-4 w-4 text-violet-600" />
                  </div>
                </div>
                <p className="text-[1.75rem] font-bold tracking-tight text-slate-900">
                  {analyticsData.positive_percent}% <span className="text-sm font-medium text-slate-500">positive</span>
                </p>
                <div className="mt-1.5 space-y-1 text-[11px]">
                  <div>
                    <div className="mb-1 flex justify-between text-slate-600"><span>Positive</span><span>{analyticsData.positive_percent}%</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${analyticsData.positive_percent}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-slate-600"><span>Neutral</span><span>{analyticsData.neutral_percent}%</span></div>
                    <div className="h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-slate-400" style={{ width: `${analyticsData.neutral_percent}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-slate-600"><span>Negative</span><span>{analyticsData.negative_percent}%</span></div>
                    <div className="h-1 rounded-full bg-slate-100"><div className="h-1 rounded-full bg-rose-500" style={{ width: `${analyticsData.negative_percent}%` }} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}>
        <Card>
          <CardContent className="py-3">
            <div className="grid gap-2 lg:grid-cols-2 lg:items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Analyze by</label>
                <select
                  className="h-9 w-full rounded-xl border border-slate-300/80 bg-white/82 px-3 text-sm text-slate-900 shadow-sm"
                  value={filterDimension}
                  onChange={(e) => setFilterDimension(e.target.value)}
                  disabled={optionsLoading}
                >
                  {filterDimensions.map((dimension) => (
                    <option key={dimension.id} value={dimension.id}>
                      {dimension.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {filterDimension === 'overall' ? 'Selection' : `Select ${activeDimensionLabel}`}
                </label>
                <select
                  className="h-9 w-full rounded-xl border border-slate-300/80 bg-white/82 px-3 text-sm text-slate-900 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
                  value={filterValue || ''}
                  onChange={(e) => setFilterValue(e.target.value)}
                  disabled={optionsLoading || filterDimension === 'overall'}
                >
                  {filterDimension === 'overall' ? (
                    <option value="">All data</option>
                  ) : (
                    (filterOptions?.[filterDimension] || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))
                  )}
                </select>
              </div>


            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filter Summary */}
      {(filterDimension === 'overall' || filterValue) && (
        <FilterSummary
          dimension={filterDimension}
          value={filterDimension === 'overall' ? 'All reviews' : filterValue}
          label={filterDimensions.find((dimension) => dimension.id === filterDimension)?.label || 'Selection'}
        />
      )}

      {/* Loading State */}
      {dataLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-500">Loading analytics...</div>
        </div>
      )}

            {/* Analytics Display */}
      {!dataLoading && analyticsData && (
        <>
          {/* Charts Grid - 3 analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rating Trend Over Time */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Rating Trend Over Time</CardTitle>
                      <CardDescription>
                        {ratingTrendView === 'rolling'
                          ? 'Daily rating with 7-day rolling average'
                          : ratingTrendView === 'rolling30'
                            ? 'Daily rating with 30-day rolling average'
                          : ratingTrendView === 'daily'
                            ? 'Daily average rating'
                            : ratingTrendView === 'area'
                              ? 'Area trend of average rating'
                              : 'Average rating with review volume'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                        value={ratingTrendView}
                        onChange={(e) => setRatingTrendView(e.target.value)}
                      >
                        <option value="rolling">7-day rolling rating</option>
                        <option value="rolling30">30-day rolling rating</option>
                        <option value="daily">Daily rating line</option>
                        <option value="area">Rating area</option>
                        <option value="volume">Rating + volume</option>
                      </select>
                      <button
                        onClick={() => setShowRatingZoomModal(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
                      >
                        <ZoomIn className="h-4 w-4" />
                        Zoom
                      </button>
                      <button
                        onClick={handleInterpretRatingTrend}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
                      >
                        <Sparkles className="h-4 w-4" />
                        Interpret
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <RatingTrendChart
                    data={analyticsData.rating_trend}
                    mode={ratingTrendView}
                    height={240}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {ratingTrendHelpText[ratingTrendView]}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sentiment Trend Over Time */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Sentiment Trend Over Time</CardTitle>
                      <CardDescription>
                        {sentimentTrendView === 'rolling'
                          ? 'Positive sentiment with 7-day rolling average'
                          : sentimentTrendView === 'rolling30'
                            ? 'Positive sentiment with 30-day rolling average'
                          : sentimentTrendView === 'composition'
                            ? '100% stacked sentiment mix by date'
                            : sentimentTrendView === 'dual'
                              ? 'Positive vs negative sentiment lines by date'
                              : 'Net sentiment (positive% - negative%) by date'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                        value={sentimentTrendView}
                        onChange={(e) => setSentimentTrendView(e.target.value)}
                      >
                        <option value="rolling">7-day rolling positive%</option>
                        <option value="rolling30">30-day rolling positive%</option>
                        <option value="composition">Stacked composition</option>
                        <option value="dual">Positive vs negative lines</option>
                        <option value="net">Net sentiment line</option>
                      </select>
                      <button
                        onClick={() => setShowSentimentZoomModal(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
                      >
                        <ZoomIn className="h-4 w-4" />
                        Zoom
                      </button>
                      <button
                        onClick={handleInterpretSentimentTrend}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
                      >
                        <Sparkles className="h-4 w-4" />
                        Interpret
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <SentimentTrendChart
                    data={analyticsData.sentiment_trend}
                    mode={sentimentTrendView}
                    height={240}
                  />
                  <p className="mt-3 text-xs text-slate-500">
                    {sentimentTrendHelpText[sentimentTrendView]}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Aspect Frequency Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Aspect Frequency Analysis</CardTitle>
                    <CardDescription>
                      {aspectView === 'grouped'
                        ? 'Positive vs negative mentions for each aspect'
                        : aspectView === 'stacked'
                          ? 'Total aspect mentions split by sentiment'
                          : 'Aspect-level sentiment composition in percentages'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="h-9 min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                      value={aspectView}
                      onChange={(e) => setAspectView(e.target.value)}
                    >
                      <option value="grouped">Grouped pos/neg bars</option>
                      <option value="stacked">Stacked mention counts</option>
                      <option value="ratio">100% sentiment mix</option>
                    </select>
                    <button
                      onClick={handleInterpretAspectFrequency}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
                    >
                      <Sparkles className="h-4 w-4" />
                      Interpret
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AspectSentimentChart
                  data={analyticsData.aspect_frequency}
                  mode={aspectView}
                  height={Math.max(300, analyticsData.aspect_frequency.length * 70)}
                />
                <p className="mt-3 text-xs text-slate-500">{aspectHelpText[aspectView]}</p>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Interpret Modal */}
      <AnimatePresence>
        {showInterpretModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeInterpretation}
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
                        <p className="mt-0.5 text-base font-semibold text-white">{interpretChartType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!interpretLoading && (
                        <button
                          onClick={async () => {
                            if (typeof navigator === 'undefined' || !navigator.clipboard) return
                            await navigator.clipboard.writeText(interpretation || '')
                            setInterpretCopied(true)
                            setTimeout(() => setInterpretCopied(false), 1800)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/20"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {interpretCopied ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                      <button
                        onClick={closeInterpretation}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
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
                        <p className="mt-4 text-sm font-medium text-slate-700">Generating interpretation</p>
                        <p className="mt-1 text-xs text-slate-400">Summarizing chart data into business insights</p>
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

      {/* Rating Zoom Modal */}
      <AnimatePresence>
        {showRatingZoomModal && analyticsData?.rating_trend && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRatingZoomModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-6xl h-[85vh] flex flex-col"
              >
                <Card className="shadow-2xl flex flex-col h-full !bg-white backdrop-blur-none">
                  <CardHeader className="flex-shrink-0 border-b border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">Rating Trend Over Time - Zoomed View</CardTitle>
                        <CardDescription className="mt-1">
                          {ratingTrendView === 'rolling'
                            ? 'Daily rating with 7-day rolling average'
                            : ratingTrendView === 'rolling30'
                              ? 'Daily rating with 30-day rolling average'
                            : ratingTrendView === 'daily'
                              ? 'Daily average rating'
                              : ratingTrendView === 'area'
                                ? 'Area trend of average rating'
                                : 'Average rating with review volume'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                          value={ratingTrendView}
                          onChange={(e) => setRatingTrendView(e.target.value)}
                        >
                          <option value="rolling">7-day rolling rating</option>
                          <option value="rolling30">30-day rolling rating</option>
                          <option value="daily">Daily rating line</option>
                          <option value="area">Rating area</option>
                          <option value="volume">Rating + volume</option>
                        </select>
                        <button
                          onClick={() => setShowRatingZoomModal(false)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 pb-6">
                    <RatingTrendChart
                      data={analyticsData.rating_trend}
                      mode={ratingTrendView}
                      height={500}
                      zoom
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      {ratingTrendHelpText[ratingTrendView]}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Sentiment Zoom Modal */}
      <AnimatePresence>
        {showSentimentZoomModal && analyticsData?.sentiment_trend && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSentimentZoomModal(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-6xl h-[85vh] flex flex-col"
              >
                <Card className="shadow-2xl flex flex-col h-full !bg-white backdrop-blur-none">
                  <CardHeader className="flex-shrink-0 border-b border-slate-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">Sentiment Trend Over Time - Zoomed View</CardTitle>
                        <CardDescription className="mt-1">
                          {sentimentTrendView === 'rolling'
                            ? 'Positive sentiment with 7-day rolling average'
                            : sentimentTrendView === 'rolling30'
                              ? 'Positive sentiment with 30-day rolling average'
                            : sentimentTrendView === 'composition'
                              ? '100% stacked sentiment mix by date'
                              : sentimentTrendView === 'dual'
                                ? 'Positive vs negative sentiment lines by date'
                                : 'Net sentiment (positive% - negative%) by date'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="h-9 min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                          value={sentimentTrendView}
                          onChange={(e) => setSentimentTrendView(e.target.value)}
                        >
                          <option value="rolling">7-day rolling positive%</option>
                          <option value="rolling30">30-day rolling positive%</option>
                          <option value="composition">Stacked composition</option>
                          <option value="dual">Positive vs negative lines</option>
                          <option value="net">Net sentiment line</option>
                        </select>
                        <button
                          onClick={() => setShowSentimentZoomModal(false)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 pb-6">
                    <SentimentTrendChart
                      data={analyticsData.sentiment_trend}
                      mode={sentimentTrendView}
                      height={500}
                      zoom
                    />
                    <p className="mt-3 text-sm text-slate-500">
                      {sentimentTrendHelpText[sentimentTrendView]}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}






































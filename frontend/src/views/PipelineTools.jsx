import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, Loader, Settings, Sparkles, Table } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  downloadLatestSentimentEnriched,
  fetchOutputTable,
  getSettings,
  runSentiment,
  runSentimentUpload,
  saveSettings
} from '../lib/api'

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || 'Unknown error'
}

export function PipelineTools() {
  const [error, setError] = useState('')
  const [loadingSentiment, setLoadingSentiment] = useState(false)
  const [loadingTable, setLoadingTable] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState(false)

  const [apiProvider, setApiProvider] = useState('azure')
  const [settingsResult, setSettingsResult] = useState('')
  const [sentimentMessage, setSentimentMessage] = useState('')
  const [downloadReady, setDownloadReady] = useState(false)

  const [sentimentForm, setSentimentForm] = useState({
    batch_size: '',
    max_reviews: ''
  })
  const [sentimentFile, setSentimentFile] = useState(null)
  const [tableData, setTableData] = useState(null)

  const updateSentimentField = (field, value) => {
    setSentimentForm((current) => ({ ...current, [field]: value }))
  }

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await getSettings()
        if (response.status === 'success' && response.settings?.api_provider) {
          setApiProvider(response.settings.api_provider)
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    loadSettings()
  }, [])

  const buildSentimentNumericPayload = () => {
    const payload = {}
    if (sentimentForm.batch_size.trim()) {
      const batchSize = Number(sentimentForm.batch_size)
      if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error('Batch size must be a positive integer')
      }
      payload.batch_size = batchSize
    }
    if (sentimentForm.max_reviews.trim()) {
      const maxReviews = Number(sentimentForm.max_reviews)
      if (!Number.isInteger(maxReviews) || maxReviews < 1) {
        throw new Error('Max reviews must be a positive integer')
      }
      payload.max_reviews = maxReviews
    }
    return payload
  }

  const handleSentiment = async () => {
    try {
      setLoadingSentiment(true)
      setError('')
      setDownloadReady(false)
      setSentimentMessage('Sentiment run started. Processing large files may take several minutes; progress is logged in backend CLI per batch.')

      const numericPayload = buildSentimentNumericPayload()
      if (sentimentFile) {
        await runSentimentUpload({
          unified_reviews: sentimentFile,
          ...numericPayload
        })
      } else {
        await runSentiment(numericPayload)
      }

      setDownloadReady(true)
      setSentimentMessage('Sentiment analysis completed. The enriched file is ready to download.')
    } catch (err) {
      setError(`Sentiment run failed: ${getErrorMessage(err)}`)
      setDownloadReady(false)
    } finally {
      setLoadingSentiment(false)
    }
  }

  const handleDownload = async () => {
    try {
      setDownloadingFile(true)
      setError('')
      await downloadLatestSentimentEnriched()
    } catch (err) {
      setError(`Download failed: ${getErrorMessage(err)}`)
    } finally {
      setDownloadingFile(false)
    }
  }

  const handleLoadTable = async () => {
    try {
      setLoadingTable(true)
      setError('')
      const response = await fetchOutputTable('sentiment_enriched', 100)
      setTableData(response)
    } catch (err) {
      setError(`Failed to load table: ${getErrorMessage(err)}`)
    } finally {
      setLoadingTable(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setLoadingSettings(true)
      setError('')
      setSettingsResult('')
      const response = await saveSettings({ api_provider: apiProvider })
      setSettingsResult(response?.message || 'Settings saved successfully.')
    } catch (err) {
      setError(`Failed to save settings: ${getErrorMessage(err)}`)
    } finally {
      setLoadingSettings(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,252,247,0.96),rgba(251,247,240,0.96))] text-slate-900">
        <CardContent className="relative py-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(183,121,31,0.18),transparent_32%)]" />
          <div className="relative">
            <p className="section-kicker text-dashboard-copper/80">Processing workspace</p>
            <h1 className="mt-3 font-serif text-4xl text-slate-900">Sentiment Analysis</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Upload reviews, run the enrichment pipeline, preview the resulting sentiment_enriched table, and download the current workbook for the rest of the dashboard.
            </p>
          </div>
        </CardContent>
      </Card>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="h-5 w-5 text-blue-500" aria-hidden="true" />
              API Settings
            </CardTitle>
            <CardDescription>Select your API provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={apiProvider === 'azure'}
                  onChange={() => setApiProvider('azure')}
                  disabled={loadingSettings}
                  className="h-4 w-4 rounded border-slate-300 text-dashboard-copper focus:ring-dashboard-copper"
                />
                <span>Azure OpenAI</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={apiProvider === 'openai'}
                  onChange={() => setApiProvider('openai')}
                  disabled={loadingSettings}
                  className="h-4 w-4 rounded border-slate-300 text-dashboard-copper focus:ring-dashboard-copper"
                />
                <span>OpenAI</span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={loadingSettings} className="gap-2">
                {loadingSettings ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Save API Provider
                  </>
                )}
              </Button>
            </div>
            {settingsResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {settingsResult}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-blue-500" aria-hidden="true" />
              Analyze Review Sentiment
            </CardTitle>
            <CardDescription>
              Upload the unified reviews file (optional) and run sentiment analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[20px] border border-stone-200 bg-stone-50/80 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Input and output guide</p>
              <p className="mt-2 leading-6">
                Required input columns: <span className="font-semibold">review id</span>, <span className="font-semibold">review title</span>, and <span className="font-semibold">review text</span>.
              </p>
              <p className="mt-2 leading-6">
                Generated output fields: <span className="font-semibold">language</span>, <span className="font-semibold">overall sentiment</span>, <span className="font-semibold">overall confidence</span>, <span className="font-semibold">aspects json</span>, and <span className="font-semibold">aspect count</span>.
              </p>
            </div>
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => setSentimentFile(e.target.files?.[0] || null)}
              disabled={loadingSentiment}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={sentimentForm.batch_size}
                onChange={(event) => updateSentimentField('batch_size', event.target.value)}
                placeholder="batch_size (optional, default: 100)"
                disabled={loadingSentiment}
              />
              <Input
                value={sentimentForm.max_reviews}
                onChange={(event) => updateSentimentField('max_reviews', event.target.value)}
                placeholder="max_reviews (optional, default: all rows in table)"
                disabled={loadingSentiment}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={handleSentiment} disabled={loadingSentiment} className="gap-2">
                {loadingSentiment ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Running sentiment...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Run Sentiment
                  </>
                )}
              </Button>
              {downloadReady && (
                <Button onClick={handleDownload} disabled={downloadingFile} variant="outline" className="gap-2">
                  {downloadingFile ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </>
                  )}
                </Button>
              )}
            </div>
            {sentimentMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                {sentimentMessage}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </CardFooter>
        </Card>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Table className="h-5 w-5 text-blue-500" aria-hidden="true" />
              View Output Tables
            </CardTitle>
            <CardDescription>
              Preview the generated sentiment_enriched output.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleLoadTable} disabled={loadingTable}>
                {loadingTable ? 'Loading...' : 'Load sentiment_enriched'}
              </Button>
            </div>
            {tableData && (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  Showing {tableData.rows.length} of {tableData.total_rows} rows from sentiment_enriched
                </div>
                <div className="h-[420px] w-full overflow-x-auto overflow-y-scroll rounded-xl border border-slate-200">
                  <table className="min-w-[1200px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {tableData.columns.map((col) => (
                          <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {tableData.rows.map((row, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          {tableData.columns.map((col) => (
                            <td key={`${idx}-${col}`} className="h-10 whitespace-nowrap px-3 py-2 text-slate-700 align-middle" title={String(row[col] ?? '')}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>
    </div>
  )
}









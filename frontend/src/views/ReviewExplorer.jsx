import { useEffect, useMemo, useState } from 'react'
import { Loader, Search } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { fetchOutputTable } from '../lib/api'

function toLower(value) {
  return String(value ?? '').toLowerCase()
}

function parseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function normalizeAspectList(row) {
  const parsed =
    parseJson(row.aspect_sentiments) ||
    parseJson(row.aspects_json) ||
    parseJson(row.aspects) ||
    []

  if (Array.isArray(parsed)) {
    return parsed.map((item) => {
      if (typeof item === 'string') {
        return { aspect: item, sentiment: '', evidence: '' }
      }
      return {
        aspect: item?.aspect || item?.name || '',
        sentiment: item?.sentiment || item?.label || '',
        evidence: item?.evidence || item?.snippet || item?.reason || ''
      }
    })
  }

  if (typeof parsed === 'object') {
    return Object.entries(parsed).map(([aspect, value]) => {
      if (typeof value === 'string') {
        return { aspect, sentiment: value, evidence: '' }
      }
      return {
        aspect,
        sentiment: value?.sentiment || value?.label || '',
        evidence: value?.evidence || value?.snippet || value?.reason || ''
      }
    })
  }

  return []
}

export function ReviewExplorer() {
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)

  const [search, setSearch] = useState('')
  const [productCode, setProductCode] = useState('')
  const [country, setCountry] = useState('')
  const [language, setLanguage] = useState('')
  const [rating, setRating] = useState('')
  const [overallSentiment, setOverallSentiment] = useState('')
  const [aspect, setAspect] = useState('')
  const [source, setSource] = useState('')
  const [confidenceMin, setConfidenceMin] = useState('')
  const [confidenceMax, setConfidenceMax] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await fetchOutputTable('sentiment_enriched', 100000)
        const loadedRows = response?.rows || []
        const enriched = loadedRows.map((row) => ({
          ...row,
          _aspect_list: normalizeAspectList(row)
        }))
        setColumns(response?.columns || [])
        setRows(enriched)
      } catch (err) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load sentiment_enriched table')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filterOptions = useMemo(() => {
    const uniq = (values) => Array.from(new Set(values.filter(Boolean))).sort()
    return {
      productCodes: uniq(rows.map((r) => r.product_code)),
      countries: uniq(rows.map((r) => r.country || r.review_country)),
      languages: uniq(rows.map((r) => r.language)),
      ratings: uniq(rows.map((r) => r.rating)),
      sentiments: uniq(rows.map((r) => r.overall_sentiment || r.sentiment_label)),
      sources: uniq(rows.map((r) => r.source || r.review_type)),
      aspects: uniq(rows.flatMap((r) => r._aspect_list.map((a) => a.aspect)))
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const searchable = [
        row.product_code,
        row.product_name,
        row.review_text,
        row.country,
        row.review_country,
        row.language,
        row.source,
        row.review_type,
        row.overall_sentiment,
        row.sentiment_label
      ]
        .map((v) => String(v ?? ''))
        .join(' ')
        .toLowerCase()

      if (search && !searchable.includes(search.toLowerCase())) return false
      if (productCode && String(row.product_code ?? '') !== productCode) return false

      const rowCountry = String(row.country ?? row.review_country ?? '')
      if (country && rowCountry !== country) return false

      if (language && String(row.language ?? '') !== language) return false
      if (rating && String(row.rating ?? '') !== rating) return false

      const rowSentiment = String(row.overall_sentiment ?? row.sentiment_label ?? '')
      if (overallSentiment && rowSentiment !== overallSentiment) return false

      const rowSource = String(row.source ?? row.review_type ?? '')
      if (source && rowSource !== source) return false

      if (aspect && !row._aspect_list.some((a) => a.aspect === aspect)) return false

      const confRaw = row.confidence
      const confidence = confRaw === null || confRaw === undefined || confRaw === '' ? null : Number(confRaw)
      if (confidenceMin !== '' && (confidence === null || Number.isNaN(confidence) || confidence < Number(confidenceMin))) return false
      if (confidenceMax !== '' && (confidence === null || Number.isNaN(confidence) || confidence > Number(confidenceMax))) return false

      return true
    })
  }, [
    rows,
    search,
    productCode,
    country,
    language,
    rating,
    overallSentiment,
    source,
    aspect,
    confidenceMin,
    confidenceMax
  ])

  const previewColumns = useMemo(() => {
    const preferred = [
      'product_code',
      'country',
      'language',
      'rating',
      'overall_sentiment',
      'sentiment_label',
      'confidence',
      'source',
      'review_type'
    ]
    const existingPreferred = preferred.filter((c) => columns.includes(c))
    if (existingPreferred.length) return existingPreferred
    return columns.slice(0, 8)
  }, [columns])

  const renderSelect = (label, value, setValue, options) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Review Explorer</h1>
        <p className="mt-2 text-slate-500">
          Search sentiment-enriched reviews, filter by key dimensions, and inspect aspect evidence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search and Filters</CardTitle>
          <CardDescription>Filter by product, market, review metadata, sentiment, and aspect evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search in product, review text, sentiment, source..."
              className="pl-10"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {renderSelect('Product Code', productCode, setProductCode, filterOptions.productCodes)}
            {renderSelect('Country', country, setCountry, filterOptions.countries)}
            {renderSelect('Language', language, setLanguage, filterOptions.languages)}
            {renderSelect('Rating', rating, setRating, filterOptions.ratings)}
            {renderSelect('Overall Sentiment', overallSentiment, setOverallSentiment, filterOptions.sentiments)}
            {renderSelect('Aspect', aspect, setAspect, filterOptions.aspects)}
            {renderSelect('Review Type / Source', source, setSource, filterOptions.sources)}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Confidence Min</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={confidenceMin}
                onChange={(event) => setConfidenceMin(event.target.value)}
                placeholder="0.0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-slate-500">Confidence Max</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={confidenceMax}
                onChange={(event) => setConfidenceMax(event.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-slate-600">
            <Loader className="h-4 w-4 animate-spin" />
            Loading table...
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-6 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>{filteredRows.length} matching rows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[420px] overflow-x-auto overflow-y-scroll rounded-xl border border-slate-200">
                <table className="min-w-[1200px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {previewColumns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filteredRows.map((row, index) => {
                      const isSelected = selectedRow === row
                      return (
                        <tr
                          key={`${row.review_id || 'row'}-${index}`}
                          onClick={() => setSelectedRow(row)}
                          className={`cursor-pointer border-t border-slate-100 ${
                            isSelected ? 'bg-amber-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          {previewColumns.map((col) => (
                            <td key={`${index}-${col}`} className="h-10 max-w-[280px] truncate whitespace-nowrap px-3 py-2 text-slate-700 align-middle">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review Details</CardTitle>
              <CardDescription>Open a row to inspect full review text and extracted aspects.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[560px] space-y-4 overflow-auto">
              {!selectedRow && <p className="text-sm text-slate-500">Select any row from the table.</p>}

              {selectedRow && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Review Text</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {String(selectedRow.review_text ?? selectedRow.review_body ?? '')}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Aspects</p>
                    <div className="mt-2 space-y-3">
                      {selectedRow._aspect_list.length === 0 && (
                        <p className="text-sm text-slate-500">No extracted aspects found for this review.</p>
                      )}
                      {selectedRow._aspect_list.map((item, idx) => (
                        <div key={`${item.aspect}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-800">{item.aspect || 'Aspect'}</p>
                          <p className="mt-1 text-sm text-slate-600">Sentiment: {item.sentiment || 'n/a'}</p>
                          <p className="mt-1 text-sm text-slate-600">Evidence: {item.evidence || 'n/a'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Metadata</p>
                    <div className="mt-1 space-y-1 text-sm text-slate-600">
                      <p>Product: {String(selectedRow.product_code ?? '')}</p>
                      <p>Country: {String(selectedRow.country ?? selectedRow.review_country ?? '')}</p>
                      <p>Language: {String(selectedRow.language ?? '')}</p>
                      <p>Rating: {String(selectedRow.rating ?? '')}</p>
                      <p>Overall sentiment: {String(selectedRow.overall_sentiment ?? selectedRow.sentiment_label ?? '')}</p>
                      <p>Confidence: {String(selectedRow.confidence ?? '')}</p>
                      <p>Source: {String(selectedRow.source ?? selectedRow.review_type ?? '')}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}



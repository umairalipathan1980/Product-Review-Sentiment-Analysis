import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function runSentiment(payload) {
  const response = await api.post('/pipeline/sentiment', payload)
  return response.data
}

export async function runSentimentUpload({ unified_reviews, batch_size, max_reviews, dataset_description, aspect_definitions }) {
  const formData = new FormData()
  formData.append('unified_reviews', unified_reviews)
  if (batch_size) formData.append('batch_size', String(batch_size))
  if (max_reviews) formData.append('max_reviews', String(max_reviews))
  if (dataset_description) formData.append('dataset_description', dataset_description)
  if (aspect_definitions) formData.append('aspect_definitions', JSON.stringify(aspect_definitions))

  const response = await api.post('/pipeline/sentiment/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

export async function downloadLatestSentimentEnriched() {
  const response = await api.get('/pipeline/sentiment/download', {
    responseType: 'blob'
  })

  const disposition = response.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^\"]+)"?/i)
  const filename = match?.[1] || 'sentiment_enriched.xlsx'

  const blobUrl = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(blobUrl)
}

export async function fetchOutputTable(name, limit = 200) {
  const response = await api.get('/outputs/table', { params: { name, limit } })
  return response.data
}

export async function getSettings() {
  const response = await api.get('/settings')
  return response.data
}

export async function saveSettings(settings) {
  const response = await api.post('/settings', settings)
  return response.data
}

export async function fetchFilterOptions() {
  const response = await api.get('/analytics/filter-options')
  return response.data
}

export async function fetchAnalyticsData(dimension = 'overall', value = null) {
  const response = await api.get('/analytics/data', {
    params: { dimension, value }
  })
  return response.data
}

export async function fetchAspectBenchmark({ scope = 'overall', source = 'all', products = [], countries = [], sources = [] } = {}) {
  const safeProducts = Array.isArray(products) ? products : []
  const safeCountries = Array.isArray(countries) ? countries : []
  const safeSources = Array.isArray(sources) ? sources : []
  const response = await api.get('/analytics/aspect-benchmark', {
    params: {
      scope,
      source,
      products_json: safeProducts.length ? JSON.stringify(safeProducts) : undefined,
      countries_json: safeCountries.length ? JSON.stringify(safeCountries) : undefined,
      sources_json: safeSources.length ? JSON.stringify(safeSources) : undefined
    }
  })
  return response.data
}

export async function fetchFilterSummary(dimension, value) {
  const response = await api.get('/summaries/filter', {
    params: { dimension, value }
  })
  return response.data
}

export async function generateFilterSummary(dimension, value) {
  const response = await api.post('/summaries/filter/generate', null, {
    params: { dimension, value }
  })
  return response.data
}

export async function fetchAgentSchema() {
  const response = await api.get('/agent/schema')
  return response.data
}

export async function runAgentChat({ question, history = [] }) {
  const response = await api.post('/agent/chat', { question, history })
  return response.data
}

export async function* runAgentChatStream({ question, history = [] }) {
  const response = await fetch(`${API_BASE_URL}/agent/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  })
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6))
      }
    }
  }
}

export async function interpretChart(prompt) {
  try {
    const response = await api.post('/interpret/chart', { prompt })
    return response.data
  } catch (error) {
    const status = error?.response?.status
    const detail = String(error?.response?.data?.detail || '')
    if (status === 404 || detail.toLowerCase() === 'not found') {
      const fallback = await runAgentChat({ question: prompt, history: [] })
      return { status: 'success', answer: fallback?.answer || '' }
    }
    throw error
  }
}




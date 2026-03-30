import { useState, useEffect } from 'react'
import { fetchAnalyticsData, fetchFilterOptions } from '../lib/api'

export function useAnalyticsData(dimension, value) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetchAnalyticsData(dimension, value)
      .then((response) => {
        setData(response.data)
      })
      .catch((err) => {
        console.error('Failed to fetch analytics data:', err)
        setError(err.message || 'Failed to load analytics data')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [dimension, value])

  return { data, loading, error }
}

export function useFilterOptions() {
  const [options, setOptions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchFilterOptions()
      .then((response) => {
        setOptions(response.data)
      })
      .catch((err) => {
        console.error('Failed to fetch filter options:', err)
        setError(err.message || 'Failed to load filter options')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  return { options, loading, error }
}

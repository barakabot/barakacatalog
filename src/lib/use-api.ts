'use client'

import { useState, useEffect, useCallback } from 'react'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/** Generic fetch hook for GET endpoints. */
export function useApi<T>(url: string | null, opts?: { enabled?: boolean }): ApiState<T> & { setData: (d: T | null) => void } {
  const enabled = opts?.enabled ?? true
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(url && enabled))
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!url || !enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`خطای ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e?.message ?? 'خطای ناشناخته')
    } finally {
      setLoading(false)
    }
  }, [url, enabled])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch, setData }
}

/** Imperative API call helper returning { ok, data, error }. */
export async function apiCall<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  try {
    const headers = new Headers(options.headers)
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    if (options.body != null && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(url, {
      ...options,
      headers,
    })
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const body = isJson ? await res.json() : await res.text()
    if (!res.ok) {
      const msg = (body as any)?.error ?? (typeof body === 'string' ? body : `خطای ${res.status}`)
      return { ok: false, error: msg, status: res.status }
    }
    return { ok: true, data: body as T, status: res.status }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'خطای شبکه', status: 0 }
  }
}

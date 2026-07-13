/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from 'bun:test'
import { apiCall } from './use-api'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('apiCall headers', () => {
  test('lets fetch set the multipart boundary for FormData', async () => {
    let requestHeaders = new Headers()
    globalThis.fetch = (async (_input, init) => {
      requestHeaders = new Headers(init?.headers)
      return Response.json({ ok: true })
    }) as typeof fetch

    const form = new FormData()
    form.append('file', new File(['proxy.example.com:8080'], 'proxies.txt', { type: 'text/plain' }))
    const result = await apiCall('/api/proxies', { method: 'POST', body: form })

    expect(result.ok).toBe(true)
    expect(requestHeaders.has('Content-Type')).toBe(false)
  })

  test('sets JSON content type for string bodies', async () => {
    let requestHeaders = new Headers()
    globalThis.fetch = (async (_input, init) => {
      requestHeaders = new Headers(init?.headers)
      return Response.json({ ok: true })
    }) as typeof fetch

    await apiCall('/api/example', { method: 'POST', body: JSON.stringify({ ok: true }) })

    expect(requestHeaders.get('Content-Type')).toBe('application/json')
  })
})

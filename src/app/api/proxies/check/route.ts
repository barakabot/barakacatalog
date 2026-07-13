import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { get } from 'node:https'
import { clearProxyPool, formatProxyUrl } from '@/lib/proxy-pool'
import { decryptSecret } from '@/lib/secret-crypto'

export const runtime = 'nodejs'

const TEST_URL = 'https://api.ipify.org?format=json'
const TEST_TIMEOUT = 10000 // 10 seconds

interface ProxyRecord {
  id: string
  host: string
  port: number
  username: string | null
  password: string | null
  protocol: string
}

async function checkSingle(proxy: ProxyRecord): Promise<{
  id: string
  status: 'alive' | 'dead'
  latency: number
  ip?: string
  error?: string
}> {
  const proxyUrl = formatProxyUrl({
    ...proxy,
    password: decryptSecret(proxy.password),
    protocol: proxy.protocol,
  })

  const start = Date.now()
  try {
    const agent = new HttpsProxyAgent(proxyUrl)
    const data = await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
      const request = get(TEST_URL, {
        agent,
        headers: { Accept: 'application/json' },
        timeout: TEST_TIMEOUT,
      }, response => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', chunk => {
          body += chunk
          if (body.length > 64 * 1024) request.destroy(new Error('response too large'))
        })
        response.on('end', () => resolve({ statusCode: response.statusCode ?? 0, body }))
      })
      request.on('timeout', () => request.destroy(new Error('timeout')))
      request.on('error', reject)
    })

    if (data.statusCode < 200 || data.statusCode >= 300) {
      return { id: proxy.id, status: 'dead', latency: Date.now() - start, error: `HTTP ${data.statusCode}` }
    }

    const parsed = JSON.parse(data.body) as { ip?: string }
    const latency = Date.now() - start

    return {
      id: proxy.id,
      status: 'alive',
      latency,
      ip: parsed.ip,
    }
  } catch (e: any) {
    return {
      id: proxy.id,
      status: 'dead',
      latency: Date.now() - start,
      error: String(e?.message ?? 'timeout').replace(/(https?:\/\/)[^@\s]+@/gi, '$1***@'),
    }
  }
}

export async function POST(_req: NextRequest) {
  try {
    await requireAuth()

    // Recheck every proxy, including previously failed ones.
    const proxies = await db.proxy.findMany({
      select: {
        id: true,
        host: true,
        port: true,
        protocol: true,
        username: true,
        password: true,
      },
    })

    if (proxies.length === 0) {
      return NextResponse.json({ message: 'پروکسی فعالی وجود ندارد', results: [] })
    }

    // Check in parallel (max 5 at a time)
    const BATCH = 5
    const results: any[] = []

    for (let i = 0; i < proxies.length; i += BATCH) {
      const batch = proxies.slice(i, i + BATCH)
      const batchResults = await Promise.all(batch.map(checkSingle))
      results.push(...batchResults)
    }

    // Update DB with results
    for (const r of results) {
      await db.proxy.update({
        where: { id: r.id },
        data: {
          status: r.status,
          latency: r.latency,
          lastCheck: new Date(),
          isActive: r.status === 'alive',
        },
      })
    }
    clearProxyPool()

    const alive = results.filter(r => r.status === 'alive').length
    const dead = results.filter(r => r.status === 'dead').length

    return NextResponse.json({
      message: `${alive} سالم، ${dead} از کار افتاده از ${results.length} پروکسی`,
      total: results.length,
      alive,
      dead,
      results,
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

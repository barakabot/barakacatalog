import { db } from '@/lib/db'
import { decryptSecret } from '@/lib/secret-crypto'

interface ProxyInfo {
  id: string
  host: string
  port: number
  username: string | null
  password: string | null
  protocol: string
}

let proxyPool: ProxyInfo[] = []
let proxyIndex = 0
let lastFetch = 0
const POOL_TTL = 60_000 // refresh pool every 60s

/** Fetch alive proxies from DB (cached) */
export async function getAliveProxies(): Promise<ProxyInfo[]> {
  const now = Date.now()
  if (proxyPool.length > 0 && now - lastFetch < POOL_TTL) {
    return proxyPool
  }

  const proxies = await db.proxy.findMany({
    where: { isActive: true, status: 'alive' },
  })

  proxyPool = proxies.map(p => ({
    id: p.id,
    host: p.host,
    port: p.port,
    username: p.username,
    password: decryptSecret(p.password),
    protocol: p.protocol,
  }))

  lastFetch = now
  return proxyPool
}

export function formatProxyUrl(proxy: Pick<ProxyInfo, 'host' | 'port' | 'username' | 'password' | 'protocol'>): string {
  const protocol = proxy.protocol === 'https' ? 'https' : 'http'
  const host = proxy.host.includes(':') && !proxy.host.startsWith('[') ? `[${proxy.host}]` : proxy.host
  const url = new URL(`${protocol}://${host}:${proxy.port}`)
  if (proxy.username) url.username = proxy.username
  if (proxy.password) url.password = proxy.password
  return url.toString().replace(/\/$/, '')
}

export async function getAliveProxyUrls(): Promise<string[]> {
  const pool = await getAliveProxies()
  return pool.map(formatProxyUrl)
}

/** Get next proxy in round-robin fashion */
export async function getNextProxy(): Promise<string | null> {
  const urls = await getAliveProxyUrls()
  if (urls.length === 0) return null

  const proxyUrl = urls[proxyIndex % urls.length]
  proxyIndex++
  return proxyUrl
}

/** Clear the pool cache (e.g. after check) */
export function clearProxyPool() {
  proxyPool = []
  proxyIndex = 0
  lastFetch = 0
}

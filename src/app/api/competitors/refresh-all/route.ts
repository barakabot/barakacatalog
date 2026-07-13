import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAliveProxyUrls } from '@/lib/proxy-pool'

const PRICE_SERVICE = process.env.PRICE_SERVICE_URL ?? 'http://localhost:3002'

/** Proxy refresh-all to the Python price-service. */
export async function POST() {
  try {
    await requireAuth()
    const proxies = await getAliveProxyUrls()
    const res = await fetch(`${PRICE_SERVICE}/api/competitors/refresh-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proxies }),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json(
      { error: 'سرویس اسکرپ در دسترس نیست' },
      { status: 502 }
    )
  }
}

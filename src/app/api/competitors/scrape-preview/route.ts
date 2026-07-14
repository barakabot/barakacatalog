import { NextRequest, NextResponse } from 'next/server'
import { getNextProxy } from '@/lib/proxy-pool'
import { requireAuth } from '@/lib/auth'

const PRICE_SERVICE = process.env.PRICE_SERVICE_URL ?? 'http://localhost:3002'

/** Proxy to the Python price-service scrape-preview endpoint. */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.text()
    let parsed = {}
    try { parsed = JSON.parse(body) } catch {}

    // Get a proxy for this request (round-robin)
    const proxyUrl = await getNextProxy()

    const res = await fetch(`${PRICE_SERVICE}/api/competitors/scrape-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, proxy: proxyUrl }),
    })
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json(
      { error: 'سرویس اسکرپ در دسترس نیست. مطمئن شوید price-service روی پورت 3002 در حال اجراست.' },
      { status: 502 }
    )
  }
}

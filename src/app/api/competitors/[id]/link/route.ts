import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const PRICE_SERVICE = process.env.PRICE_SERVICE_URL ?? 'http://localhost:3002'

/** Proxy link-to-catalog to the Python price-service. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.text()
    const res = await fetch(`${PRICE_SERVICE}/api/competitors/${id}/link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
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

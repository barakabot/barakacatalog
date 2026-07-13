import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

const PRICE_SERVICE = process.env.PRICE_SERVICE_URL ?? 'http://localhost:3002'

/** Proxy unlink to the Python price-service. */
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const res = await fetch(`${PRICE_SERVICE}/api/competitors/${id}/unlink`, {
      method: 'PUT',
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

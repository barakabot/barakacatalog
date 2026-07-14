import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cp = await db.competitorProduct.findUnique({
    where: { id },
    include: {
      catalogProduct: { select: { id: true, name: true, price: true } },
      priceHistory: { orderBy: { fetchedAt: 'desc' }, take: 100 },
    },
  })
  if (!cp) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
  return NextResponse.json(cp)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()
    const existing = await db.competitorProduct.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })

    const data: any = {}
    for (const k of ['source', 'sourceId', 'name', 'imageUrl', 'weight', 'volume', 'brand']) {
      if (k in body) data[k] = body[k] === '' ? null : body[k]
    }
    for (const k of ['price', 'originalPrice', 'discountPercent', 'coefficient']) {
      if (k in body) {
        const v = Number(body[k])
        data[k] = isNaN(v) ? null : v
      }
    }
    if ('catalogProductId' in body) data.catalogProductId = body.catalogProductId || null
    data.fetchedAt = new Date()

    const updated = await db.competitorProduct.update({ where: { id }, data })

    // If price changed, log a price history entry
    if (typeof body.price === 'number' && body.price !== existing.price) {
      await db.competitorPriceHistory.create({
        data: {
          competitorProductId: id,
          price: body.price,
          originalPrice: typeof body.originalPrice === 'number' ? body.originalPrice : null,
          discountPercent: typeof body.discountPercent === 'number' ? body.discountPercent : null,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const existing = await db.competitorProduct.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })
    await db.competitorProduct.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

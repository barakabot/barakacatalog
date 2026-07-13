import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/** GET price history for a competitor product. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const history = await db.competitorPriceHistory.findMany({
    where: { competitorProductId: id },
    orderBy: { fetchedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ items: history })
}

/** POST a new manual price snapshot. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const existing = await db.competitorProduct.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'یافت نشد' }, { status: 404 })

    const body = await req.json()
    const price = Number(body.price)
    if (isNaN(price)) {
      return NextResponse.json({ error: 'قیمت معتبر نیست' }, { status: 400 })
    }
    const originalPrice = Number(body.originalPrice)
    const discountPercent = Number(body.discountPercent)

    const entry = await db.competitorPriceHistory.create({
      data: {
        competitorProductId: id,
        price,
        originalPrice: isNaN(originalPrice) ? null : originalPrice,
        discountPercent: isNaN(discountPercent) ? null : discountPercent,
      },
    })

    // Also update the competitor product's current price
    await db.competitorProduct.update({
      where: { id },
      data: {
        price,
        originalPrice: isNaN(originalPrice) ? null : originalPrice,
        discountPercent: isNaN(discountPercent) ? null : discountPercent,
        fetchedAt: new Date(),
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

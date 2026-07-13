import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const catalogProductId = searchParams.get('catalogProductId')
  const source = searchParams.get('source')
  const q = searchParams.get('q')

  const where: any = {}
  if (catalogProductId) where.catalogProductId = catalogProductId
  if (source) where.source = source
  if (q) where.name = { contains: q }

  const items = await db.competitorProduct.findMany({
    where,
    include: {
      catalogProduct: { select: { id: true, name: true } },
      _count: { select: { priceHistory: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const {
      source,
      sourceId,
      name,
      imageUrl,
      weight,
      volume,
      price,
      originalPrice,
      discountPercent,
      brand,
      coefficient,
      catalogProductId,
    } = body ?? {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'نام محصول رقیب الزامی است' }, { status: 400 })
    }
    if (!source || typeof source !== 'string' || !source.trim()) {
      return NextResponse.json({ error: 'منبع الزامی است' }, { status: 400 })
    }

    const cp = await db.competitorProduct.create({
      data: {
        source: source.trim(),
        sourceId: sourceId?.trim() || null,
        name: name.trim(),
        imageUrl: imageUrl?.trim() || null,
        weight: weight?.trim() || null,
        volume: volume?.trim() || null,
        price: typeof price === 'number' && !isNaN(price) ? price : null,
        originalPrice: typeof originalPrice === 'number' && !isNaN(originalPrice) ? originalPrice : null,
        discountPercent: typeof discountPercent === 'number' && !isNaN(discountPercent) ? discountPercent : null,
        brand: brand?.trim() || null,
        coefficient: typeof coefficient === 'number' && !isNaN(coefficient) ? coefficient : null,
        catalogProductId: catalogProductId || null,
        fetchedAt: new Date(),
      },
    })

    // Seed an initial price history entry if a price was provided
    if (typeof price === 'number' && !isNaN(price)) {
      await db.competitorPriceHistory.create({
        data: {
          competitorProductId: cp.id,
          price,
          originalPrice: typeof originalPrice === 'number' ? originalPrice : null,
          discountPercent: typeof discountPercent === 'number' ? discountPercent : null,
        },
      })
    }

    return NextResponse.json(cp, { status: 201 })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

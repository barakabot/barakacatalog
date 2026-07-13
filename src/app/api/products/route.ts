import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId') // 'root' | specific id | 'none' | 'all' | null
  const q = searchParams.get('q') // search query
  const hasPrice = searchParams.get('hasPrice') // 'true' | 'false' | null
  const hasPromotion = searchParams.get('hasPromotion')
  const direct = searchParams.get('direct') === 'true' // only direct products (no descendants)
  const showDeleted = searchParams.get('deleted') === 'true'
  const limit = Number(searchParams.get('limit') ?? 0)
  const offset = Number(searchParams.get('offset') ?? 0)

  // Build groupId filter
  let groupFilter: any = undefined
  if (groupId === 'none') {
    groupFilter = null
  } else if (groupId === 'root') {
    groupFilter = { group: { parentId: null } }
  } else if (groupId && groupId !== 'all') {
    if (direct) {
      // only direct products of this exact group
      groupFilter = groupId
    } else {
      // include products in this group OR in its children
      const children = await db.productGroup.findMany({
        where: { parentId: groupId },
        select: { id: true },
      })
      const ids = [groupId, ...children.map((c) => c.id)]
      groupFilter = { in: ids }
    }
  }

  const where: any = {}
  if (showDeleted) where.deletedAt = { not: null }
  else where.deletedAt = null
  if (groupFilter !== undefined) where.groupId = groupFilter
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
    ]
  }
  if (hasPrice === 'true') where.price = { gt: 0 }
  if (hasPrice === 'false') where.price = { equals: 0 }
  if (hasPromotion === 'true') where.promotionDescription = { not: null }
  if (hasPromotion === 'false') where.promotionDescription = null

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        group: { select: { id: true, name: true, parentId: true } },
        competitorProducts: { select: { id: true, price: true, source: true, name: true, coefficient: true, originalPrice: true, discountPercent: true } },
        _count: { select: { competitorProducts: true, images: true } },
      },
      orderBy: { updatedAt: 'desc' },
      ...(limit > 0 ? { take: limit, skip: offset } : {}),
    }),
    db.product.count({ where }),
  ])

  return NextResponse.json({ items, total })
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const {
      name,
      description,
      price,
      imageUrl,
      groupId,
      competitiveAdvantage,
      promotionDescription,
      targetMarket,
      margin,
    } = body ?? {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'نام محصول الزامی است' }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        price: typeof price === 'number' && !isNaN(price) ? price : 0,
        imageUrl: imageUrl?.trim() || null,
        groupId: groupId || null,
        competitiveAdvantage: competitiveAdvantage?.trim() || null,
        promotionDescription: promotionDescription?.trim() || null,
        targetMarket: targetMarket?.trim() || null,
        margin: typeof margin === 'number' && !isNaN(margin) ? margin : null,
      },
      include: { group: { select: { id: true, name: true } } },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

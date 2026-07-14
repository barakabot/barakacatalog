import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true, parentId: true } },
      images: { orderBy: { order: 'asc' } },
      competitorProducts: {
        include: { _count: { select: { priceHistory: true } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })
  if (!product) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
  return NextResponse.json(product)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })

    const data: any = {}
    for (const key of [
      'name',
      'description',
      'imageUrl',
      'groupId',
      'competitiveAdvantage',
      'promotionDescription',
      'targetMarket',
    ]) {
      if (key in body) {
        const v = body[key]
        data[key] = v === '' || v === null ? (key === 'groupId' ? null : null) : v
      }
    }
    if ('price' in body) {
      const p = Number(body.price)
      data.price = isNaN(p) ? 0 : p
    }
    if ('margin' in body) {
      const m = Number(body.margin)
      data.margin = isNaN(m) ? null : m
    }
    // Normalize empty strings
    if (data.name !== undefined && typeof data.name === 'string') data.name = data.name.trim()
    if (data.groupId === '') data.groupId = null

    const updated = await db.product.update({
      where: { id },
      data,
      include: { group: { select: { id: true, name: true } } },
    })
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
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'محصول یافت نشد' }, { status: 404 })
    // Soft delete
    await db.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()
    const existing = await db.productGroup.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'گروه یافت نشد' }, { status: 404 })

    const data: any = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if ('description' in body) data.description = body.description?.trim() || null
    if ('imageUrl' in body) data.imageUrl = body.imageUrl?.trim() || null
    if ('parentId' in body) {
      const newParent = body.parentId || null
      // prevent cycle: a group cannot be its own parent or a descendant of itself
      if (newParent === id) {
        return NextResponse.json({ error: 'یک گروه نمی‌تواند والد خودش باشد' }, { status: 400 })
      }
      if (newParent) {
        let cur: string | null = newParent
        const seen = new Set<string>()
        while (cur && !seen.has(cur)) {
          if (cur === id) {
            return NextResponse.json({ error: 'انتقال به گروه فرزند مجاز نیست' }, { status: 400 })
          }
          seen.add(cur)
          const node = await db.productGroup.findUnique({ where: { id: cur }, select: { parentId: true } })
          cur = node?.parentId ?? null
        }
        data.parentId = newParent
      } else {
        data.parentId = null
      }
    }
    if (typeof body.order === 'number') data.order = body.order

    const updated = await db.productGroup.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const existing = await db.productGroup.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'گروه یافت نشد' }, { status: 404 })

    // Check for children or products
    const childCount = await db.productGroup.count({ where: { parentId: id } })
    const productCount = await db.product.count({ where: { groupId: id } })
    if (childCount > 0 || productCount > 0) {
      return NextResponse.json(
        {
          error: `این گروه دارای ${productCount} محصول و ${childCount} زیرگروه است و قابل حذف نیست. ابتدا آن‌ها را جابجا کنید.`,
        },
        { status: 400 }
      )
    }

    await db.productGroup.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

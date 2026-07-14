import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

/** Returns all groups as a flat list plus a tree structure (public catalog view). */
export async function GET() {
  const groups = await db.productGroup.findMany({
    include: {
      _count: { select: { products: true, children: true } },
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  // Build tree
  const byId = new Map(groups.map((g) => [g.id, { ...g, children: [] as any[] }]))
  const roots: any[] = []
  for (const g of byId.values()) {
    if (g.parentId && byId.has(g.parentId)) {
      byId.get(g.parentId)!.children.push(g)
    } else {
      roots.push(g)
    }
  }

  return NextResponse.json({ items: groups, tree: roots })
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { name, parentId, order, description, imageUrl } = body ?? {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'نام گروه الزامی است' }, { status: 400 })
    }
    if (parentId) {
      const parent = await db.productGroup.findUnique({ where: { id: parentId } })
      if (!parent) return NextResponse.json({ error: 'گروه والد نامعتبر است' }, { status: 400 })
    }

    const group = await db.productGroup.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        order: typeof order === 'number' ? order : 0,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
      },
    })
    return NextResponse.json(group, { status: 201 })
  } catch (e: any) {
    if (e instanceof Response) return e
    return NextResponse.json({ error: e?.message ?? 'خطای سرور' }, { status: 500 })
  }
}

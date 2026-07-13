import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const [
    totalProducts,
    totalGroups,
    totalCompetitors,
    productsWithPrice,
    priceAgg,
    groupCounts,
    promotionCount,
    withMargin,
    withTargetMarket,
    withAdvantage,
  ] = await Promise.all([
    db.product.count({ where: { deletedAt: null } }),
    db.productGroup.count(),
    db.competitorProduct.count(),
    db.product.count({ where: { price: { gt: 0 }, deletedAt: null } }),
    db.product.aggregate({ where: { deletedAt: null }, _sum: { price: true }, _avg: { price: true }, _min: { price: true }, _max: { price: true } }),
    db.productGroup.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
        order: true,
        _count: { select: { products: { where: { deletedAt: null } }, children: true } },
      },
      orderBy: { order: 'asc' },
    }),
    db.product.count({ where: { promotionDescription: { not: null }, deletedAt: null } }),
    db.product.count({ where: { margin: { not: null }, deletedAt: null } }),
    db.product.count({ where: { targetMarket: { not: null }, deletedAt: null } }),
    db.product.count({ where: { competitiveAdvantage: { not: null }, deletedAt: null } }),
  ])

  // Top-level groups with their direct product counts
  const rootGroups = groupCounts.filter((g) => !g.parentId)
  const childGroups = groupCounts.filter((g) => g.parentId)

  // Products per top-level group (including descendants)
  const groupHierarchy = rootGroups.map((root) => {
    const children = childGroups.filter((c) => c.parentId === root.id)
    const directCount = root._count.products
    const childCount = children.reduce((sum, c) => sum + c._count.products, 0)
    return {
      id: root.id,
      name: root.name,
      directCount,
      childCount,
      total: directCount + childCount,
      children: children.map((c) => ({ id: c.id, name: c.name, count: c._count.products })),
    }
  })

  return NextResponse.json({
    totalProducts,
    totalGroups,
    totalCompetitors,
    productsWithPrice,
    productsWithoutPrice: totalProducts - productsWithPrice,
    promotionCount,
    withMargin,
    withoutMargin: totalProducts - withMargin,
    withTargetMarket,
    withAdvantage,
    price: {
      sum: priceAgg._sum.price ?? 0,
      avg: priceAgg._avg.price ?? 0,
      min: priceAgg._min.price ?? 0,
      max: priceAgg._max.price ?? 0,
    },
    groupHierarchy,
  })
}

// Shared types matching the Prisma models (subset for client use)

export interface ProductGroup {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  parentId: string | null
  order: number
  createdAt: number
  updatedAt: number
  _count?: { products: number; children: number }
  children?: ProductGroup[]
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  groupId: string | null
  competitiveAdvantage: string | null
  promotionDescription: string | null
  targetMarket: string | null
  margin: number | null
  deletedAt: number | string | null
  createdAt: number
  updatedAt: number
  group?: { id: string; name: string; parentId: string | null } | null
  images?: ProductImage[]
  competitorProducts?: CompetitorProduct[]
  _count?: { competitorProducts: number; images: number }
}

export interface ProductImage {
  id: string
  url: string
  alt: string | null
  order: number
  productId: string
  createdAt: number
}

export interface CompetitorProduct {
  id: string
  source: string
  sourceId: string | null
  name: string
  imageUrl: string | null
  weight: string | null
  volume: string | null
  price: number | null
  originalPrice: number | null
  discountPercent: number | null
  brand: string | null
  coefficient: number | null
  fetchedAt: number | string | null
  catalogProductId: string | null
  catalogProduct?: { id: string; name: string; price?: number } | null
  createdAt: number
  updatedAt: number
  _count?: { priceHistory: number }
  priceHistory?: CompetitorPriceHistory[]
}

export interface CompetitorPriceHistory {
  id: string
  competitorProductId: string
  price: number
  originalPrice: number | null
  discountPercent: number | null
  fetchedAt: number | string
}

export interface Settings {
  id: string
  currencyUnit: string
  hasPassword: boolean
}

export interface DashboardStats {
  totalProducts: number
  totalGroups: number
  totalCompetitors: number
  productsWithPrice: number
  productsWithoutPrice: number
  promotionCount: number
  withMargin: number
  withoutMargin: number
  withTargetMarket: number
  withAdvantage: number
  price: {
    sum: number
    avg: number
    min: number
    max: number
  }
  groupHierarchy: Array<{
    id: string
    name: string
    directCount: number
    childCount: number
    total: number
    children: Array<{ id: string; name: string; count: number }>
  }>
}

export type SectionKey = 'dashboard' | 'products' | 'groups' | 'competitors' | 'settings'

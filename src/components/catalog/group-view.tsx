'use client'

import { motion } from 'framer-motion'
import { Product, ProductGroup } from '@/lib/types'
import { formatCurrency, formatNumber } from '@/lib/format'
import { ChevronLeft, Package, Tag, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Props {
  group: ProductGroup
  subgroups: ProductGroup[] // subgroups
  products: Product[] // direct products in this group
  currencyUnit: string
  onOpenGroup: (g: ProductGroup) => void
  onOpenProduct: (p: Product) => void
}

export function GroupView({ group, subgroups, products, currencyUnit, onOpenGroup, onOpenProduct }: Props) {
  return (
    <div className="animate-fade-in">
      {/* Group hero banner */}
      <section className="relative h-[42vh] min-h-[300px] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={group.imageUrl ? { backgroundImage: `url(${group.imageUrl})` } : { backgroundColor: 'oklch(0.3 0.03 45)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.15_0.02_45/0.5)] via-[oklch(0.15_0.02_45/0.5)] to-[oklch(0.15_0.02_45/0.9)]" />
        <div className="absolute inset-0 grain" />

        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <p className="text-[var(--gold)] text-xs tracking-[0.4em] uppercase" dir="ltr">
              Collection
            </p>
            <h1 className="font-display text-5xl sm:text-6xl text-cream tracking-wide" style={{ color: 'oklch(0.96 0.015 80)' }}>
              {group.name}
            </h1>
            {group.description && (
              <p className="text-cream/80 text-base sm:text-lg font-light max-w-2xl mx-auto leading-relaxed" style={{ color: 'oklch(0.9 0.02 80 / 0.8)' }}>
                {group.description}
              </p>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="h-px w-12 bg-[var(--gold)]/40" />
              <span className="text-[var(--gold)] text-xs">✦</span>
              <span className="h-px w-12 bg-[var(--gold)]/40" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Subgroups */}
      {subgroups.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-[var(--gold)] text-xs tracking-[0.4em] uppercase mb-2" dir="ltr">Sub-Collections</p>
            <h2 className="font-display text-3xl sm:text-4xl text-foreground">زیرمجموعه‌ها</h2>
            <div className="gold-divider w-24 mt-3" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {subgroups.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => onOpenGroup(c)}
                className="group relative aspect-[4/3] overflow-hidden rounded-sm text-right block w-full bg-muted"
              >
                <div className="absolute inset-0 img-zoom">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <Package className="w-12 h-12 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.15_0.02_45/0.92)] via-[oklch(0.15_0.02_45/0.2)] to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <div className="transform transition-transform duration-500 group-hover:-translate-y-1">
                    <h3 className="font-display text-2xl text-cream mb-1" style={{ color: 'oklch(0.96 0.015 80)' }}>{c.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-cream/60 text-xs" style={{ color: 'oklch(0.9 0.02 80 / 0.6)' }}>
                        {formatNumber(c._count?.products ?? 0)} محصول
                      </span>
                      <ChevronLeft className="w-4 h-4 text-[var(--gold)] transition-transform group-hover:-translate-x-1" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 border border-[var(--gold)]/0 group-hover:border-[var(--gold)]/40 transition-colors duration-500 pointer-events-none rounded-sm" />
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {/* Products in this group */}
      {products.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="mb-10">
            <p className="text-[var(--gold)] text-xs tracking-[0.4em] uppercase mb-2" dir="ltr">Products</p>
            <h2 className="font-display text-3xl sm:text-4xl text-foreground">محصولات</h2>
            <div className="gold-divider w-24 mt-3" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} currencyUnit={currencyUnit} onClick={() => onOpenProduct(p)} index={i} />
            ))}
          </div>
        </section>
      )}

      {subgroups.length === 0 && products.length === 0 && (
        <div className="py-24 text-center">
          <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">این مجموعه هنوز محصولی ندارد</p>
        </div>
      )}
    </div>
  )
}

interface CardProps {
  product: Product
  currencyUnit: string
  onClick: () => void
  index: number
}

function ProductCard({ product, currencyUnit, onClick, index }: CardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.45, delay: (index % 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group text-right block"
    >
      <div className="relative aspect-square overflow-hidden rounded-sm bg-muted mb-3 img-zoom border border-border/40">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[oklch(0.94_0.015_72)] to-[oklch(0.88_0.02_70)] flex items-center justify-center">
            <Package className="w-10 h-10 text-muted-foreground/25" />
          </div>
        )}
        {product.promotionDescription && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-[var(--gold)] text-[oklch(0.17_0.012_45)] text-[10px] font-medium tracking-wide shadow-md" style={{ backgroundColor: 'oklch(0.72 0.13 75)', color: 'oklch(0.17 0.012 45)' }}>
              <Tag className="w-2.5 h-2.5" />
              {product.promotionDescription}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-[oklch(0.15_0.02_45/0)] group-hover:bg-[oklch(0.15_0.02_45/0.15)] transition-colors duration-500" />
        <div className="absolute inset-0 border border-[var(--gold)]/0 group-hover:border-[var(--gold)]/30 transition-colors duration-500 pointer-events-none" />
      </div>
      <div className="space-y-1">
        <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2 group-hover:text-[var(--gold)] transition-colors">
          {product.name}
        </h3>
        {product.price > 0 ? (
          <p className="font-display text-lg text-foreground/90 tracking-wide">
            {formatCurrency(product.price, currencyUnit)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">قیمت بر اساس استعلام</p>
        )}
      </div>
    </motion.button>
  )
}

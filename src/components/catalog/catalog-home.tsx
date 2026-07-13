'use client'

import { motion } from 'framer-motion'
import { ProductGroup } from '@/lib/types'
import { formatNumber } from '@/lib/format'
import { ChevronLeft, Package } from 'lucide-react'

interface Props {
  groups: ProductGroup[] // main groups (roots)
  onOpenGroup: (g: ProductGroup) => void
}

export function CatalogHome({ groups, onOpenGroup }: Props) {
  // Only show groups that actually contain products (in their subtree)
  const visibleGroups = groups.filter((g) => {
    const total = (g._count?.products ?? 0) + (g.children?.reduce((s, c) => s + (c._count?.products ?? 0), 0) ?? 0)
    return total > 0
  })

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/uploads/groups/hero.png)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.17_0.012_45/0.55)] via-[oklch(0.17_0.012_45/0.45)] to-[oklch(0.17_0.012_45/0.85)]" />
        <div className="absolute inset-0 grain" />

        <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <p className="text-[var(--gold)] text-xs sm:text-sm tracking-[0.5em] uppercase font-light" dir="ltr">
              The Art of Confectionery
            </p>
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl text-cream tracking-wide" style={{ color: 'oklch(0.96 0.015 80)' }}>
              BARAKA
            </h1>
            <div className="flex items-center justify-center gap-3">
              <span className="h-px w-16 bg-[var(--gold)]/50" />
              <span className="text-[var(--gold)]">✦</span>
              <span className="h-px w-16 bg-[var(--gold)]/50" />
            </div>
            <p className="text-cream/85 text-lg sm:text-xl font-light max-w-xl mx-auto leading-relaxed" style={{ color: 'oklch(0.92 0.02 80 / 0.85)' }}>
              مجموعه‌ای اصیل از شیرینی، شکلات و خوشمزه‌های باراکا
            </p>
          </motion.div>

          {/* Scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <div className="flex flex-col items-center gap-2 text-cream/50" style={{ color: 'oklch(0.9 0.02 80 / 0.5)' }}>
              <span className="text-xs tracking-widest">کشف کنید</span>
              <div className="w-px h-8 bg-current animate-pulse" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Collections */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[var(--gold)] text-xs tracking-[0.4em] uppercase mb-3" dir="ltr">Our Collections</p>
          <h2 className="font-display text-4xl sm:text-5xl text-foreground mb-3">مجموعه‌های ما</h2>
          <div className="gold-divider w-32 mx-auto" />
        </div>

        {visibleGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">گروهی برای نمایش وجود ندارد</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {visibleGroups.map((g, i) => {
              const totalProducts =
                (g._count?.products ?? 0) +
                (g.children?.reduce((s, c) => s + (c._count?.products ?? 0), 0) ?? 0)
              const childCount = g.children?.length ?? 0
              return (
                <motion.button
                  key={g.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => onOpenGroup(g)}
                  className="group relative aspect-[16/10] overflow-hidden rounded-sm text-right block w-full bg-muted"
                >
                  {/* Image */}
                  <div className="absolute inset-0 img-zoom">
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt={g.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        <Package className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.15_0.02_45/0.92)] via-[oklch(0.15_0.02_45/0.25)] to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
                    <div className="transform transition-transform duration-500 group-hover:-translate-y-1">
                      {childCount > 0 && (
                        <p className="text-[var(--gold)] text-xs tracking-widest mb-2" dir="ltr">
                          {childCount} SUB-COLLECTIONS
                        </p>
                      )}
                      <h3 className="font-display text-3xl sm:text-4xl text-cream mb-2" style={{ color: 'oklch(0.96 0.015 80)' }}>
                        {g.name}
                      </h3>
                      {g.description && (
                        <p className="text-cream/75 text-sm max-w-md leading-relaxed line-clamp-2" style={{ color: 'oklch(0.9 0.02 80 / 0.75)' }}>
                          {g.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-cream/60 text-xs" style={{ color: 'oklch(0.9 0.02 80 / 0.6)' }}>
                          {formatNumber(totalProducts)} محصول
                        </span>
                        <span className="h-3 w-px bg-cream/30" style={{ backgroundColor: 'oklch(0.9 0.02 80 / 0.3)' }} />
                        <span className="flex items-center gap-1 text-[var(--gold)] text-sm tracking-wide">
                          مشاهده مجموعه
                          <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gold border on hover */}
                  <div className="absolute inset-0 border border-[var(--gold)]/0 group-hover:border-[var(--gold)]/40 transition-colors duration-500 pointer-events-none rounded-sm" />
                </motion.button>
              )
            })}
          </div>
        )}
      </section>

      {/* Footer band */}
      <section className="border-t border-border bg-[oklch(0.96_0.01_75)] py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-display text-2xl text-foreground mb-2">باراکا</p>
          <div className="gold-divider w-24 mx-auto my-4" />
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xl mx-auto">
            اصالت در طعم، کیفیت در هر محصول. کاتالوگ رسمی محصولات باراکا.
          </p>
        </div>
      </section>
    </div>
  )
}

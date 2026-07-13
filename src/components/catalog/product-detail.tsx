'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Product } from '@/lib/types'
import { formatCurrency, formatNumber } from '@/lib/format'
import { X, Tag, Target, Sparkles, TrendingUp, TrendingDown, Package, ArrowLeft, BarChart3, Calculator, Equal } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  product: Product | null
  currencyUnit: string
  onClose: () => void
}

export function ProductDetail({ product, currencyUnit, onClose }: Props) {
  // Lock body scroll & ESC to close
  useEffect(() => {
    if (!product) return
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = orig
      window.removeEventListener('keydown', onKey)
    }
  }, [product, onClose])

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[oklch(0.12_0.015_45/0.85)] backdrop-blur-sm" />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-background w-full max-w-5xl max-h-[100vh] sm:max-h-[90vh] overflow-y-auto elegant-scroll sm:rounded-sm shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:bg-muted hover:border-[var(--gold)] transition-colors"
              aria-label="بستن"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* Image */}
              <div className="relative aspect-square md:aspect-auto md:min-h-[500px] bg-gradient-to-br from-muted to-muted/40 overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-20 h-20 text-muted-foreground/20" />
                  </div>
                )}
                {product.promotionDescription && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[var(--gold)] text-[oklch(0.17_0.012_45)] text-xs font-medium tracking-wide shadow-lg" style={{ backgroundColor: 'oklch(0.72 0.13 75)', color: 'oklch(0.17 0.012 45)' }}>
                      <Tag className="w-3 h-3" />
                      {product.promotionDescription}
                    </span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-8 sm:p-10 flex flex-col">
                {product.group && (
                  <p className="text-[var(--gold)] text-xs tracking-[0.3em] uppercase mb-3" dir="ltr">
                    {product.group.name}
                  </p>
                )}
                <h2 className="font-display text-3xl sm:text-4xl text-foreground leading-tight mb-3">
                  {product.name}
                </h2>
                <div className="gold-divider w-16 mb-5" />

                {product.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 whitespace-pre-line">
                    {product.description}
                  </p>
                )}

                {/* Price */}
                <div className="mb-6">
                  {product.price > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">قیمت</p>
                      <p className="font-display text-3xl text-foreground tracking-wide">
                        {formatCurrency(product.price, currencyUnit)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">قیمت بر اساس استعلام</p>
                  )}
                </div>

                {/* Competitor prices */}
                <CompetitorPrices product={product} currencyUnit={currencyUnit} />

                {/* Attributes */}
                <div className="space-y-4 mt-auto pt-6 border-t border-border">
                  {product.margin != null && (
                    <Attribute
                      icon={TrendingUp}
                      label="حاشیه سود"
                      value={`${formatNumber(product.margin)}٪`}
                    />
                  )}
                  {product.targetMarket && (
                    <Attribute icon={Target} label="بازار هدف" value={product.targetMarket} />
                  )}
                  {product.competitiveAdvantage && (
                    <Attribute
                      icon={Sparkles}
                      label="مزیت رقابتی"
                      value={product.competitiveAdvantage}
                      multiline
                    />
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-[var(--gold)] transition-colors self-start group"
                >
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  بازگشت به مجموعه
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CompetitorPrices({ product, currencyUnit }: { product: Product; currencyUnit: string }) {
  const comps = product.competitorProducts?.filter(c => c.price != null && c.price > 0)
  if (!comps?.length) return null
  const sourceLabel = (s: string) => s === 'DIGIKALA' ? 'دیجی‌کالا' : s === 'SNAPPSHOP' ? 'اسنپ‌شاپ' : s === 'TOROB' ? 'ترب' : s
  return (
    <div className="mb-6 p-4 rounded-sm border border-border bg-muted/30 space-y-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5" />
        قیمت رقبا ({comps.length} منبع)
      </p>
      <div className="space-y-2">
        {comps.map((c) => {
          const realPrice = c.price!
          const coeff = c.coefficient != null && c.coefficient > 0 ? c.coefficient : null
          const comparativePrice = coeff ? Math.round(realPrice * coeff) : null
          return (
            <div key={c.id} className="p-3 rounded-sm bg-background/60 border border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate min-w-0">{c.name || '—'}</p>
                <span className="shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {sourceLabel(c.source)}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">قیمت واقعی:</span>
                  <span className="font-display text-base tracking-wide">{formatCurrency(realPrice, currencyUnit)}</span>
                </div>
                {c.originalPrice != null && c.originalPrice > realPrice && (
                  <span className="text-xs text-muted-foreground line-through">{formatCurrency(c.originalPrice, currencyUnit)}</span>
                )}
                {coeff != null && (() => {
                  const catPrice = product.price
                  const cmp = comparativePrice!
                  const colorClass = catPrice > 0
                    ? cmp > catPrice
                      ? 'text-rose-600 dark:text-rose-400'
                      : cmp < catPrice
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-blue-600 dark:text-blue-400'
                    : 'text-blue-600 dark:text-blue-400'
                  const iconColorClass = catPrice > 0
                    ? cmp > catPrice
                      ? 'text-rose-500'
                      : cmp < catPrice
                      ? 'text-emerald-500'
                      : 'text-blue-500'
                    : 'text-blue-500'
                  return (
                    <>
                      <span className="text-muted-foreground">×</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">ضریب:</span>
                        <span className="font-mono text-xs text-[var(--gold)]">{formatNumber(coeff)}</span>
                      </div>
                      <span className="text-muted-foreground">=</span>
                      <div className="flex items-center gap-1.5">
                        <Calculator className={`w-3 h-3 ${iconColorClass}`} />
                        <span className="text-[10px] text-muted-foreground">قیمت مقایسه‌ای:</span>
                        <span className={`font-display text-base ${colorClass} tracking-wide font-semibold`}>
                          {formatCurrency(cmp, currencyUnit)}
                        </span>
                      </div>
                    </>
                  )
                })()}
              </div>
              {c.discountPercent != null && c.discountPercent > 0 && (
                <span className="inline-block text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.5 rounded">
                  {formatNumber(c.discountPercent)}٪ تخفیف
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Attribute({
  icon: Icon,
  label,
  value,
  multiline,
}: {
  icon: any
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-9 h-9 rounded-full bg-[var(--accent)]/60 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[var(--gold)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm text-foreground ${multiline ? 'leading-relaxed' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

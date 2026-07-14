'use client'

import { useState, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { CompetitorProduct, Product } from '@/lib/types'
import { formatCurrency, formatNumber, formatPersianDateTime } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, ArrowLeftRight, RefreshCw, Loader2, Package, Trophy, Calculator } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  competitor: CompetitorProduct | null
  open: boolean
  onClose: () => void
}

export function PriceCompareDialog({ competitor, open, onClose }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  // Fetch the linked catalog product + this competitor's fresh data + price history
  const { data: compDetail, loading, refetch } = useApi<{
    catalogProduct?: { id: string; name: string; price: number } | null
    price: number | null
    originalPrice: number | null
    discountPercent: number | null
    coefficient: number | null
    source: string
    sourceId: string
    name: string
    brand: string | null
    catalogProductId: string | null
  }>(competitor ? `/api/competitors/${competitor.id}` : null, { enabled: Boolean(competitor) })

  async function handleRefresh() {
    if (!competitor) return
    setRefreshing(true)
    const res = await apiCall(`/api/competitors/${competitor.id}/refresh`, { method: 'POST' })
    setRefreshing(false)
    if (res.ok) {
      toast.success('قیمت از سایت بروزرسانی شد')
      refetch()
    } else {
      toast.error(res.error ?? 'خطا در بروزرسانی')
    }
  }

  const catPrice = compDetail?.catalogProduct?.price ?? 0
  const compPrice = compDetail?.price ?? 0
  const coeff = compDetail?.coefficient != null && compDetail.coefficient > 0 ? compDetail.coefficient : null
  const comparativePrice = compPrice > 0 && coeff ? Math.round(compPrice * coeff) : 0
  const diff = catPrice > 0 && compPrice > 0 ? compPrice - catPrice : 0
  const diffPct = catPrice > 0 && compPrice > 0 ? Math.round((diff / catPrice) * 1000) / 10 : 0
  const coeffDiff = catPrice > 0 && comparativePrice > 0 ? comparativePrice - catPrice : 0
  const coeffDiffPct = catPrice > 0 && comparativePrice > 0 ? Math.round((coeffDiff / catPrice) * 1000) / 10 : 0

  const isCheaper = diff < 0
  const isExpensive = diff > 0
  const isSame = diff === 0 && catPrice > 0 && compPrice > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            مقایسه قیمت
          </DialogTitle>
          <DialogDescription className="truncate">
            {compDetail?.name ?? competitor?.name} — {compDetail?.source ?? competitor?.source}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !compDetail ? (
          <p className="text-center text-muted-foreground py-8">اطلاعاتی یافت نشد</p>
        ) : (
          <div className="space-y-4">
            {/* Two-column comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Catalog price */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Package className="w-3.5 h-3.5" />
                  قیمت کاتالوگ ما
                </div>
                {catPrice > 0 ? (
                  <p className="font-display text-2xl font-semibold">{formatCurrency(catPrice)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">قیمت ثبت نشده</p>
                )}
                {compDetail.catalogProduct?.name && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">{compDetail.catalogProduct.name}</p>
                )}
              </div>

              {/* Competitor price */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Trophy className="w-3.5 h-3.5" />
                  قیمت واقعی رقیب
                </div>
                {compPrice > 0 ? (
                  <>
                    <p className="font-display text-2xl font-semibold">{formatCurrency(compPrice)}</p>
                    {compDetail.originalPrice != null && compDetail.originalPrice > compPrice && (
                      <p className="text-xs text-muted-foreground line-through mt-1">
                        {formatCurrency(compDetail.originalPrice)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">قیمت موجود نیست</p>
                )}
              </div>
            </div>

            {/* Comparative price (with coefficient) */}
            {compPrice > 0 && coeff != null && (
              <div className={`p-4 rounded-lg border ${
                catPrice > 0 && comparativePrice > catPrice
                  ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30'
                  : catPrice > 0 && comparativePrice < catPrice
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30'
              }`}>
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Calculator className={`w-3.5 h-3.5 ${
                    catPrice > 0 && comparativePrice > catPrice
                      ? 'text-rose-600'
                      : catPrice > 0 && comparativePrice < catPrice
                      ? 'text-emerald-600'
                      : 'text-blue-600'
                  }`} />
                  قیمت مقایسه‌ای (ضرب در ضریب)
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground">{formatCurrency(compPrice)}</span>
                  <span className="text-muted-foreground text-sm">×</span>
                  <span className="font-mono text-sm text-[var(--gold)] font-semibold">{formatNumber(coeff)}</span>
                  <span className="text-muted-foreground text-sm">=</span>
                  <span className={`font-display text-2xl font-semibold ${
                    catPrice > 0 && comparativePrice > catPrice
                      ? 'text-rose-700 dark:text-rose-400'
                      : catPrice > 0 && comparativePrice < catPrice
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }`}>
                    {formatCurrency(comparativePrice)}
                  </span>
                </div>
                {catPrice > 0 && (
                  <div className={`mt-3 pt-3 border-t ${
                    coeffDiff < 0
                      ? 'border-emerald-200 dark:border-emerald-800'
                      : coeffDiff > 0
                      ? 'border-rose-200 dark:border-rose-800'
                      : 'border-blue-200 dark:border-blue-800'
                  } flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      {coeffDiff < 0 ? (
                        <TrendingDown className="w-4 h-4 text-emerald-600" />
                      ) : coeffDiff > 0 ? (
                        <TrendingUp className="w-4 h-4 text-rose-600" />
                      ) : (
                        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        مقایسه با کاتالوگ ما: {coeffDiff > 0 ? '+' : ''}{formatCurrency(Math.abs(coeffDiff))}
                      </span>
                    </div>
                    <Badge
                      className={
                        coeffDiff < 0
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                          : coeffDiff > 0
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300'
                          : ''
                      }
                    >
                      {coeffDiffPct > 0 ? '+' : ''}{formatNumber(coeffDiffPct)}٪
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Difference (raw) */}
            {catPrice > 0 && compPrice > 0 && (
              <div
                className={`p-4 rounded-lg border flex items-center justify-between ${
                  isCheaper
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : isExpensive
                    ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
                    : 'border-border bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isCheaper ? (
                    <TrendingDown className="w-6 h-6 text-emerald-600" />
                  ) : isExpensive ? (
                    <TrendingUp className="w-6 h-6 text-rose-600" />
                  ) : (
                    <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">تفاوت قیمت (واقعی)</p>
                    <p className={`font-mono text-lg font-bold ${
                      isCheaper ? 'text-emerald-700 dark:text-emerald-400'
                      : isExpensive ? 'text-rose-700 dark:text-rose-400'
                      : ''
                    }`}>
                      {diff > 0 ? '+' : ''}{formatCurrency(Math.abs(diff))}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <Badge
                    className={
                      isCheaper
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                        : isExpensive
                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300'
                        : ''
                    }
                  >
                    {diffPct > 0 ? '+' : ''}{formatNumber(diffPct)}٪
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isCheaper ? 'رقیب ارزان‌تر است' : isExpensive ? 'رقیب گران‌تر است' : 'قیمت‌ها برابرند'}
                  </p>
                </div>
              </div>
            )}

            {/* Competitor meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">برند</span>
                <span className="font-medium">{compDetail.brand ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <span className="text-muted-foreground">شناسه منبع</span>
                <span className="font-mono text-xs" dir="ltr">{compDetail.sourceId}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <RefreshCw className="w-4 h-4 ml-1" />}
                بروزرسانی از سایت
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

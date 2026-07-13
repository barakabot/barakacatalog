'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { Product, ProductGroup } from '@/lib/types'
import { formatCurrency, formatNumber, formatPersianDateTime } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  Filter,
  Loader2,
  ImageOff,
  Save,
  X,
  Download,
  Upload,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Trash,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ProductEditForm } from './product-edit-form'

export function ProductsSection() {
  const [search, setSearch] = useState('')
  const [groupId, setGroupId] = useState<string>('all')
  const [hasPrice, setHasPrice] = useState<string>('any')
  const [hasPromotion, setHasPromotion] = useState<string>('any')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const [editing, setEditing] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  // Excel import state
  const [importDialog, setImportDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; errors?: string[] } | null>(null)

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Track the filter signature to reset page when filters change
  const filterSig = `${debouncedSearch}|${groupId}|${hasPrice}|${hasPromotion}|${showDeleted}`
  const [lastFilterSig, setLastFilterSig] = useState(filterSig)
  if (filterSig !== lastFilterSig) {
    setLastFilterSig(filterSig)
    if (page !== 0) setPage(0)
  }
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // Build query URL
  const params = new URLSearchParams()
  if (debouncedSearch) params.set('q', debouncedSearch)
  if (groupId && groupId !== 'all') params.set('groupId', groupId)
  if (hasPrice !== 'any') params.set('hasPrice', hasPrice)
  if (hasPromotion !== 'any') params.set('hasPromotion', hasPromotion)
  if (showDeleted) params.set('deleted', 'true')
  params.set('limit', String(pageSize))
  params.set('offset', String(page * pageSize))

  const { data, loading, refetch } = useApi<{ items: Product[]; total: number }>(
    `/api/products?${params.toString()}`
  )
  const { data: groupsData } = useApi<{ items: ProductGroup[] }>('/api/groups')
  const { data: deletedCountData } = useApi<{ count: number }>('/api/products/deleted-count')
  const deletedCount = deletedCountData?.count ?? 0

  const groups = groupsData?.items ?? []
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Build a flat group lookup with parent path labels
  const groupOptions = useMemo(() => {
    const map = new Map(groups.map((g) => [g.id, g]))
    const labelFor = (g: ProductGroup): string => {
      if (g.parentId && map.has(g.parentId)) {
        return `${labelFor(map.get(g.parentId)!)} › ${g.name}`
      }
      return g.name
    }
    return groups.map((g) => ({ id: g.id, label: labelFor(g) })).sort((a, b) => a.label.localeCompare(b.label, 'fa'))
  }, [groups])

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/products/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'خطا در ورود اطلاعات')
        return
      }
      setImportResult({ created: data.created, updated: data.updated, skipped: data.skipped, errors: data.errors })
      toast.success(`${data.created} جدید، ${data.updated} بروزرسانی شدند`)
      refetch()
    } catch {
      toast.error('خطا در ارسال فایل')
    } finally {
      setImporting(false)
    }
  }

  async function handleRestore(p: Product) {
    const res = await apiCall(`/api/products/${p.id}/restore`, { method: 'POST' })
    if (res.ok) {
      toast.success(`«${p.name}» بازیابی شد`)
      refetch()
    } else {
      toast.error(res.error ?? 'بازیابی ناموفق')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await apiCall(`/api/products/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('محصول حذف شد')
      setDeleteTarget(null)
      refetch()
    } else {
      toast.error(res.error ?? 'حذف ناموفق')
    }
  }

  function exportCsv() {
    const headers = ['نام', 'گروه', 'قیمت', 'ارزان‌ترین رقیب', 'گران‌ترین رقیب', 'تخفیف/پروموشن', 'مزیت رقابتی', 'بازار هدف', 'حاشیه سود']
    const rows = items.map((p) => {
      const comps = p.competitorProducts?.filter(c => c.price != null && c.price > 0)
      const cheapest = comps?.length ? comps.reduce((a, b) => (a.price! < b.price! ? a : b)) : null
      const expensive = comps?.length ? comps.reduce((a, b) => (a.price! > b.price! ? a : b)) : null
      return [
        p.name,
        p.group?.name ?? '',
        String(p.price ?? 0),
        cheapest ? String(cheapest.price) : '',
        expensive ? String(expensive.price) : '',
        p.promotionDescription ?? '',
        p.competitiveAdvantage ?? '',
        p.targetMarket ?? '',
        String(p.margin ?? ''),
      ]
    })
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `products-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('خروجی CSV دریافت شد')
  }

  const hasFilters = debouncedSearch || groupId !== 'all' || hasPrice !== 'any' || hasPromotion !== 'any' || showDeleted

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3 md:items-center">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="جستجوی نام یا توضیحات محصول..."
                  className="pr-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => setCreating(true)} size="sm">
                  <Plus className="w-4 h-4 ml-1" />
                  محصول جدید
                </Button>
                <Button onClick={exportCsv} variant="outline" size="sm" disabled={items.length === 0}>
                  <Download className="w-4 h-4 ml-1" />
                  خروجی
                </Button>
                <Button onClick={() => { setImportResult(null); setImportFile(null); setImportDialog(true) }} variant="outline" size="sm">
                  <Upload className="w-4 h-4 ml-1" />
                  ورود اکسل
                </Button>
                <Button onClick={() => window.open('/api/templates/excel', '_blank')} variant="outline" size="sm">
                  <Download className="w-4 h-4 ml-1" />
                  تمپلت
                </Button>
                <Button
                  onClick={() => setShowDeleted((v) => !v)}
                  variant={showDeleted ? 'default' : 'outline'}
                  size="sm"
                  className={showDeleted ? 'bg-amber-600 hover:bg-amber-700' : ''}
                >
                  <Trash className="w-4 h-4 ml-1" />
                  سطل زباله
                  {deletedCount > 0 && !showDeleted && (
                    <span className="mr-1 px-1.5 py-0.5 text-[10px] rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      {deletedCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-full">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                  <SelectValue placeholder="همه گروه‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه گروه‌ها</SelectItem>
                  <SelectItem value="none">بدون گروه</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={hasPrice} onValueChange={setHasPrice}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="وضعیت قیمت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">همه (قیمت)</SelectItem>
                  <SelectItem value="true">دارای قیمت</SelectItem>
                  <SelectItem value="false">بدون قیمت</SelectItem>
                </SelectContent>
              </Select>

              <Select value={hasPromotion} onValueChange={setHasPromotion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="وضعیت تخفیف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">همه (تخفیف)</SelectItem>
                  <SelectItem value="true">دارای تخفیف</SelectItem>
                  <SelectItem value="false">بدون تخفیف</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">
                {loading ? 'در حال بارگذاری...' : `${formatNumber(total)} محصول یافت شد`}
                {hasFilters && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 pr-2 text-xs"
                    onClick={() => { setSearch(''); setGroupId('all'); setHasPrice('any'); setHasPromotion('any'); setShowDeleted(false) }}
                  >
                    پاک کردن فیلترها
                  </Button>
                )}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    قبلی
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    صفحه {formatNumber(page + 1)} از {formatNumber(totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    بعدی
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="p-4 rounded-2xl bg-muted">
                <Package className="w-10 h-10 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">محصولی یافت نشد</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasFilters ? 'فیلترها را تغییر دهید یا' : 'اولین محصول را اضافه کنید'}
                </p>
              </div>
              {!hasFilters && (
                <Button onClick={() => setCreating(true)} size="sm" variant="outline">
                  <Plus className="w-4 h-4 ml-1" /> افزودن محصول
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-21rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">تصویر</TableHead>
                    <TableHead>نام محصول</TableHead>
                    <TableHead className="hidden md:table-cell">گروه</TableHead>
                    <TableHead className="text-left">قیمت</TableHead>
                    <TableHead className="hidden lg:table-cell text-center"><TrendingDown className="w-3.5 h-3.5 inline-block ml-1 text-emerald-600" />ارزان‌ترین</TableHead>
                    <TableHead className="hidden lg:table-cell text-center"><TrendingUp className="w-3.5 h-3.5 inline-block ml-1 text-rose-600" />گران‌ترین</TableHead>
                    <TableHead className="hidden xl:table-cell">پروموشن</TableHead>
                    <TableHead className="hidden xl:table-cell text-center">حاشیه</TableHead>
                    <TableHead className="text-center">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="text-center">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover border border-border mx-auto"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
                            <ImageOff className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium truncate">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {p.group ? (
                          <Badge variant="secondary" className="font-normal">{p.group.name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-left whitespace-nowrap">
                        {p.price > 0 ? (
                          <span className="font-mono text-sm">{formatCurrency(p.price)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        {(() => {
                          const comps = p.competitorProducts?.filter(c => c.price != null && c.price > 0)
                          if (!comps?.length) return <span className="text-xs text-muted-foreground">—</span>
                          const cheapest = comps.reduce((a, b) => (a.price! < b.price! ? a : b))
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(cheapest.price!)}</span>
                              <span className="text-[10px] text-muted-foreground">{cheapest.source === 'DIGIKALA' ? 'دیجی‌کالا' : cheapest.source === 'SNAPPSHOP' ? 'اسنپ‌شاپ' : cheapest.source === 'TOROB' ? 'ترب' : cheapest.source}</span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        {(() => {
                          const comps = p.competitorProducts?.filter(c => c.price != null && c.price > 0)
                          if (!comps?.length) return <span className="text-xs text-muted-foreground">—</span>
                          const expensive = comps.reduce((a, b) => (a.price! > b.price! ? a : b))
                          return (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-mono text-sm text-rose-600 dark:text-rose-400">{formatCurrency(expensive.price!)}</span>
                              <span className="text-[10px] text-muted-foreground">{expensive.source === 'DIGIKALA' ? 'دیجی‌کالا' : expensive.source === 'SNAPPSHOP' ? 'اسنپ‌شاپ' : expensive.source === 'TOROB' ? 'ترب' : expensive.source}</span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {p.promotionDescription ? (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 font-normal">
                            {p.promotionDescription}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center">
                        {p.margin != null ? (
                          <span className="text-sm font-mono">{formatNumber(p.margin)}٪</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditing(p)}
                            title="ویرایش"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${showDeleted ? 'text-emerald-600 hover:text-emerald-600' : 'text-destructive hover:text-destructive'}`}
                            onClick={() => setDeleteTarget(p)}
                            title={showDeleted ? 'بازیابی' : 'حذف'}
                          >
                            {showDeleted ? <RotateCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create sheet */}
      <Sheet open={Boolean(editing) || creating} onOpenChange={(o) => { if (!o) { setEditing(null); setCreating(false) } }}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2">
              {editing ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {editing ? 'ویرایش محصول' : 'محصول جدید'}
            </SheetTitle>
            <SheetDescription>
              {editing ? 'اطلاعات محصول را به‌روزرسانی کنید' : 'اطلاعات محصول جدید را وارد کنید'}
            </SheetDescription>
          </SheetHeader>
          {(editing || creating) && (
            <ProductEditForm
              key={editing?.id ?? 'new'}
              product={editing}
              groups={groupOptions}
              onSaved={() => { setEditing(null); setCreating(false); refetch() }}
              onCancel={() => { setEditing(null); setCreating(false) }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Import Excel Dialog */}
      <Dialog open={importDialog} onOpenChange={(o) => { if (!o) { setImportDialog(false); setImportFile(null); setImportResult(null) } }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              ورود/بروزرسانی محصولات از اکسل
            </DialogTitle>
            <DialogDescription>
              فایل اکسل (xlsx/xls/csv) را آپلود کنید. محصولات موجود بر اساس نام بروزرسانی و محصولات جدید ایجاد می‌شوند.
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <>
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => document.getElementById('excel-upload-input')?.click()}
                >
                  <input
                    id="excel-upload-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      setImportFile(f)
                      if (e.target) e.target.value = ''
                    }}
                  />
                  {importFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                      <p className="text-sm font-medium">{importFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} کیلوبایت</p>
                      <Button variant="ghost" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); setImportFile(null) }}>
                        <X className="w-3 h-3 ml-1" /> تغییر فایل
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">کلیک کنید یا فایل را بکشید</p>
                      <p className="text-xs text-muted-foreground">xlsx, xls, csv — حداکثر ۱۰ مگابایت</p>
                    </div>
                  )}
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground mb-1">ستون‌های مجاز (فارسی یا انگلیسی):</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>نام (name) — <strong className="text-foreground">الزامی</strong></span>
                    <span>قیمت (price)</span>
                    <span>توضیحات (description)</span>
                    <span>گروه (group)</span>
                    <span>لینک تصویر (imageUrl)</span>
                    <span>حاشیه سود (margin)</span>
                    <span>مزیت رقابتی</span>
                    <span>بازار هدف</span>
                    <span>پروموشن</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialog(false)}>انصراف</Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
                  {importing ? 'در حال ورود...' : 'شروع ورود'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-emerald-600">{importResult.created}</p>
                    <p className="text-xs text-muted-foreground">جدید</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                    <Save className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                    <p className="text-xs text-muted-foreground">بروزرسانی</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-amber-600">{importResult.skipped}</p>
                    <p className="text-xs text-muted-foreground">رد شده</p>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">اخطارها:</p>
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground py-0.5">{err}</p>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => { setImportDialog(false); setImportResult(null) }}>بستن</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{showDeleted ? 'بازیابی محصول' : 'حذف محصول'}</AlertDialogTitle>
            <AlertDialogDescription>
              {showDeleted
                ? `آیا از بازیابی «${deleteTarget?.name}» مطمئن هستید؟`
                : `آیا از حذف «${deleteTarget?.name}» مطمئن هستید؟ محصول به سطل زباله منتقل می‌شود و قابل بازیابی خواهد بود.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return
                setDeleting(true)
                if (showDeleted) {
                  await handleRestore(deleteTarget)
                } else {
                  await handleDelete()
                }
              }}
              disabled={deleting}
              className={showDeleted ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              {showDeleted ? 'بازیابی' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
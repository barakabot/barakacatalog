'use client'

import { useState, useMemo, useCallback } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { CompetitorProduct, Product } from '@/lib/types'
import { formatCurrency, formatNumber, formatPersianDateTime } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Link2,
  TrendingUp,
  History,
  ImageOff,
  RefreshCw,
  Globe,
  Sparkles,
  Eye,
  Save,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrapeDialog } from './scrape-dialog'
import { PriceCompareDialog } from './price-compare-dialog'
import { CompetitorEditForm } from './competitor-edit-form'
import { ProxyPanel } from './proxy-panel'

const SOURCES = ['DIGIKALA', 'SNAPPSHOP', 'TOROB'] as const

interface ImportScrapeResult {
  rowNum: number
  sourceId: string
  source: string
  coefficient: number | null
  catalogProductId: string | null
  catalogProductName: string
  scraped?: {
    name: string
    imageUrl: string | null
    weight: string | null
    volume: string | null
    price: number
    originalPrice: number | null
    discountPercent: number
    brand: string | null
  }
  scrapeError?: string
  existingId?: string
}

export function CompetitorsSection() {
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<string>('all')
  const [linkFilter, setLinkFilter] = useState<string>('all') // all | linked | unlinked
  const [editing, setEditing] = useState<CompetitorProduct | null>(null)
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CompetitorProduct | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<CompetitorProduct | null>(null)
  const [compareTarget, setCompareTarget] = useState<CompetitorProduct | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [bulkRefreshing, setBulkRefreshing] = useState(false)

  // Excel import state
  const [importDialog, setImportDialog] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResults, setImportResults] = useState<ImportScrapeResult[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Fetch list from the Next.js API (which reads the same DB the python service writes to)
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (source !== 'all') params.set('source', source)

  const { data, loading, refetch } = useApi<{ items: CompetitorProduct[] }>(`/api/competitors?${params.toString()}`)
  const { data: productsData } = useApi<{ items: Product[] }>('/api/products?limit=0')
  const products = productsData?.items ?? []
  const allItems = data?.items ?? []

  // Apply link filter client-side
  const items = useMemo(() => {
    if (linkFilter === 'all') return allItems
    if (linkFilter === 'linked') return allItems.filter((c) => c.catalogProductId)
    return allItems.filter((c) => !c.catalogProductId)
  }, [allItems, linkFilter])

  const refreshOne = useCallback(async (c: CompetitorProduct) => {
    setRefreshingId(c.id)
    const res = await apiCall(`/api/competitors/${c.id}/refresh`, { method: 'POST' })
    setRefreshingId(null)
    if (res.ok) {
      toast.success(`قیمت به‌روزرسانی شد: ${res.data?.data?.name ?? c.name}`)
      refetch()
    } else {
      toast.error(res.error ?? 'خطا در بروزرسانی')
    }
  }, [refetch])

  const refreshAll = useCallback(async () => {
    setBulkRefreshing(true)
    toast.info('در حال بروزرسانی همه محصولات رقیب...')
    const res = await apiCall<{ success: number; failed: number }>('/api/competitors/refresh-all', { method: 'POST' })
    setBulkRefreshing(false)
    if (res.ok) {
      toast.success(`${res.data?.success ?? 0} موفق، ${res.data?.failed ?? 0} ناموفق`)
      refetch()
    } else {
      toast.error(res.error ?? 'خطا در بروزرسانی گروهی')
    }
  }, [refetch])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await apiCall(`/api/competitors/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('حذف شد')
      setDeleteTarget(null)
      refetch()
    } else toast.error(res.error ?? 'حذف ناموفق')
  }

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportResults(null)
    setSelectedIds(new Set())
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await fetch('/api/competitors/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'خطا در اسکرپ')
        return
      }
      setImportResults(data.results ?? [])
      // Auto-select all successfully scraped items
      const scraped = (data.results ?? []).filter((r: ImportScrapeResult) => r.scraped)
      setSelectedIds(new Set(scraped.map((r: ImportScrapeResult) => `${r.source}-${r.sourceId}`)))
      toast.success(`${data.scraped ?? 0} اسکرپ موفق، ${data.failed ?? 0} ناموفق`)
    } catch {
      toast.error('خطا در ارسال فایل')
    } finally {
      setImporting(false)
    }
  }

  async function handleSaveImport() {
    if (!importResults) return
    setSaving(true)
    try {
      const items = importResults
        .filter(r => r.scraped && selectedIds.has(`${r.source}-${r.sourceId}`))
        .map(r => ({
          source: r.source,
          sourceId: r.sourceId,
          coefficient: r.coefficient,
          catalogProductId: r.catalogProductId,
          ...r.scraped,
        }))
      if (items.length === 0) {
        toast.error('آیتمی انتخاب نشده')
        setSaving(false)
        return
      }
      const res = await fetch('/api/competitors/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'خطا در ذخیره')
        return
      }
      toast.success(`${data.created ?? 0} جدید، ${data.updated ?? 0} بروزرسانی شدند`)
      setImportDialog(false)
      setImportResults(null)
      setSelectedIds(new Set())
      refetch()
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  function downloadTemplate() {
    window.open('/api/templates/excel', '_blank')
  }

  const linkedCount = allItems.filter((c) => c.catalogProductId).length
  const unlinkedCount = allItems.length - linkedCount

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header card with stats + actions */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                <Trophy className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{formatNumber(allItems.length)}</span>
                  <span className="text-sm text-muted-foreground">محصول رقیب</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Link2 className="w-3 h-3 text-emerald-600" />
                    {formatNumber(linkedCount)} متصل
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    {formatNumber(unlinkedCount)} بدون اتصال
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setScrapeOpen(true)} size="sm">
                <Globe className="w-4 h-4 ml-1" />
                اسکرپ از سایت
              </Button>
              <Button onClick={() => { setImportResults([]); setImportFile(null); setImportDialog(true) }} variant="outline" size="sm">
                <Upload className="w-4 h-4 ml-1" />
                ورود اکسل
              </Button>
              <Button onClick={downloadTemplate} variant="outline" size="sm">
                <Download className="w-4 h-4 ml-1" />
                دانلود تمپلت
              </Button>
              <ProxyPanel />
              <Button
                onClick={refreshAll}
                variant="outline"
                size="sm"
                disabled={bulkRefreshing || allItems.length === 0}
              >
                {bulkRefreshing ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <RefreshCw className="w-4 h-4 ml-1" />}
                بروزرسانی همه
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی محصول رقیب..."
                className="pr-10"
              />
            </div>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="همه منابع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه منابع</SelectItem>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={linkFilter} onValueChange={setLinkFilter}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="وضعیت اتصال" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه (اتصال)</SelectItem>
                <SelectItem value="linked">متصل به کاتالوگ</SelectItem>
                <SelectItem value="unlinked">بدون اتصال</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="w-5 h-5 text-primary" />
            محصولات رقبا
          </CardTitle>
          <CardDescription>
            رصد قیمت محصولات رقبا — اسکرپ از دیجی‌کالا و اسنپ‌شاپ ({formatNumber(items.length)} مورد)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-2xl bg-muted">
                <Trophy className="w-10 h-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">محصول رقیبی ثبت نشده</p>
                <p className="text-sm text-muted-foreground mt-1">
                  با اسکرپ از دیجی‌کالا یا اسنپ‌شاپ شروع کنید
                </p>
              </div>
              <Button onClick={() => setScrapeOpen(true)} size="sm" variant="outline">
                <Globe className="w-4 h-4 ml-1" /> اسکرپ از سایت
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-26rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14 text-center">تصویر</TableHead>
                    <TableHead>نام محصول</TableHead>
                    <TableHead className="hidden md:table-cell">منبع / برند</TableHead>
                    <TableHead className="text-left">قیمت</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">تخفیف</TableHead>
                    <TableHead className="hidden xl:table-cell text-center">ضریب</TableHead>
                    <TableHead className="hidden xl:table-cell">کاتالوگ</TableHead>
                    <TableHead className="text-center">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/40">
                      <TableCell className="text-center">
                        {c.imageUrl ? (
                          <img src={c.imageUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover border border-border mx-auto" loading="lazy" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mx-auto">
                            <ImageOff className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="font-medium truncate">{c.name || '—'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <span className="font-mono" dir="ltr">{c.sourceId}</span>
                          {(c.weight || c.volume) && (
                            <span>• {[c.weight, c.volume].filter(Boolean).join(' / ')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="font-normal w-fit">
                            {c.source === 'DIGIKALA' ? 'دیجی‌کالا' : c.source === 'SNAPPSHOP' ? 'اسنپ‌شاپ' : c.source === 'TOROB' ? 'ترب' : c.source}
                          </Badge>
                          {c.brand && <span className="text-xs text-muted-foreground">{c.brand}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-left whitespace-nowrap">
                        {c.price != null ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-sm">{formatCurrency(c.price)}</span>
                            {c.coefficient != null && c.coefficient > 0 && (
                              <span className={`font-mono text-xs ${
                                c.catalogProduct?.price != null && c.catalogProduct.price > 0
                                  ? Math.round(c.price * c.coefficient) > c.catalogProduct.price
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : Math.round(c.price * c.coefficient) < c.catalogProduct.price
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                ≈ {formatCurrency(Math.round(c.price * c.coefficient))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {c.originalPrice != null && c.originalPrice > (c.price ?? 0) && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatCurrency(c.originalPrice)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                        {c.discountPercent != null && c.discountPercent > 0 ? (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 font-normal">
                            {formatNumber(c.discountPercent)}٪
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-center">
                        {c.coefficient != null ? (
                          <span className="font-mono text-sm">{formatNumber(c.coefficient)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {c.catalogProductId ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate max-w-32">{c.catalogProduct?.name ?? 'متصل'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            بدون اتصال
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => refreshOne(c)}
                            disabled={refreshingId === c.id}
                            title="بروزرسانی قیمت (اسکرپ مجدد)"
                          >
                            {refreshingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </Button>
                          {c.catalogProductId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setCompareTarget(c)}
                              title="مقایسه قیمت"
                            >
                              <TrendingUp className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setHistoryTarget(c)}
                            title="تاریخچه قیمت"
                          >
                            <History className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditing(c)}
                            title="ویرایش"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(c)}
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Import Excel Dialog */}
      <Dialog open={importDialog} onOpenChange={(o) => { if (!o) { setImportDialog(false); setImportFile(null); setImportResults(null); setSelectedIds(new Set()) } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              ورود رقبا از اکسل (اسکرپ خودکار)
            </DialogTitle>
            <DialogDescription>
              فایل شامل منبع و شناسه محصول را آپلود کنید. سیستم اطلاعات و قیمت را خودکار استخراج می‌کند.
            </DialogDescription>
          </DialogHeader>

          {!importResults ? (
            <>
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  onClick={() => document.getElementById('comp-excel-upload')?.click()}
                >
                  <input
                    id="comp-excel-upload"
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
                  <p className="font-medium text-foreground mb-1">ستون‌های اکسل (فقط اینها لازمه):</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>منبع — <strong className="text-foreground">الزامی</strong> (دیجی‌کالا / اسنپ‌شاپ / ترب)</span>
                    <span>شناسه — <strong className="text-foreground">الزامی</strong> (کد محصول در سایت)</span>
                    <span>ضریب (اختیاری)</span>
                    <span>محصول کاتالوگ (اختیاری — برای اتصال)</span>
                  </div>
                  <p className="mt-2">باقی اطلاعات (نام، قیمت، تصویر و...) از سایت اسکرپ می‌شوند.</p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 ml-1" />
                  دانلود تمپلت
                </Button>
                <div className="flex-1" />
                <Button variant="outline" onClick={() => setImportDialog(false)}>انصراف</Button>
                <Button onClick={handleImport} disabled={!importFile || importing}>
                  {importing && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
                  {importing ? 'در حال اسکرپ...' : 'شروع اسکرپ'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              {/* Results table */}
              <div className="flex items-center gap-3 mb-2">
                <p className="text-sm font-medium">
                  نتایج اسکرپ ({importResults.filter(r => r.scraped).length} موفق، {importResults.filter(r => !r.scraped).length} ناموفق)
                </p>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => {
                  const scraped = importResults.filter(r => r.scraped)
                  setSelectedIds(new Set(scraped.map(r => `${r.source}-${r.sourceId}`)))
                }}>
                  انتخاب همه موفق‌ها
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  لغو همه
                </Button>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 px-1">
                  {importResults.map((r) => {
                    const key = `${r.source}-${r.sourceId}`
                    const isSelected = selectedIds.has(key)
                    const sourceLabel = r.source === 'DIGIKALA' ? 'دیجی‌کالا' : r.source === 'SNAPPSHOP' ? 'اسنپ‌شاپ' : r.source === 'TOROB' ? 'ترب' : r.source

                    return (
                      <div
                        key={key}
                        className={`rounded-lg border p-3 transition-colors cursor-pointer ${
                          r.scraped
                            ? isSelected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border hover:border-border/80'
                            : 'border-destructive/30 bg-destructive/5 opacity-70'
                        }`}
                        onClick={() => r.scraped && setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox / Error icon */}
                          <div className="pt-0.5">
                            {r.scraped ? (
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                            ) : (
                              <XCircle className="w-5 h-5 text-destructive shrink-0" />
                            )}
                          </div>

                          {/* Image */}
                          <div className="shrink-0">
                            {r.scraped?.imageUrl ? (
                              <img src={r.scraped.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" loading="lazy" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                <ImageOff className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            {r.scraped ? (
                              <>
                                <p className="text-sm font-medium truncate">{r.scraped.name}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="font-normal text-[10px]">{sourceLabel}</Badge>
                                  <span className="font-mono" dir="ltr">{r.sourceId}</span>
                                  {r.scraped.brand && <span>• {r.scraped.brand}</span>}
                                  {r.coefficient != null && <span className="text-[var(--gold)]">ضریب: {r.coefficient}</span>}
                                  {r.existingId && <Badge variant="secondary" className="font-normal text-[10px]">وجود دارد — بروزرسانی</Badge>}
                                </div>
                                <div className="flex items-baseline gap-2 mt-1">
                                  <span className="font-mono text-sm font-semibold">{formatCurrency(r.scraped.price)}</span>
                                  {r.scraped.originalPrice != null && r.scraped.originalPrice > r.scraped.price && (
                                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(r.scraped.originalPrice)}</span>
                                  )}
                                  {r.scraped.discountPercent > 0 && (
                                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 font-normal text-[10px]">
                                      {formatNumber(r.scraped.discountPercent)}٪ تخفیف
                                    </Badge>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div>
                                <p className="text-sm font-medium">ردیف {r.rowNum} — <span className="font-mono text-xs" dir="ltr">{r.sourceId}</span></p>
                                <p className="text-xs text-destructive mt-1">{r.scrapeError ?? 'اسکرپ ناموفق'}</p>
                              </div>
                            )}

                            {r.catalogProductName && (
                              <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                {r.catalogProductName}
                                {!r.catalogProductId && ' (یافت نشد)'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <DialogFooter className="gap-2 pt-3 border-t mt-auto">
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedIds.size} آیتم انتخاب‌شده
                </span>
                <Button variant="outline" onClick={() => { setImportDialog(false); setImportResults(null); setSelectedIds(new Set()) }}>
                  انصراف
                </Button>
                <Button onClick={handleSaveImport} disabled={saving || selectedIds.size === 0}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
                  {saving ? 'در حال ذخیره...' : `ذخیره ${selectedIds.size} مورد`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Scrape dialog */}
      <ScrapeDialog
        open={scrapeOpen}
        onClose={() => setScrapeOpen(false)}
        onSaved={() => { setScrapeOpen(false); refetch() }}
        products={products}
      />

      {/* Edit sheet */}
      <Sheet open={Boolean(editing)} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              ویرایش محصول رقیب
            </SheetTitle>
            <SheetDescription>اطلاعات محصول رقیب را به‌روزرسانی کنید</SheetDescription>
          </SheetHeader>
          {editing && (
            <CompetitorEditForm
              key={editing.id}
              competitor={editing}
              products={products}
              onSaved={() => { setEditing(null); refetch() }}
              onCancel={() => setEditing(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محصول رقیب</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{deleteTarget?.name}» مطمئن هستید؟ تاریخچه قیمت نیز حذف خواهد شد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History */}
      <PriceHistoryDialog
        competitor={historyTarget}
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        onUpdated={refetch}
      />

      {/* Compare */}
      <PriceCompareDialog
        competitor={compareTarget}
        open={Boolean(compareTarget)}
        onClose={() => setCompareTarget(null)}
      />
    </div>
  )
}

interface HistoryProps {
  competitor: CompetitorProduct | null
  open: boolean
  onClose: () => void
  onUpdated: () => void
}

function PriceHistoryDialog({ competitor, open, onClose, onUpdated }: HistoryProps) {
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)
  const { data, loading, refetch } = useApi<{ items: any[] }>(
    competitor ? `/api/competitors/${competitor.id}/prices` : null,
    { enabled: Boolean(competitor) }
  )

  const history = useMemo(() => data?.items ?? [], [data])

  async function handleAdd() {
    if (!competitor || !newPrice) return
    setAdding(true)
    const res = await apiCall(`/api/competitors/${competitor.id}/prices`, {
      method: 'POST',
      body: JSON.stringify({ price: Number(newPrice) }),
    })
    setAdding(false)
    if (res.ok) {
      toast.success('قیمت جدید ثبت شد')
      setNewPrice('')
      refetch()
      onUpdated()
    } else toast.error(res.error ?? 'خطا')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            تاریخچه قیمت
          </DialogTitle>
          <DialogDescription className="truncate">
            {competitor?.name} — {competitor?.source}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            placeholder="قیمت جدید (ریال)"
            onKeyDown={(e) => { if (e.key === 'Enter' && newPrice) handleAdd() }}
          />
          <Button onClick={handleAdd} disabled={adding || !newPrice}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 ml-1" />}
            ثبت قیمت
          </Button>
        </div>

        <ScrollArea className="max-h-80 rounded-lg border border-border">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              هیچ تاریخچه قیمتی ثبت نشده
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>قیمت</TableHead>
                  <TableHead>قیمت اصلی</TableHead>
                  <TableHead className="text-center">تخفیف</TableHead>
                  <TableHead className="text-left">تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="font-mono">{formatCurrency(h.price)}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {h.originalPrice != null ? formatCurrency(h.originalPrice) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {h.discountPercent != null ? `${formatNumber(h.discountPercent)}٪` : '—'}
                    </TableCell>
                    <TableCell className="text-left text-xs text-muted-foreground">
                      {formatPersianDateTime(h.fetchedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

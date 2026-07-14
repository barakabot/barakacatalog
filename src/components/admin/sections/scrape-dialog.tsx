'use client'

import { useState, useMemo } from 'react'
import { apiCall } from '@/lib/use-api'
import { Product } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronsUpDown, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Loader2, Globe, Sparkles, Save, AlertCircle, ExternalLink, CheckCircle2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatNumber } from '@/lib/format'

type Source = 'DIGIKALA' | 'SNAPPSHOP' | 'TOROB'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  products: Product[]
}

interface ScrapeData {
  source: Source
  sourceId: string
  name: string
  imageUrl: string | null
  weight: string | null
  volume: string | null
  price: number
  originalPrice: number | null
  discountPercent: number
  brand: string | null
}

export function ScrapeDialog({ open, onClose, onSaved, products }: Props) {
  const [source, setSource] = useState<Source>('DIGIKALA')
  const [sourceId, setSourceId] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<ScrapeData | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [catalogProductId, setCatalogProductId] = useState<string>('__none__')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogPopoverOpen, setCatalogPopoverOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const filteredProducts = useMemo(() => {
    if (!catalogSearch.trim()) return products.slice(0, 100)
    const q = catalogSearch.trim().toLowerCase()
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q)
    ).slice(0, 50)
  }, [catalogSearch, products])

  const selectedProduct = catalogProductId !== '__none__'
    ? products.find((p) => p.id === catalogProductId)
    : null

  function reset() {
    setSourceId('')
    setPreview(null)
    setPreviewError(null)
    setCatalogProductId('__none__')
    setCatalogSearch('')
    setCatalogPopoverOpen(false)
  }

  async function handlePreview() {
    if (!sourceId.trim()) {
      toast.error('شناسه محصول را وارد کنید')
      return
    }
    setPreviewing(true)
    setPreview(null)
    setPreviewError(null)
    const res = await apiCall<{ data: ScrapeData }>(`/api/competitors/scrape-preview`, {
      method: 'POST',
      body: JSON.stringify({ source, sourceId: sourceId.trim() }),
    })
    setPreviewing(false)
    if (res.ok && res.data?.data) {
      setPreview(res.data.data)
      // Auto-suggest catalog link by name similarity
      const name = res.data.data.name
      if (name) {
        const match = products.find((p) =>
          p.name && name && (p.name.includes(name.slice(0, 12)) || name.includes(p.name.slice(0, 8)))
        )
        if (match) setCatalogProductId(match.id)
      }
    } else {
      setPreviewError(res.error ?? 'اسکرپ ناموفق بود')
    }
  }

  async function handleSave() {
    if (!preview) return
    setSaving(true)
    const res = await apiCall(`/api/competitors/scrape`, {
      method: 'POST',
      body: JSON.stringify({ source, sourceId: sourceId.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      const id = res.data?.id
      // Link to catalog if chosen
      if (id && catalogProductId !== '__none__') {
        await apiCall(`/api/competitors/${id}/link`, {
          method: 'PUT',
          body: JSON.stringify({ catalogProductId }),
        })
      }
      toast.success('محصول رقیب ذخیره شد')
      reset()
      onSaved()
    } else {
      toast.error(res.error ?? 'ذخیره ناموفق')
    }
  }

  function handleSaveAndAdd() {
    handleSave()
  }

  const sourceLabel = source === 'DIGIKALA' ? 'دیجی‌کالا' : source === 'TOROB' ? 'ترب' : 'اسنپ‌شاپ'
  const sourceUrlPattern = source === 'DIGIKALA'
    ? 'digikala.com/product/dkp-XXXXX'
    : source === 'TOROB'
    ? 'torob.com/p/XXXXX (prk)'
    : 'snappshop.com/product/XXX'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            اسکرپ محصول از سایت رقیب
          </DialogTitle>
          <DialogDescription>
            با وارد کردن شناسه محصول، اطلاعات و قیمت از {sourceLabel} استخراج می‌شود
          </DialogDescription>
        </DialogHeader>

        {/* Source + ID input */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2 sm:col-span-1">
              <Label>منبع</Label>
              <Select value={source} onValueChange={(v) => { setSource(v as Source); setPreview(null); setPreviewError(null) }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIGIKALA">دیجی‌کالا</SelectItem>
                  <SelectItem value="SNAPPSHOP">اسنپ‌شاپ</SelectItem>
                  <SelectItem value="TOROB">ترب</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="source-id">شناسه محصول</Label>
              <div className="flex gap-2">
                <Input
                  id="source-id"
                  value={sourceId}
                  onChange={(e) => { setSourceId(e.target.value); setPreview(null); setPreviewError(null) }}
                  placeholder="مثال: 11070303"
                  dir="ltr"
                  className="font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePreview() }}
                />
                <Button onClick={handlePreview} disabled={previewing || !sourceId.trim()}>
                  {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 ml-1" />}
                  استخراج
                </Button>
              </div>
              <p className="text-xs text-muted-foreground" dir="ltr">
                شناسه از URL محصول: {sourceUrlPattern}
              </p>
            </div>
          </div>

          {/* Preview result */}
          {previewError && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm text-destructive">اسکرپ ناموفق بود</p>
                <p className="text-xs text-muted-foreground mt-1">{previewError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  مطمئن شوید شناسه محصول درست است و سایت مقصد در دسترس است.
                </p>
              </div>
            </div>
          )}

          {preview && (
            <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="w-4 h-4" />
                اطلاعات استخراج‌شده
              </div>

              <div className="flex gap-4">
                {preview.imageUrl ? (
                  <img
                    src={preview.imageUrl}
                    alt={preview.name}
                    className="w-24 h-24 rounded-lg object-cover border border-border shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Globe className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="font-medium leading-snug">{preview.name || '(بدون نام)'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="font-normal">{sourceLabel}</Badge>
                    {preview.brand && <Badge variant="secondary" className="font-normal">{preview.brand}</Badge>}
                    {preview.weight && <Badge variant="secondary" className="font-normal">وزن: {preview.weight}</Badge>}
                    {preview.volume && <Badge variant="secondary" className="font-normal">حجم: {preview.volume}</Badge>}
                  </div>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="font-mono text-lg font-semibold">{formatCurrency(preview.price)}</span>
                    {preview.originalPrice != null && preview.originalPrice > preview.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatCurrency(preview.originalPrice)}
                      </span>
                    )}
                    {preview.discountPercent > 0 && (
                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 font-normal">
                        {formatNumber(preview.discountPercent)}٪ تخفیف
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Link to catalog — searchable combobox */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  اتصال به محصول کاتالوگ (اختیاری)
                </Label>
                <Popover open={catalogPopoverOpen} onOpenChange={setCatalogPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={catalogPopoverOpen}
                      className="w-full justify-between font-normal h-auto min-h-9"
                    >
                      {selectedProduct
                        ? <span className="truncate">{selectedProduct.name}{selectedProduct.price > 0 ? ` — ${formatCurrency(selectedProduct.price)}` : ''}</span>
                        : <span className="text-muted-foreground">— بدون اتصال —</span>
                      }
                      <ChevronsUpDown className="shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="جستجوی محصول..."
                        value={catalogSearch}
                        onValueChange={setCatalogSearch}
                      />
                      <CommandList className="max-h-64">
                        <CommandEmpty>محصولی یافت نشد</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setCatalogProductId('__none__')
                              setCatalogPopoverOpen(false)
                              setCatalogSearch('')
                            }}
                          >
                            <Check className={cn("ml-2 h-4 w-4", catalogProductId === '__none__' ? "opacity-100" : "opacity-0")} />
                            <span className="text-muted-foreground">بدون اتصال</span>
                          </CommandItem>
                          {filteredProducts.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setCatalogProductId(p.id)
                                setCatalogPopoverOpen(false)
                                setCatalogSearch('')
                              }}
                            >
                              <Check className={cn("ml-2 h-4 w-4", catalogProductId === p.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                <span className="truncate">{p.name}</span>
                                {p.price > 0 && (
                                  <span className="text-xs text-muted-foreground">{formatCurrency(p.price)}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  با اتصال به محصول کاتالوگ، مقایسه قیمت و تفاوت قابل محاسبه است
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={saving}>
            انصراف
          </Button>
          <Button onClick={handleSave} disabled={!preview || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
            ذخیره محصول رقیب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

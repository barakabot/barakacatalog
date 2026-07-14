'use client'

import { useState } from 'react'
import { CompetitorProduct, Product } from '@/lib/types'
import { apiCall } from '@/lib/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  competitor: CompetitorProduct
  products: Product[]
  onSaved: () => void
  onCancel: () => void
}

export function CompetitorEditForm({ competitor, products, onSaved, onCancel }: Props) {
  const [name, setName] = useState(competitor.name ?? '')
  const [brand, setBrand] = useState(competitor.brand ?? '')
  const [weight, setWeight] = useState(competitor.weight ?? '')
  const [volume, setVolume] = useState(competitor.volume ?? '')
  const [price, setPrice] = useState(competitor.price != null ? String(competitor.price) : '')
  const [originalPrice, setOriginalPrice] = useState(competitor.originalPrice != null ? String(competitor.originalPrice) : '')
  const [discountPercent, setDiscountPercent] = useState(competitor.discountPercent != null ? String(competitor.discountPercent) : '')
  const [coefficient, setCoefficient] = useState(competitor.coefficient != null ? String(competitor.coefficient) : '')
  const [imageUrl, setImageUrl] = useState(competitor.imageUrl ?? '')
  const [catalogProductId, setCatalogProductId] = useState<string>(competitor.catalogProductId ?? '__none__')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // Update basic fields via the Next.js route
    const payload = {
      name: name.trim(),
      brand: brand.trim() || null,
      weight: weight.trim() || null,
      volume: volume.trim() || null,
      price: price === '' ? null : Number(price),
      originalPrice: originalPrice === '' ? null : Number(originalPrice),
      discountPercent: discountPercent === '' ? null : Number(discountPercent),
      coefficient: coefficient === '' ? null : Number(coefficient),
      imageUrl: imageUrl.trim() || null,
    }
    const res = await apiCall(`/api/competitors/${competitor.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setSaving(false)
      toast.error(res.error ?? 'ذخیره ناموفق')
      return
    }
    // Link/unlink to catalog product
    const wantLink = catalogProductId !== '__none__'
    const wasLinked = Boolean(competitor.catalogProductId)
    if (wantLink && catalogProductId !== competitor.catalogProductId) {
      const linkRes = await apiCall(`/api/competitors/${competitor.id}/link`, {
        method: 'PUT',
        body: JSON.stringify({ catalogProductId }),
      })
      if (!linkRes.ok) toast.warning('ذخیره شد ولی اتصال به کاتالوگ ناموفق بود')
    } else if (!wantLink && wasLinked) {
      const unlinkRes = await apiCall(`/api/competitors/${competitor.id}/unlink`, {
        method: 'PUT',
      })
      if (!unlinkRes.ok) toast.warning('ذخیره شد ولی لغو اتصال ناموفق بود')
    }
    setSaving(false)
    toast.success('ذخیره شد')
    onSaved()
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="c-name">نام محصول</Label>
        <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="c-brand">برند</Label>
          <Input id="c-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-weight">وزن</Label>
          <Input id="c-weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-volume">حجم</Label>
          <Input id="c-volume" value={volume} onChange={(e) => setVolume(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label htmlFor="c-price">قیمت (ریال)</Label>
          <Input id="c-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-orig">قیمت اصلی</Label>
          <Input id="c-orig" type="number" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-disc">تخفیف (٪)</Label>
          <Input id="c-disc" type="number" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c-coeff">ضریب قیمت</Label>
          <Input id="c-coeff" type="number" step="any" value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="c-image">URL تصویر</Label>
        <Input id="c-image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} dir="ltr" />
        {imageUrl && (
          <img src={imageUrl} alt="preview" className="w-full h-24 object-cover rounded border border-border" referrerPolicy="no-referrer" />
        )}
      </div>

      <div className="space-y-2">
        <Label>محصول کاتالوگ مرتبط</Label>
        <Select value={catalogProductId} onValueChange={setCatalogProductId}>
          <SelectTrigger className="w-full"><SelectValue placeholder="— بدون ارتباط —" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— بدون ارتباط —</SelectItem>
            {products.slice(0, 200).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="truncate">{p.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-4 -mx-6 px-6 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
          ذخیره
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>انصراف</Button>
      </div>
    </div>
  )
}

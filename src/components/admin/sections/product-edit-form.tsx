'use client'

import { useState, useEffect, useRef } from 'react'
import { Product } from '@/lib/types'
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
import { Separator } from '@/components/ui/separator'
import { Loader2, Save, Upload, ImageOff, X } from 'lucide-react'
import { toast } from 'sonner'

interface GroupOption { id: string; label: string }

interface Props {
  product: Product | null
  groups: GroupOption[]
  onSaved: () => void
  onCancel: () => void
}

export function ProductEditForm({ product, groups, onSaved, onCancel }: Props) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState<string>(product?.price ? String(product.price) : '')
  const [groupId, setGroupId] = useState<string>(product?.groupId ?? '__none__')
  const [imageUrl, setImageUrl] = useState<string>(product?.imageUrl ?? '')
  const [promotionDescription, setPromotionDescription] = useState(product?.promotionDescription ?? '')
  const [competitiveAdvantage, setCompetitiveAdvantage] = useState(product?.competitiveAdvantage ?? '')
  const [targetMarket, setTargetMarket] = useState(product?.targetMarket ?? '')
  const [margin, setMargin] = useState<string>(product?.margin != null ? String(product.margin) : '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Reset form when product changes (handles re-edit of same product)
  useEffect(() => {
    setName(product?.name ?? '')
    setDescription(product?.description ?? '')
    setPrice(product?.price ? String(product.price) : '')
    setGroupId(product?.groupId ?? '__none__')
    setImageUrl(product?.imageUrl ?? '')
    setPromotionDescription(product?.promotionDescription ?? '')
    setCompetitiveAdvantage(product?.competitiveAdvantage ?? '')
    setTargetMarket(product?.targetMarket ?? '')
    setMargin(product?.margin != null ? String(product.margin) : '')
  }, [product])

  async function handleUpload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'خطا در آپلود')
      setImageUrl(json.url)
      toast.success('تصویر آپلود شد')
    } catch (e: any) {
      toast.error(e?.message ?? 'خطا در آپلود تصویر')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('نام محصول الزامی است')
      return
    }
    setSaving(true)

    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      price: price === '' ? 0 : Number(price),
      groupId: groupId === '__none__' ? null : groupId,
      imageUrl: imageUrl.trim() || null,
      promotionDescription: promotionDescription.trim() || null,
      competitiveAdvantage: competitiveAdvantage.trim() || null,
      targetMarket: targetMarket.trim() || null,
      margin: margin === '' ? null : Number(margin),
    }

    const url = product ? `/api/products/${product.id}` : '/api/products'
    const method = product ? 'PUT' : 'POST'
    const res = await apiCall(url, { method, body: JSON.stringify(payload) })
    setSaving(false)

    if (res.ok) {
      toast.success(product ? 'محصول به‌روزرسانی شد' : 'محصول ایجاد شد')
      onSaved()
    } else {
      toast.error(res.error ?? 'ذخیره ناموفق')
    }
  }

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Image */}
      <div className="space-y-2">
        <Label>تصویر محصول</Label>
        <div className="flex items-start gap-4">
          <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
            {imageUrl ? (
              <img src={imageUrl} alt="پیش‌نمایش" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <ImageOff className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              آپلود تصویر
            </Button>
            {imageUrl && (
              <div className="flex items-center gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="یا URL تصویر را وارد کنید"
                  className="text-xs h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setImageUrl('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              حداکثر ۵ مگابایت - JPG, PNG, WebP
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Basic */}
      <div className="space-y-2">
        <Label htmlFor="p-name">نام محصول *</Label>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: دوسرپیچ دارک پاکتی" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-desc">توضیحات</Label>
        <Textarea
          id="p-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="توضیحات محصول، کد کالا و..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="p-price">قیمت (ریال)</Label>
          <Input
            id="p-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
            min={0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-margin">حاشیه سود (٪)</Label>
          <Input
            id="p-margin"
            type="number"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            placeholder="مثال: 25"
            step="0.1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>گروه محصول</Label>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="انتخاب گروه" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— بدون گروه —</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Marketing */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">اطلاعات بازاریابی</p>
          <p className="text-xs text-muted-foreground">مزیت رقابتی، پروموشن و بازار هدف</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-promo">توضیحات پروموشن / تخفیف</Label>
          <Input
            id="p-promo"
            value={promotionDescription}
            onChange={(e) => setPromotionDescription(e.target.value)}
            placeholder="مثال: 5+1 یا 20٪ تخفیف"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-adv">مزیت رقابتی</Label>
          <Textarea
            id="p-adv"
            value={competitiveAdvantage}
            onChange={(e) => setCompetitiveAdvantage(e.target.value)}
            placeholder="مزیت رقابتی محصول نسبت به رقبا"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="p-market">بازار هدف</Label>
          <Input
            id="p-market"
            value={targetMarket}
            onChange={(e) => setTargetMarket(e.target.value)}
            placeholder="مثال: خانگی، صنعتی، کادویی"
          />
        </div>
      </div>

      {product && (
        <p className="text-xs text-muted-foreground">
          آخرین به‌روزرسانی: {new Date(product.updatedAt).toLocaleString('fa-IR')}
        </p>
      )}

      <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-4 -mx-6 px-6 border-t border-border pt-4">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
          {product ? 'ذخیره تغییرات' : 'ایجاد محصول'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          انصراف
        </Button>
      </div>
    </div>
  )
}

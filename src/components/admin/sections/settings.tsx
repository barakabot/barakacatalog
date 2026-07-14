'use client'

import { useState } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { Settings } from '@/lib/types'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings as SettingsIcon,
  Coins,
  Lock,
  Save,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/auth-store'

export function SettingsSection() {
  const { data, loading, refetch } = useApi<Settings>('/api/settings')
  const [currencyUnit, setCurrencyUnit] = useState('ریال')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  // Sync currencyUnit from server data once it loads (conditional setState during render)
  const [syncedId, setSyncedId] = useState<string | null>(null)
  if (data && syncedId !== data.id) {
    setSyncedId(data.id)
    setCurrencyUnit(data.currencyUnit)
  }

  async function saveCurrency() {
    if (!currencyUnit.trim()) { toast.error('واحد پول خالی است'); return }
    setSavingCurrency(true)
    const res = await apiCall('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ currencyUnit: currencyUnit.trim() }),
    })
    setSavingCurrency(false)
    if (res.ok) { toast.success('واحد پول ذخیره شد'); refetch() }
    else toast.error(res.error ?? 'خطا')
  }

  async function savePassword() {
    if (newPassword.length < 4) { toast.error('رمز عبور باید حداقل ۴ کاراکتر باشد'); return }
    if (newPassword !== confirmPassword) { toast.error('رمز عبور و تکرار آن یکسان نیستند'); return }
    setSavingPassword(true)
    const res = await apiCall('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ adminPassword: newPassword }),
    })
    setSavingPassword(false)
    if (res.ok) {
      toast.success('رمز عبور تغییر کرد')
      setNewPassword('')
      setConfirmPassword('')
      refetch()
    } else toast.error(res.error ?? 'خطا')
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-4xl animate-fade-in">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5 text-primary" />
            واحد پول
          </CardTitle>
          <CardDescription>واحد پول نمایش‌داده‌شده در کاتالوگ و گزارش‌ها</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="currency">واحد پول</Label>
            <div className="flex gap-2">
              <Input
                id="currency"
                value={currencyUnit}
                onChange={(e) => setCurrencyUnit(e.target.value)}
                placeholder="مثال: ریال، تومان"
                className="max-w-xs"
              />
              <Button onClick={saveCurrency} disabled={savingCurrency} variant="outline">
                {savingCurrency ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
                ذخیره
              </Button>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              این واحد در گزارش داشبورد و جدول محصولات برای نمایش قیمت‌ها به کار می‌رود.
              مقادیر قیمت در پایگاه داده همیشه به‌صورت عدد صحیح ذخیره می‌شوند.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-5 h-5 text-primary" />
            تغییر رمز عبور
          </CardTitle>
          <CardDescription>
            رمز عبور جدیدی برای ورود به پنل مدیریت تنظیم کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">وضعیت فعلی:</span>
            {data.hasPassword ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                رمز عبور تنظیم شده
              </Badge>
            ) : (
              <Badge variant="destructive">بدون رمز عبور</Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-pwd">رمز عبور جدید</Label>
            <div className="relative max-w-sm">
              <Input
                id="new-pwd"
                type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۴ کاراکتر"
                className="pl-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pwd">تکرار رمز عبور جدید</Label>
            <Input
              id="confirm-pwd"
              type={showPwd ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="تکرار رمز عبور"
              className="max-w-sm"
              autoComplete="new-password"
            />
          </div>

          <Button onClick={savePassword} disabled={savingPassword}>
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <KeyRound className="w-4 h-4 ml-1" />}
            تغییر رمز عبور
          </Button>
        </CardContent>
        <CardFooter className="bg-muted/30 px-6 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            پس از تغییر رمز، در نشست‌های بعدی باید از رمز جدید استفاده کنید.
          </p>
        </CardFooter>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="w-5 h-5 text-primary" />
            درباره سامانه
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">سامانه</span>
            <span className="font-medium">مدیریت کاتالوگ باراکا</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">پایگاه داده</span>
            <span className="font-mono text-xs">SQLite (custom.db)</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">واحد پول فعال</span>
            <span className="font-medium">{data.currencyUnit}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">شناسه تنظیمات</span>
            <span className="font-mono text-xs">{data.id}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">خروج از حساب</CardTitle>
          <CardDescription>نشست جاری را پایان دهید</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={async () => {
              await apiCall('/api/auth/logout', { method: 'POST' })
              logout()
              toast.success('از حساب خارج شدید')
            }}
          >
            خروج
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

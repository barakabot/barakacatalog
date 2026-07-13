'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Lock, Loader2, Cookie, Eye, EyeOff } from 'lucide-react'
import { apiCall } from '@/lib/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { toast } from 'sonner'

export function LoginScreen() {
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const setAuthed = useAuthStore((s) => s.setAuthed)

  // Focus on mount
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('login-pwd')?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) {
      toast.error('رمز عبور را وارد کنید')
      return
    }
    setLoading(true)
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      setAuthed(true)
      toast.success('ورود موفقیت‌آمیز بود')
    } else {
      toast.error(res.error ?? 'ورود ناموفق')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-stone-950 dark:via-stone-900 dark:to-amber-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 mb-4">
            <Cookie className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">سامانه مدیریت کاتالوگ</h1>
          <p className="text-muted-foreground mt-2">محصولات باراکا</p>
        </div>

        <Card className="shadow-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lock className="w-5 h-5 text-primary" />
              ورود به پنل مدیریت
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-pwd">رمز عبور</Label>
                <div className="relative">
                  <Input
                    id="login-pwd"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز عبور را وارد کنید"
                    className="pl-10"
                    autoComplete="current-password"
                    disabled={loading}
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    در حال ورود...
                  </>
                ) : (
                  'ورود'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                رمز پیش‌فرض: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">admin123</code>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

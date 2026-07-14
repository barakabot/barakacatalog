'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Lock, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { apiCall } from '@/lib/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { toast } from 'sonner'

export function LuxuryLogin() {
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const setAuthed = useAuthStore((s) => s.setAuthed)

  useEffect(() => {
    const t = setTimeout(() => document.getElementById('lux-pwd')?.focus(), 300)
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
    } else {
      toast.error(res.error ?? 'ورود ناموفق')
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[oklch(0.17_0.012_45)]">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/uploads/groups/hero.png)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.17_0.012_45/0.7)] via-[oklch(0.17_0.012_45/0.85)] to-[oklch(0.17_0.012_45/0.95)]" />
      <div className="absolute inset-0 grain" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in">
        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="inline-block mb-6">
            <div className="w-px h-12 bg-gradient-to-b from-transparent to-[var(--gold)] mx-auto mb-4 opacity-60" />
            <p className="text-[var(--gold)] text-xs tracking-[0.4em] uppercase font-light mb-2" dir="ltr">
              Since 1985
            </p>
          </div>
          <h1 className="font-display text-6xl text-cream mb-3 tracking-wide" style={{ color: 'oklch(0.95 0.02 80)' }}>
            BARAKA
          </h1>
          <p className="text-cream/70 text-sm tracking-widest" style={{ color: 'oklch(0.9 0.02 80 / 0.7)' }}>
            کاتالوگ محصولات
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="h-px w-12 bg-[var(--gold)]/40" />
            <span className="text-[var(--gold)] text-xs">✦</span>
            <span className="h-px w-12 bg-[var(--gold)]/40" />
          </div>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleSubmit}
          className="backdrop-blur-md bg-cream/8 border border-[var(--gold)]/20 rounded-sm p-8 shadow-2xl"
          style={{ backgroundColor: 'oklch(0.95 0.02 80 / 0.06)', borderColor: 'oklch(0.72 0.13 75 / 0.2)' }}
        >
          <div className="text-center mb-6">
            <Lock className="w-5 h-5 text-[var(--gold)] mx-auto mb-2" />
            <p className="text-cream/80 text-sm" style={{ color: 'oklch(0.9 0.02 80 / 0.8)' }}>
              برای ورود به کاتالوگ، رمز عبور را وارد نمایید
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lux-pwd" className="text-cream/70 text-xs tracking-wider" style={{ color: 'oklch(0.9 0.02 80 / 0.7)' }}>
                رمز عبور
              </Label>
              <div className="relative">
                <Input
                  id="lux-pwd"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-cream/5 border-[var(--gold)]/25 text-cream placeholder:text-cream/30 focus:border-[var(--gold)] rounded-sm h-12 pl-10"
                  style={{
                    backgroundColor: 'oklch(0.95 0.02 80 / 0.05)',
                    color: 'oklch(0.95 0.02 80)',
                  }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-[var(--gold)] p-1"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-[oklch(0.17_0.012_45)] font-medium tracking-wider rounded-sm border-0 group"
              style={{ backgroundColor: 'oklch(0.72 0.13 75)', color: 'oklch(0.17 0.012 45)' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  ورود به کاتالوگ
                  <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="text-center text-cream/40 text-xs mt-6 tracking-wider" style={{ color: 'oklch(0.9 0.02 80 / 0.4)' }}>
          تمامی حقوق محفوظ است · باراکا
        </p>
      </div>
    </div>
  )
}

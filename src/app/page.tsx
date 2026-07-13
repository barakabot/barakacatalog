'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { apiCall } from '@/lib/use-api'
import { LuxuryLogin } from '@/components/catalog/luxury-login'
import { CatalogApp } from '@/components/catalog/catalog-app'
import { Loader2, Cookie } from 'lucide-react'

export default function Home() {
  const [booting, setBooting] = useState(true)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuthed = useAuthStore((s) => s.setAuthed)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await apiCall<{ authenticated: boolean }>('/api/auth/session')
      if (cancelled) return
      if (res.ok && res.data?.authenticated) {
        setAuthed(true)
      } else {
        setAuthed(false)
      }
      setBooting(false)
    })()
    return () => { cancelled = true }
  }, [setAuthed])

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.17_0.012_45)]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="font-display text-5xl text-cream tracking-wide" style={{ color: 'oklch(0.92 0.02 80)' }}>
              BARAKA
            </div>
            <Loader2 className="w-4 h-4 animate-spin absolute -bottom-3 left-1/2 -translate-x-1/2 text-[var(--gold)]" />
          </div>
          <p className="text-cream/40 text-xs tracking-[0.4em] uppercase" style={{ color: 'oklch(0.9 0.02 80 / 0.4)' }} dir="ltr">
            Loading
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LuxuryLogin />
  }

  return <CatalogApp />
}

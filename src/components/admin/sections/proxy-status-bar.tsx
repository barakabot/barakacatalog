'use client'

import { useState, useEffect } from 'react'
import { apiCall } from '@/lib/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, Upload, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface ProxyStatus {
  total: number
  alive: number
  dead: number
}

interface Props {
  onOpenProxyPanel: () => void
}

export function ProxyStatusBar({ onOpenProxyPanel }: Props) {
  const [status, setStatus] = useState<ProxyStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStatus() {
      setLoading(true)
      const res = await apiCall<Array<{ status: string; isActive: boolean }>>('/api/proxies')
      if (res.ok && res.data) {
        const proxies = res.data
        setStatus({
          total: proxies.length,
          alive: proxies.filter(p => p.status === 'alive' && p.isActive).length,
          dead: proxies.filter(p => p.status === 'dead').length,
        })
      }
      setLoading(false)
    }
    fetchStatus()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/60">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">در حال بارگذاری وضعیت پروکسی...</span>
      </div>
    )
  }

  if (!status || status.total === 0) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">
          پروکسی‌ای وجود ندارد — اسکرپ بدون پروکسی انجام می‌شود
        </span>
        <Button onClick={onOpenProxyPanel} size="sm" variant="outline" className="h-7 text-xs gap-1 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/50">
          <Upload className="w-3 h-3" />
          آپلود پروکسی
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/60">
      <Shield className="w-4 h-4 text-primary shrink-0" />
      <div className="flex items-center gap-1.5 text-xs flex-1">
        <span className="text-muted-foreground">پروکسی:</span>
        {status.alive > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] px-1.5 py-0 gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" />
            {status.alive} سالم
          </Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1.5 py-0 gap-0.5">
            <XCircle className="w-2.5 h-2.5" />
            بدون سالم
          </Badge>
        )}
        {status.dead > 0 && (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 text-[10px] px-1.5 py-0 gap-0.5">
            {status.dead} نامعتبر
          </Badge>
        )}
        <span className="text-muted-foreground">({status.total} کل)</span>
      </div>
      <Button onClick={onOpenProxyPanel} size="sm" variant="ghost" className="h-7 text-xs gap-1">
        <Upload className="w-3 h-3" />
        مدیریت
      </Button>
    </div>
  )
}
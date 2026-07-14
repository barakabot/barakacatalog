'use client'

import { useState, useEffect, useRef } from 'react'
import { apiCall } from '@/lib/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Shield, Upload, Loader2, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { toast } from 'sonner'

interface ProxyStatus {
  total: number
  alive: number
  dead: number
}

interface Props {
  onOpenProxyPanel?: () => void
}

export function ProxyStatusBar({ onOpenProxyPanel }: Props) {
  const [status, setStatus] = useState<ProxyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function refreshStatus(proxies: Array<{ status: string; isActive: boolean }>) {
    setStatus({
      total: proxies.length,
      alive: proxies.filter(p => p.status === 'alive' && p.isActive).length,
      dead: proxies.filter(p => p.status === 'dead').length,
    })
  }

  async function loadAndRefresh() {
    const res = await apiCall<Array<{ status: string; isActive: boolean }>>('/api/proxies')
    if (res.ok && res.data) refreshStatus(res.data)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const res = await apiCall<Array<{ status: string; isActive: boolean }>>('/api/proxies')
      if (cancelled) return
      if (res.ok && res.data) refreshStatus(res.data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleUpload() {
    const file = selectedFile
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiCall<{ message: string; added: number; skipped: number }>('/api/proxies', {
      method: 'POST',
      body: fd,
    })
    setUploading(false)
    if (res.ok) {
      toast.success(res.data?.message ?? 'پروکسی‌ها اضافه شدند')
      if (fileRef.current) fileRef.current.value = ''
      setSelectedFile(null)
      await loadAndRefresh()
    } else {
      toast.error(res.error ?? 'خطا در آپلود')
    }
  }

  async function handleCheck() {
    setChecking(true)
    const res = await apiCall<{ alive: number; dead: number; message: string }>('/api/proxies/check', {
      method: 'POST',
    })
    setChecking(false)
    if (res.ok) {
      toast.success(res.data?.message ?? 'بررسی تمام شد')
      await loadAndRefresh()
    } else {
      toast.error(res.error ?? 'خطا در بررسی')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/60">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">در حال بارگذاری وضعیت پروکسی...</span>
      </div>
    )
  }

  const hasProxies = status && status.total > 0

  return (
    <div className="space-y-2">
      {/* Status + Upload row — always visible */}
      <div className="p-2.5 rounded-lg border bg-muted/30 border-border/60">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-medium">پروکسی</span>

          {hasProxies ? (
            <div className="flex items-center gap-1.5 text-xs flex-1">
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
          ) : (
            <span className="text-xs text-amber-700 dark:text-amber-300 flex-1">
              پروکسی‌ای وجود ندارد — اسکرپ بدون پروکسی انجام می‌شود
            </span>
          )}

          {hasProxies && (
            <Button onClick={handleCheck} disabled={checking} size="sm" variant="ghost" className="h-7 text-xs gap-1">
              {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
              بررسی سلامت
            </Button>
          )}
        </div>

        {/* Upload area — always visible */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:ml-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">
              فرمت: host:port یا host:port:user:pass — فایل .txt یا .csv
            </p>
          </div>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile} size="sm" className="h-8 text-xs gap-1 shrink-0">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            آپلود پروکسی
          </Button>
        </div>
      </div>
    </div>
  )
}
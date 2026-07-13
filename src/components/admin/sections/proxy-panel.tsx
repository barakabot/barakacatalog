'use client'

import { useState, useRef } from 'react'
import { apiCall } from '@/lib/use-api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Shield, Upload, Trash2, Activity, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatPersianDateTime } from '@/lib/format'

interface ProxyItem {
  id: string
  host: string
  port: number
  username: string | null
  status: string
  latency: number | null
  lastCheck: string | null
  isActive: boolean
  createdAt: string
}

interface CheckResult {
  id: string
  status: 'alive' | 'dead'
  latency: number
  ip?: string
  error?: string
}

export function ProxyPanel() {
  const [open, setOpen] = useState(false)
  const [proxies, setProxies] = useState<ProxyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadProxies() {
    setLoading(true)
    const res = await apiCall<ProxyItem[]>('/api/proxies')
    if (res.ok && res.data) {
      setProxies(res.data)
    }
    setLoading(false)
  }

  async function handleOpen() {
    setOpen(true)
    setCheckResults(null)
    await loadProxies()
  }

  async function handleUpload() {
    const file = selectedFile
    if (!file) {
      toast.error('فایلی انتخاب نشده')
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await apiCall<{ message: string; added: number; skipped: number; errors?: Array<{ line: number; message: string }> }>('/api/proxies', {
      method: 'POST',
      body: fd,
    })
    setUploading(false)
    if (res.ok) {
      toast.success(res.data?.message ?? 'پروکسی‌ها اضافه شدند')
      if (fileRef.current) fileRef.current.value = ''
      setSelectedFile(null)
      await loadProxies()
    } else {
      toast.error(res.error ?? 'خطا در آپلود')
    }
  }

  async function handleCheck() {
    setChecking(true)
    setCheckResults(null)
    const res = await apiCall<{ results: CheckResult[]; alive: number; dead: number; message: string }>('/api/proxies/check', {
      method: 'POST',
    })
    setChecking(false)
    if (res.ok && res.data) {
      setCheckResults(res.data.results)
      toast.success(res.data.message)
      await loadProxies()
    } else {
      toast.error(res.error ?? 'خطا در بررسی')
    }
  }

  async function handleDelete(id: string) {
    const res = await apiCall(`/api/proxies?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('پروکسی حذف شد')
      await loadProxies()
    }
  }

  async function handleDeleteAll() {
    const res = await apiCall('/api/proxies?all=true', { method: 'DELETE' })
    if (res.ok) {
      toast.success('همه پروکسی‌ها حذف شدند')
      await loadProxies()
      setCheckResults(null)
    }
  }

  const aliveCount = proxies.filter(p => p.status === 'alive').length
  const deadCount = proxies.filter(p => p.status === 'dead').length
  const unknownCount = proxies.filter(p => p.status === 'unknown').length

  function getStatusBadge(status: string) {
    switch (status) {
      case 'alive':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3 ml-1" />سالم</Badge>
      case 'dead':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300"><XCircle className="w-3 h-3 ml-1" />خارج از دسترس</Badge>
      default:
        return <Badge variant="secondary">نامشخص</Badge>
    }
  }

  return (
    <>
      {/* Trigger button — placed in parent toolbar */}
      <Button onClick={handleOpen} variant="outline" size="sm">
        <Shield className="w-4 h-4 ml-1" />
        {aliveCount > 0 && (
          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
            {aliveCount}
          </Badge>
        )}
        پروکسی‌ها
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) setCheckResults(null); setOpen(o) }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              مدیریت پروکسی‌ها
            </DialogTitle>
            <DialogDescription>
              آپلود لیست پروکسی و بررسی سلامت آن‌ها قبل از اسکرپ
            </DialogDescription>
          </DialogHeader>

          {/* Upload section */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:ml-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                فرمت‌های قابل قبول: <code dir="ltr" className="text-foreground">host:port</code>،{' '}
                <code dir="ltr" className="text-foreground">host:port:user:pass</code> یا URL کامل
              </p>
              {selectedFile && (
                <p className="text-xs text-emerald-600 mt-1" dir="ltr">{selectedFile.name}</p>
              )}
            </div>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile} size="sm">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Upload className="w-4 h-4 ml-1" />}
              آپلود
            </Button>
          </div>

          {/* Stats + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{proxies.length} کل</Badge>
              {aliveCount > 0 && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{aliveCount} سالم</Badge>}
              {deadCount > 0 && <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">{deadCount} خارج از دسترس</Badge>}
              {unknownCount > 0 && <Badge variant="secondary">{unknownCount} نامشخص</Badge>}
            </div>
            <div className="flex gap-2 mr-auto">
              <Button onClick={handleCheck} disabled={checking || proxies.length === 0} size="sm" variant="outline">
                {checking ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Activity className="w-4 h-4 ml-1" />}
                بررسی سلامت
              </Button>
              {proxies.length > 0 && (
                <Button onClick={handleDeleteAll} size="sm" variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 ml-1" />
                  حذف همه
                </Button>
              )}
            </div>
          </div>

          {/* Proxy table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : proxies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">هنوز پروکسی‌ای اضافه نشده</p>
                <p className="text-xs mt-1">فایل متنی پروکسی‌ها را آپلود کنید</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">آدرس</TableHead>
                    <TableHead className="text-xs text-center">وضعیت</TableHead>
                    <TableHead className="text-xs text-center">تأخیر</TableHead>
                    <TableHead className="text-xs text-center">آخرین بررسی</TableHead>
                    <TableHead className="text-xs text-center w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proxies.map((p) => {
                    const checkResult = checkResults?.find(r => r.id === p.id)
                    return (
                      <TableRow key={p.id} className={checkResult ? (checkResult.status === 'alive' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-rose-50/50 dark:bg-rose-950/20') : ''}>
                        <TableCell className="font-mono text-xs" dir="ltr">
                          {p.username ? `${p.username}:****@` : ''}{p.host}:{p.port}
                          {checkResult?.ip && (
                            <span className="block text-muted-foreground text-[10px]">IP: {checkResult.ip}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(checkResult?.status ?? p.status)}
                          {checkResult?.error && (
                            <p className="text-[10px] text-destructive mt-0.5" dir="ltr">{checkResult.error}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {checkResult?.latency != null ? `${checkResult.latency}ms` : (p.latency ? `${p.latency}ms` : '—')}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {p.lastCheck ? formatPersianDateTime(new Date(p.lastCheck)) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button onClick={() => handleDelete(p.id)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

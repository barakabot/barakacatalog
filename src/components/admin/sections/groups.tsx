'use client'

import { useState } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { ProductGroup } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  FolderTree,
  FolderPlus,
  Pencil,
  Trash2,
  ChevronLeft,
  Package,
  Loader2,
  Network,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatNumber } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface GroupNode extends ProductGroup {
  children: GroupNode[]
  _count?: { products: number; children: number }
}

export function GroupsSection() {
  const { data, loading, refetch } = useApi<{ items: ProductGroup[]; tree: GroupNode[] }>('/api/groups')
  const [editing, setEditing] = useState<ProductGroup | null>(null)
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductGroup | null>(null)
  const [deleting, setDeleting] = useState(false)

  const tree = data?.tree ?? []
  const flat = data?.items ?? []

  function handleCreated() {
    setCreating(null)
    setEditing(null)
    refetch()
    toast.success('ذخیره شد')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await apiCall(`/api/groups/${deleteTarget.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('گروه حذف شد')
      setDeleteTarget(null)
      refetch()
    } else {
      toast.error(res.error ?? 'حذف ناموفق')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderTree className="w-5 h-5 text-primary" />
                گروه‌بندی محصولات
              </CardTitle>
              <CardDescription className="mt-1">
                مدیریت گروه‌ها و زیرگروه‌های کاتالوگ ({formatNumber(flat.length)} گروه)
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreating({ parentId: null })}>
              <FolderPlus className="w-4 h-4 ml-1" />
              گروه اصلی جدید
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="p-4 rounded-2xl bg-muted">
                <Network className="w-10 h-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-medium">هنوز گروهی تعریف نشده</p>
                <p className="text-sm text-muted-foreground mt-1">برای شروع یک گروه اصلی بسازید</p>
              </div>
              <Button onClick={() => setCreating({ parentId: null })} size="sm">
                <FolderPlus className="w-4 h-4 ml-1" /> ساخت گروه
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-18rem)]">
              <div className="p-4 space-y-1.5">
                {tree.map((node) => (
                  <GroupNodeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    onEdit={(g) => setEditing(g)}
                    onDelete={(g) => setDeleteTarget(g)}
                    onAddChild={(parentId) => setCreating({ parentId })}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <GroupEditDialog
        key={editing?.id ?? (creating ? `new-${creating.parentId ?? 'root'}` : 'closed')}
        open={Boolean(creating || editing)}
        group={editing}
        allGroups={flat}
        initialParentId={creating?.parentId ?? null}
        onClose={() => { setCreating(null); setEditing(null) }}
        onSaved={handleCreated}
      />

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف گروه</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف گروه «{deleteTarget?.name}» مطمئن هستید؟
              {'\n'}
              توجه: در صورت وجود محصول یا زیرگروه، حذف مجاز نخواهد بود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface RowProps {
  node: GroupNode
  depth: number
  onEdit: (g: ProductGroup) => void
  onDelete: (g: ProductGroup) => void
  onAddChild: (parentId: string) => void
}

function GroupNodeRow({ node, depth, onEdit, onDelete, onAddChild }: RowProps) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (node.children?.length ?? 0) > 0
  const productCount = node._count?.products ?? 0

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/50 group transition-colors',
          depth > 0 && 'bg-muted/20'
        )}
        style={{ paddingRight: `${12 + depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            <ChevronLeft className={cn('w-4 h-4 transition-transform', expanded && '-rotate-90')} />
          </button>
        ) : (
          <span className="w-5" />
        )}

        <FolderTree className="w-4 h-4 text-primary shrink-0" />

        <span className="font-medium flex-1 truncate">{node.name}</span>

        {productCount > 0 && (
          <Badge variant="secondary" className="font-normal">
            <Package className="w-3 h-3 ml-1" />
            {formatNumber(productCount)}
          </Badge>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onAddChild(node.id)}
            title="افزودن زیرگروه"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(node)}
            title="ویرایش"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node)}
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <GroupNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </>
  )
}

interface DialogProps {
  open: boolean
  group: ProductGroup | null
  allGroups: ProductGroup[]
  initialParentId: string | null
  onClose: () => void
  onSaved: () => void
}

function GroupEditDialog({ open, group, allGroups, initialParentId, onClose, onSaved }: DialogProps) {
  const [name, setName] = useState(group?.name ?? '')
  const [parentId, setParentId] = useState<string>(group?.parentId ?? initialParentId ?? '__none__')
  const [order, setOrder] = useState<string>(String(group?.order ?? 0))
  const [imageUrl, setImageUrl] = useState<string>(group?.imageUrl ?? '')
  const [description, setDescription] = useState<string>(group?.description ?? '')
  const [saving, setSaving] = useState(false)

  // Filter out self and descendants if editing (avoid cycle)
  const availableParents = (() => {
    if (!group) return allGroups
    const descendants = new Set<string>([group.id])
    let changed = true
    while (changed) {
      changed = false
      for (const g of allGroups) {
        if (g.parentId && descendants.has(g.parentId) && !descendants.has(g.id)) {
          descendants.add(g.id)
          changed = true
        }
      }
    }
    return allGroups.filter((g) => !descendants.has(g.id))
  })()

  async function handleSave() {
    if (!name.trim()) {
      toast.error('نام گروه الزامی است')
      return
    }
    setSaving(true)
    const payload = {
      name: name.trim(),
      parentId: parentId === '__none__' ? null : parentId,
      order: Number(order) || 0,
      imageUrl: imageUrl.trim() || null,
      description: description.trim() || null,
    }
    const url = group ? `/api/groups/${group.id}` : '/api/groups'
    const method = group ? 'PUT' : 'POST'
    const res = await apiCall(url, { method, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) {
      onSaved()
    } else {
      toast.error(res.error ?? 'ذخیره ناموفق')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-primary" />
            {group ? 'ویرایش گروه' : 'گروه جدید'}
          </DialogTitle>
          <DialogDescription>
            {group ? `ویرایش گروه «${group.name}»` : 'ایجاد گروه یا زیرگروه جدید'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="g-name">نام گروه *</Label>
            <Input
              id="g-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: شکلات، بیسکویت، کادویی"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>گروه والد</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— گروه اصلی —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— گروه اصلی (بدون والد) —</SelectItem>
                {availableParents.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-order">ترتیب نمایش</Label>
            <Input
              id="g-order"
              type="number"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">عدد کمتر = نمایش زودتر</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-image">URL تصویر کاور</Label>
            <Input
              id="g-image"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/uploads/groups/... یا https://..."
              dir="ltr"
            />
            {imageUrl && (
              <img src={imageUrl} alt="preview" className="w-full h-24 object-cover rounded border border-border" referrerPolicy="no-referrer" />
            )}
            <p className="text-xs text-muted-foreground">تصویر کاور گروه در کاتالوگ</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="g-desc">توضیحات</Label>
            <Textarea
              id="g-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیح کوتاه درباره این مجموعه"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { Product, ProductGroup, Settings } from '@/lib/types'
import { CatalogHome } from './catalog-home'
import { GroupView } from './group-view'
import { ProductDetail } from './product-detail'
import { useAuthStore } from '@/lib/auth-store'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, ChevronLeft, Settings as SettingsIcon, Moon, Sun, Loader2, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { AppShell as AdminShell } from '@/components/admin/app-shell'

interface Crumb {
  id: string
  name: string
}

export function CatalogApp() {
  const [view, setView] = useState<'catalog' | 'admin'>('catalog')
  // Catalog navigation state
  const [crumbs, setCrumbs] = useState<Crumb[]>([]) // breadcrumb of groups
  const [activeProduct, setActiveProduct] = useState<Product | null>(null)
  const [mounted, setMounted] = useState(false)

  const { theme, setTheme } = useTheme()
  const logout = useAuthStore((s) => s.logout)
  const [loggingOut, setLoggingOut] = useState(false)

  // Data
  const { data: groupsData, loading: groupsLoading } = useApi<{ items: ProductGroup[]; tree: ProductGroup[] }>('/api/groups')
  const { data: settings } = useApi<Settings>('/api/settings')
  const currencyUnit = settings?.currencyUnit ?? 'ریال'

  const tree = groupsData?.tree ?? []
  const flat = groupsData?.items ?? []

  // Current group based on crumbs
  const currentGroup = crumbs.length > 0 ? flat.find((g) => g.id === crumbs[crumbs.length - 1].id) ?? null : null
  const currentGroupId = crumbs.length > 0 ? crumbs[crumbs.length - 1].id : null

  // Products for current group (direct only — descendants show when navigating into subgroups)
  const productsUrl = currentGroupId ? `/api/products?groupId=${currentGroupId}&direct=true&limit=0` : null
  const { data: productsData } = useApi<{ items: Product[]; total: number }>(productsUrl)
  const products = productsData?.items ?? []

  // Children of current group (derived from flat list since flat items don't nest children)
  const subgroups = useMemo(() => {
    if (!currentGroupId) return []
    return flat
      .filter((g) => g.parentId === currentGroupId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [flat, currentGroupId])

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const openGroup = useCallback((g: ProductGroup) => {
    setCrumbs((prev) => {
      // If clicking a group already in crumbs, truncate to it
      const idx = prev.findIndex((c) => c.id === g.id)
      if (idx >= 0) return prev.slice(0, idx + 1)
      return [...prev, { id: g.id, name: g.name }]
    })
    setActiveProduct(null)
    // Scroll to top
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const goHome = useCallback(() => {
    setCrumbs([])
    setActiveProduct(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openProduct = useCallback((p: Product) => {
    setActiveProduct(p)
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await apiCall('/api/auth/logout', { method: 'POST' })
    setLoggingOut(false)
    logout()
    toast.success('از حساب خارج شدید')
  }

  // Admin mode
  if (view === 'admin') {
    return <AdminShell onExit={() => setView('catalog')} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav — minimal, elegant */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between gap-4">
          {/* Right: brand (RTL) */}
          <button onClick={goHome} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-[oklch(0.32_0.035_45)] flex items-center justify-center text-cream font-display text-base" style={{ backgroundColor: 'oklch(0.32 0.035 45)', color: 'oklch(0.96 0.015 80)' }}>
              B
            </div>
            <div className="hidden sm:block">
              <div className="font-display text-lg leading-none text-foreground">BARAKA</div>
              <div className="text-[10px] text-muted-foreground tracking-widest mt-0.5">کاتالوگ</div>
            </div>
          </button>

          {/* Center: breadcrumb (only when inside a group) */}
          {crumbs.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 text-sm flex-1 justify-center max-w-2xl">
              <button
                onClick={goHome}
                className="flex items-center gap-1 px-2 py-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span className="text-xs">خانه</span>
              </button>
              {crumbs.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1">
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/50" />
                  <button
                    onClick={() => openGroup({ id: c.id, name: c.name } as ProductGroup)}
                    className={`px-2 py-1 rounded transition-colors text-xs ${
                      i === crumbs.length - 1
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {c.name}
                  </button>
                </div>
              ))}
            </nav>
          )}

          {/* Left: actions */}
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="تغییر تم"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setView('admin')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-[var(--gold)] hover:bg-muted transition-colors"
              title="پنل مدیریت"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title="خروج"
            >
              {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile breadcrumb */}
        {crumbs.length > 0 && (
          <nav className="md:hidden flex items-center gap-1 px-4 pb-2 text-xs overflow-x-auto scrollbar-thin">
            <button onClick={goHome} className="flex items-center gap-1 text-muted-foreground shrink-0">
              <Home className="w-3 h-3" />
              <span>خانه</span>
            </button>
            {crumbs.map((c, i) => (
              <div key={c.id} className="flex items-center gap-1 shrink-0">
                <ChevronLeft className="w-3 h-3 text-muted-foreground/50" />
                <button
                  onClick={() => openGroup({ id: c.id, name: c.name } as ProductGroup)}
                  className={i === crumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'}
                >
                  {c.name}
                </button>
              </div>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentGroupId ?? 'home'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {groupsLoading ? (
              <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentGroup ? (
              <GroupView
                group={currentGroup}
                subgroups={subgroups}
                products={products}
                currencyUnit={currencyUnit}
                onOpenGroup={openGroup}
                onOpenProduct={openProduct}
              />
            ) : (
              <CatalogHome groups={tree} onOpenGroup={openGroup} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Product detail overlay */}
      <ProductDetail product={activeProduct} currencyUnit={currencyUnit} onClose={() => setActiveProduct(null)} />
    </div>
  )
}

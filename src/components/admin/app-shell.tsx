'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { apiCall } from '@/lib/use-api'
import { LoginScreen } from './login-screen'
import { DashboardSection } from './sections/dashboard'
import { ProductsSection } from './sections/products'
import { GroupsSection } from './sections/groups'
import { CompetitorsSection } from './sections/competitors'
import { SettingsSection } from './sections/settings'
import { SectionKey } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Trophy,
  Settings as SettingsIcon,
  Cookie,
  Moon,
  Sun,
  LogOut,
  Loader2,
  Menu,
  X,
  LayoutGrid,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const NAV: Array<{ key: SectionKey; label: string; icon: any; desc: string }> = [
  { key: 'dashboard', label: 'داشبورد', icon: LayoutDashboard, desc: 'نمای کلی' },
  { key: 'products', label: 'محصولات', icon: Package, desc: 'مدیریت کاتالوگ' },
  { key: 'groups', label: 'گروه‌ها', icon: FolderTree, desc: 'دسته‌بندی' },
  { key: 'competitors', label: 'رقبا', icon: Trophy, desc: 'رصد قیمت' },
  { key: 'settings', label: 'تنظیمات', icon: SettingsIcon, desc: 'پیکربندی' },
]

export function AppShell({ onExit }: { onExit?: () => void }) {
  const [active, setActive] = useState<SectionKey>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const logout = useAuthStore((s) => s.logout)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    // mark mounted on next tick to avoid synchronous setState
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    await apiCall('/api/auth/logout', { method: 'POST' })
    setLoggingOut(false)
    logout()
    toast.success('از حساب خارج شدید')
  }

  const current = NAV.find((n) => n.key === active)!

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar (mobile-friendly) */}
      <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Cookie className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold leading-tight">باراکا · کاتالوگ</div>
              <div className="text-xs text-muted-foreground leading-tight">{current.label}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onExit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExit}
              className="hidden sm:flex"
              title="بازگشت به کاتالوگ"
            >
              <LayoutGrid className="w-4 h-4 ml-1" />
              کاتالوگ
            </Button>
          )}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="تغییر تم"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive hover:text-destructive"
            onClick={handleLogout}
            disabled={loggingOut}
            title="خروج"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* Sidebar (right side for RTL) */}
        <aside
          className={cn(
            'w-64 shrink-0 border-l border-border bg-sidebar/50 backdrop-blur',
            'fixed lg:sticky top-14 right-0 bottom-0 z-20 lg:z-0',
            'transition-transform duration-200',
            sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          )}
        >
          <nav className="p-3 space-y-1">
            {NAV.map((item) => (
              <button
                key={item.key}
                onClick={() => { setActive(item.key); setSidebarOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-right',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  active === item.key
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
                    : 'text-sidebar-foreground/80'
                )}
              >
                <item.icon className={cn('w-4 h-4 shrink-0', active === item.key && 'text-primary')} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                </div>
                {active === item.key && (
                  <Badge variant="secondary" className="h-1.5 w-1.5 rounded-full p-0 bg-primary" />
                )}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-4 right-3 left-3 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">سامانه مدیریت کاتالوگ</p>
            <p>نسخه ۱.۰ · باراکا</p>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 bg-black/30 z-10 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <div className="mb-4">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight flex items-center gap-2">
              <current.icon className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
              {current.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{current.desc}</p>
          </div>
          {active === 'dashboard' && <DashboardSection />}
          {active === 'products' && <ProductsSection />}
          {active === 'groups' && <GroupsSection />}
          {active === 'competitors' && <CompetitorsSection />}
          {active === 'settings' && <SettingsSection />}
        </main>
      </div>
    </div>
  )
}

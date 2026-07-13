'use client'

import { useApi } from '@/lib/use-api'
import { DashboardStats } from '@/lib/types'
import { formatNumber, formatCurrency } from '@/lib/format'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Package,
  FolderTree,
  Trophy,
  Tag,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Target,
  Sparkles,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const PIE_COLORS = ['#d97706', '#b45309', '#92400e', '#78350f', '#a16207', '#ca8a04', '#e0b35e']

export function DashboardSection() {
  const { data, loading } = useApi<DashboardStats>('/api/dashboard/stats')

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  const priceCoverage = data.totalProducts > 0
    ? Math.round((data.productsWithPrice / data.totalProducts) * 100)
    : 0
  const marginCoverage = data.totalProducts > 0
    ? Math.round((data.withMargin / data.totalProducts) * 100)
    : 0

  const pieData = [
    { name: 'با قیمت', value: data.productsWithPrice },
    { name: 'بدون قیمت', value: data.productsWithoutPrice },
  ]

  const barData = data.groupHierarchy
    .map((g) => ({ name: g.name, تعداد: g.total }))
    .sort((a, b) => b['تعداد'] - a['تعداد'])

  const kpis = [
    {
      label: 'کل محصولات',
      value: formatNumber(data.totalProducts),
      icon: Package,
      hint: `${data.productsWithPrice} دارای قیمت`,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'گروه‌های محصول',
      value: formatNumber(data.totalGroups),
      icon: FolderTree,
      hint: `${data.groupHierarchy.length} گروه اصلی`,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      label: 'محصولات رقیب',
      value: formatNumber(data.totalCompetitors),
      icon: Trophy,
      hint: 'در حال رصد قیمت',
      color: 'text-yellow-700',
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    },
    {
      label: 'محصولات تخفیف‌دار',
      value: formatNumber(data.promotionCount),
      icon: Tag,
      hint: 'با توضیحات پروموشن',
      color: 'text-rose-600',
      bg: 'bg-rose-50 dark:bg-rose-950/30',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm text-muted-foreground">{k.label}</p>
                  <p className="text-3xl font-bold tracking-tight">{k.value}</p>
                  <p className="text-xs text-muted-foreground truncate">{k.hint}</p>
                </div>
                <div className={`shrink-0 p-2.5 rounded-xl ${k.bg}`}>
                  <k.icon className={`w-6 h-6 ${k.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">توزیع محصولات در گروه‌ها</CardTitle>
            <CardDescription>تعداد محصولات هر گروه اصلی</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontFamily: 'var(--font-vazirmatn)' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--accent)' }}
                    contentStyle={{
                      fontFamily: 'var(--font-vazirmatn)',
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Bar dataKey="تعداد" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">پوشش قیمت‌گذاری</CardTitle>
            <CardDescription>محصولات دارای قیمت</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      fontFamily: 'var(--font-vazirmatn)',
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontFamily: 'var(--font-vazirmatn)', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage & data-quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> پوشش قیمت
              </span>
              <span className="text-sm font-semibold">{priceCoverage}٪</span>
            </div>
            <Progress value={priceCoverage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.productsWithPrice)} از {formatNumber(data.totalProducts)} محصول
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4" /> حاشیه سود
              </span>
              <span className="text-sm font-semibold">{marginCoverage}٪</span>
            </div>
            <Progress value={marginCoverage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatNumber(data.withMargin)} محصول با حاشیه ثبت‌شده
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> مزیت رقابتی
              </span>
              <span className="text-sm font-semibold">{formatNumber(data.withAdvantage)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {data.withAdvantage > 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="text-muted-foreground">
                {data.withAdvantage > 0 ? 'ثبت‌شده' : 'هیچ مزیت رقابتی ثبت نشده'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4" /> بازار هدف
              </span>
              <span className="text-sm font-semibold">{formatNumber(data.withTargetMarket)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {data.withTargetMarket > 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span className="text-muted-foreground">
                {data.withTargetMarket > 0 ? 'ثبت‌شده' : 'بازار هدف تعریف نشده'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price stats */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">آمار قیمت‌گذاری</CardTitle>
          <CardDescription>خلاصه‌ای از قیمت محصولات (ریال)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">میانگین قیمت</p>
              <p className="text-lg font-semibold">{formatCurrency(data.price.avg)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">کمینه قیمت</p>
              <p className="text-lg font-semibold">{formatCurrency(data.price.min)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">بیشینه قیمت</p>
              <p className="text-lg font-semibold">{formatCurrency(data.price.max)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">مجموع قیمت‌ها</p>
              <p className="text-lg font-semibold">{formatCurrency(data.price.sum)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Group hierarchy breakdown */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">تفکیک گروه‌ها</CardTitle>
          <CardDescription>تعداد محصولات هر گروه و زیرگروه‌ها</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.groupHierarchy.map((g) => (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderTree className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-medium truncate">{g.name}</span>
                    {g.children.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {g.children.length} زیرگروه
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {formatNumber(g.total)} محصول
                  </Badge>
                </div>
                {g.children.length > 0 && (
                  <div className="flex flex-wrap gap-2 pr-6">
                    {g.children.map((c) => (
                      <Badge key={c.id} variant="secondary" className="text-xs font-normal">
                        {c.name}: {formatNumber(c.count)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

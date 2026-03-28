import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Cpu, HardDrive, LayoutGrid, MemoryStick, Monitor, Users, ArrowUp, ArrowDown, Server } from 'lucide-react'
import { systemApi, vmApi, formatBytes, formatUptime } from '../lib/api'
import { useStore } from '../store/useStore'
import { clsx } from 'clsx'

// ─── Sparkline chart ──────────────────────────────────────────────────────────

const HISTORY = 60

interface HistoryPoint { cpu: number; mem: number; disk: number }

function SparkArea({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded" />
  const w = 200, h = 48
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - (Math.min(100, Math.max(0, v)) / 100) * (h - 4),
  ])
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function CircularProgress({ size = 100, strokeWidth = 8, percentage, color }: { size?: number, strokeWidth?: number, percentage: number, color: string }) {
  const radius = (size - strokeWidth) / 2
  const circ = radius * 2 * Math.PI
  const offset = circ - (percentage / 100) * circ

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-100 dark:text-slate-800/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[16px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, percent, color = 'blue', history }: {
  label: string; value: string; sub?: string; icon: any
  percent?: number; color?: string; history?: number[]
}) {
  const colors: Record<string, { icon: string; bar: string; spark: string }> = {
    blue:   { icon: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',       bar: 'bg-blue-500',    spark: '#3b82f6' },
    purple: { icon: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400', bar: 'bg-violet-500', spark: '#8b5cf6' },
    amber:  { icon: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',    bar: 'bg-amber-500',   spark: '#f59e0b' },
    green:  { icon: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400', bar: 'bg-emerald-500', spark: '#10b981' },
  }
  const c = colors[color] || colors.blue
  const pct = percent !== undefined ? Math.min(100, Math.max(0, percent)) : null
  const hasHistory = history && history.length > 1

  return (
    <div className={clsx(
      "card p-6 flex min-h-[180px]",
      hasHistory ? "flex-col gap-3" : pct !== null ? "items-center justify-between gap-6" : "flex-col gap-6",
    )}>
      <div className="flex flex-col gap-4 min-w-0 flex-1">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
          <div className="min-h-[1.25rem]">
            {sub && <p className="text-sm text-slate-400 dark:text-slate-600 truncate">{sub}</p>}
          </div>
        </div>
      </div>

      {pct !== null && !hasHistory && (
        <CircularProgress size={100} strokeWidth={8} percentage={pct} color={c.spark} />
      )}

      {hasHistory && (
        <div className="w-full mt-auto">
          <SparkArea data={history} color={c.spark} />
        </div>
      )}
    </div>
  )
}

// ─── Users table ──────────────────────────────────────────────────────────────

function UsersTable({ data }: { data: { id: number; username: string; vm_count: number; running_vms: number; disk_usage_bytes: number; max_vms: number; max_storage_gb: number }[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">User Resource Usage</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {['User', 'VMs', 'Running', 'Disk Usage', 'Storage Limit'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...data].sort((a, b) => a.username.localeCompare(b.username)).map(u => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{u.username}</td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{u.vm_count} / {u.max_vms}</td>
                <td className="px-5 py-3">
                  {u.running_vms > 0
                    ? <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><span className="status-running" />{u.running_vms}</span>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-5 py-3 text-slate-600 dark:text-slate-400 tabular-nums">{formatBytes(u.disk_usage_bytes)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="progress-bar flex-1 max-w-[80px]">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (u.disk_usage_bytes / (u.max_storage_gb * 1073741824)) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">{u.max_storage_gb} GB</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">No users found</div>}
      </div>
    </div>
  )
}

// ─── VM Shared Badge ────────────────────────────────────────────────────────
function VMSharedBadge({ isSharedWithMe, ownerName, sharedCount, showLabel = false }: { isSharedWithMe: boolean, ownerName?: string, sharedCount: number, showLabel?: boolean }) {
  if (!isSharedWithMe && sharedCount === 0) return null;

  const tooltip = isSharedWithMe
    ? `Shared from ${ownerName || 'another user'}`
    : `Shared with ${sharedCount} user${sharedCount !== 1 ? 's' : ''}`;

  return (
    <span
      className="flex-shrink-0 flex items-center gap-1 text-xs text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-[#4d1d3d] h-[22px] px-1.5 py-0.5 rounded border border-pink-200 dark:border-pink-800/50"
      title={tooltip}
    >
      <span className="flex items-center">
        <Users className="w-3 h-3" />
        {isSharedWithMe
          ? <ArrowDown className="w-3 h-3" />
          : <ArrowUp className="w-3 h-3" />
        }
      </span>
      {showLabel && 'Shared'}
    </span>
  );
}

// ─── VM Details table ────────────────────────────────────────────────────────
function VMDetailsTable({ vms, currentUser }: { vms: any[], currentUser: any }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">VM Summary</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">VM Name</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center w-24">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Machine</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">CPU</th>
              <th className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">RAM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {vms.map(vm => {
              const effectiveSharedIds = vm.shared_with_user_ids || [];
              const isSharedWithMe = currentUser && effectiveSharedIds.includes(currentUser.id);
              const sharedCount = effectiveSharedIds.length || 0;

              return (
                <tr key={vm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    {vm.name}
                    <VMSharedBadge isSharedWithMe={isSharedWithMe} ownerName={vm.owner_username} sharedCount={sharedCount} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={clsx(
                        'mx-auto',
                        vm.status === 'running' ? 'status-running' :
                        vm.status === 'paused' ? 'status-paused' :
                        vm.status === 'starting' ? 'status-vm-starting' :
                        vm.status === 'error' ? 'status-error' :
                        'status-stopped'
                      )}
                    />
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs">{vm.config?.machine || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-xs">{vm.config?.cpu_family || '—'}</td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400 text-xs text-right tabular-nums">
                    {vm.config?.mem_size ? (vm.config.mem_size >= 1024 ? `${(vm.config.mem_size / 1024).toFixed(0)} MB` : `${vm.config.mem_size} KB`) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {vms.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">No VMs found</div>}
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { currentUser, authConfig, serverOnline } = useStore()
  const historyRef = useRef<HistoryPoint[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'server'>('general')

  const { data: stats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: systemApi.stats,
    refetchInterval: 2000,
  })

  const { data: userStats } = useQuery({
    queryKey: ['user-stats', currentUser?.id],
    queryFn: systemApi.userStats,
    enabled: !!currentUser,
    refetchInterval: 5000,
  })

  const { data: allUsersStats } = useQuery({
    queryKey: ['all-users-stats', currentUser?.id],
    queryFn: systemApi.allUsersStats,
    enabled: !!currentUser?.is_admin && !!authConfig?.user_management,
    refetchInterval: 15000,
  })

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings', currentUser?.id],
    queryFn: systemApi.getAppSettings,
    enabled: !!currentUser?.is_admin,
    staleTime: 30_000,
  })

  const { data: vms = [] } = useQuery({
    queryKey: ['vms', currentUser?.id],
    queryFn: () => vmApi.list(),
    enabled: !!currentUser,
    refetchInterval: 5000,
  })

  const runningVMs = vms.filter(v => v.status === 'running')

  // Accumulate history
  useEffect(() => {
    if (!stats) return
    const point: HistoryPoint = {
      cpu: stats.cpu_percent,
      mem: stats.memory_percent,
      disk: stats.disk_percent,
    }
    const next = [...historyRef.current.slice(-(HISTORY - 1)), point]
    historyRef.current = next
    setHistory(next)
  }, [stats])

  const cpuHistory = history.map(p => p.cpu)
  const memHistory = history.map(p => p.mem)
  const diskHistory = history.map(p => p.disk)

  const userStoragePct = authConfig?.user_management && userStats
    ? (userStats.disk_usage_bytes / (userStats.max_storage_gb * 1073741824)) * 100
    : undefined

  const showUsersTab = currentUser?.is_admin && authConfig?.user_management
  const showServerTab = currentUser?.is_admin

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Sphere86 on <span className="font-mono">{!serverOnline ? '—' : (stats?.hostname ?? '…')}</span>
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('general')}
            className={clsx(
              'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
              activeTab === 'general'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            General
          </button>
          {showUsersTab && (
            <button
              onClick={() => setActiveTab('users')}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
                activeTab === 'users'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
          )}
          {showServerTab && (
            <button
              onClick={() => setActiveTab('server')}
              className={clsx(
                'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-all',
                activeTab === 'server'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Server className="w-4 h-4" />
              Server
            </button>
          )}
        </div>
      </div>

      {/* Tabs Content */}
      <div className="space-y-6">
        {activeTab === 'general' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StatCard
                label={authConfig?.user_management ? 'Your VMs' : 'VMs'}
                value={!serverOnline ? '—' : userStats ? String(userStats.vm_count) : '—'}
                sub={serverOnline && authConfig?.user_management && userStats ? `of ${userStats.max_vms} · ${userStats.running_vm_count} running` : serverOnline && userStats ? `${userStats.running_vm_count ?? 0} running` : undefined}
                icon={Monitor} color="blue"
                percent={serverOnline && authConfig?.user_management && userStats ? (userStats.vm_count / userStats.max_vms) * 100 : undefined}
              />
              <StatCard
                label={authConfig?.user_management ? 'Your Storage Usage' : 'Storage Usage'}
                value={!serverOnline ? '—' : userStats ? formatBytes(userStats.disk_usage_bytes) : '—'}
                sub={serverOnline && authConfig?.user_management && userStats ? `of ${userStats.max_storage_gb} GB` : undefined}
                icon={HardDrive} color="amber"
                percent={serverOnline ? userStoragePct : undefined}
              />
            </div>
            <VMDetailsTable vms={vms} currentUser={currentUser} />
          </>
        )}

        {activeTab === 'users' && showUsersTab && (
          <UsersTable data={allUsersStats || []} />
        )}

        {activeTab === 'server' && showServerTab && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="CPU Usage"
                value={!serverOnline ? '—' : stats ? `${stats.cpu_percent.toFixed(1)}%` : '—'}
                icon={Cpu} percent={serverOnline ? stats?.cpu_percent : undefined} color="blue"
                history={serverOnline ? cpuHistory : []}
              />
              <StatCard
                label="Memory"
                value={!serverOnline ? '—' : stats ? formatBytes(stats.memory_used) : '—'}
                sub={serverOnline && stats ? `of ${formatBytes(stats.memory_total)}` : undefined}
                icon={MemoryStick} percent={serverOnline ? stats?.memory_percent : undefined} color="purple"
                history={serverOnline ? memHistory : []}
              />
              <StatCard
                label="Storage"
                value={!serverOnline ? '—' : stats ? formatBytes(stats.disk_used) : '—'}
                sub={serverOnline && stats ? `of ${formatBytes(stats.disk_total)}` : undefined}
                icon={HardDrive} percent={serverOnline ? stats?.disk_percent : undefined} color="amber"
                history={serverOnline ? diskHistory : []}
              />
              <StatCard
                label="Uptime"
                value={!serverOnline ? '—' : stats ? formatUptime(stats.uptime_seconds) : '—'}
                icon={Clock} color="green"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <StatCard
                label="All VMs"
                value={!serverOnline ? '—' : stats ? String(stats.total_vms) : '—'}
                sub={serverOnline && stats
                  ? appSettings?.active_vm_limit != null
                    ? `${stats.running_vms} running · ${appSettings.active_vm_limit} slot limit`
                    : `${stats.running_vms} running`
                  : undefined}
                icon={LayoutGrid} color="green"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

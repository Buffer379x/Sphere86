import { useEffect, useRef } from 'react'
import { Monitor, LayoutDashboard, Users, Settings, LogOut, Sun, Moon, X, Server, ServerOff, Library, Cpu, Info } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import type { VMTab } from '../types'
import { systemApi } from '../lib/api'
import DashboardPage from '../pages/DashboardPage'
import VMsPage from '../pages/VMsPage'
import LibraryPage from '../pages/LibraryPage'
import HardwarePage from '../pages/HardwarePage'
import SettingsPage from '../pages/SettingsPage'
import UsersPage from '../pages/UsersPage'
import AboutPage from '../pages/AboutPage'
import VNCViewer from './VNCViewer'
import Toaster from './Toast'
import { clsx } from 'clsx'

function StatusDot({ status }: { status: string }) {
  const { serverOnline } = useStore()

  const effective = serverOnline ? status : 'stopped'

  const colorClass = {
    running: 'bg-emerald-500 dark:bg-emerald-400',
    paused: 'bg-amber-500 dark:bg-amber-400',
    starting: 'bg-blue-500 dark:bg-blue-400',
    stopped: 'bg-red-500 dark:bg-red-400',
    error: 'bg-red-500 dark:bg-red-400',
  }[effective] || 'bg-slate-400 dark:bg-slate-500'

  const isAnimated = effective === 'running' || effective === 'paused' || effective === 'starting'

  return (
    <span
      className={clsx(
        colorClass,
        isAnimated && 'animate-pulse',
        'w-2 h-2 rounded-full inline-block flex-shrink-0'
      )}
    />
  )
}

function useHashRouting() {
  const { activeTab, setActiveTab } = useStore()

  // Read hash on mount and whenever hash changes (back/forward nav)
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1) // remove leading #
      if (hash && hash !== activeTab) {
        setActiveTab(hash)
      }
    }
    onHashChange() // run on mount
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync hash when activeTab changes
  useEffect(() => {
    const current = window.location.hash.slice(1)
    if (current !== activeTab) {
      window.location.hash = activeTab
    }
  }, [activeTab])
}

function useConnectionStatus() {
  const { setServerOnline, serverOnline } = useStore()
  const qc = useQueryClient()
  const { isSuccess, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 1500)
      try {
        const res = await fetch('/api/health', { signal: controller.signal })
        if (!res.ok) throw new Error('offline')
        return res.json()
      } finally {
        clearTimeout(id)
      }
    },
    refetchInterval: 2000,
    retry: false,
  })
  useEffect(() => {
    if (isSuccess) {
      if (!serverOnline) qc.invalidateQueries()
      setServerOnline(true)
    }
  }, [isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isError) setServerOnline(false)
  }, [isError]) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Layout() {
  const { currentUser, logout, theme, setTheme, toggleTheme, openTabs, activeTab, setActiveTab, closeVMTab, authConfig, serverOnline } = useStore()

  useHashRouting()
  useConnectionStatus()

  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: systemApi.version,
    staleTime: 300_000,
  })

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vms', label: 'Virtual Machines', icon: Monitor },
    ...(currentUser?.is_admin || currentUser?.can_access_library ? [{ id: 'media', label: 'Media Manager', icon: Library }] : []),
    { id: 'hardware', label: 'DB Explorer', icon: Cpu },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]


  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0a0a0f] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Logo & Theme Toggle */}
        <div className="h-12 flex items-center justify-between px-4" data-1p-ignore="true" data-lpignore="true" data-bwignore="true">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="Sphere86" className="w-7 h-7 flex-shrink-0 object-contain" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" />
            <div className="min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">Sphere86</span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(isActive ? 'sidebar-item-active' : 'sidebar-item', 'w-full text-left')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            )
          })}

          {/* Open VM tabs in sidebar */}
          {openTabs.length > 0 && (
            <div className="pt-4">
              <div className="px-3 mb-2">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                  Open Consoles
                </span>
              </div>
              {[...openTabs].sort((a, b) => {
                const gA = a.groupName || ''
                const gB = b.groupName || ''
                if (gA !== gB) return gA.localeCompare(gB)
                return a.vmName.localeCompare(b.vmName)
              }).map(tab => {
                const tabId = `vm-${tab.vmUuid}`
                const isActive = activeTab === tabId
                return (
                  <div key={tab.vmId} onClick={() => setActiveTab(tabId)} className={clsx(isActive ? 'sidebar-item-active' : 'sidebar-item', 'group flex justify-between items-center w-full relative overflow-hidden')}>
                    {tab.group_color && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: tab.group_color }} />
                    )}
                    <button className="flex items-center gap-2 flex-1 min-w-0 text-left" style={{ paddingLeft: '8px' }} onClick={() => setActiveTab(tabId)}>
                      <StatusDot status={tab.status} />
                      <span className="truncate text-xs">{tab.vmName}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); closeVMTab(tab.vmId) }}
                      className="opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {currentUser && authConfig?.user_management && (
            <div 
              className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]" 
              data-1p-ignore="true" data-lpignore="true" data-bwignore="true"
            >
              {currentUser.username}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div className="px-1.5" title={serverOnline ? 'Server connected' : 'Server unreachable'}>
              {serverOnline
                ? <Server className="w-3.5 h-3.5 text-emerald-500" />
                : <ServerOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              }
            </div>
            {authConfig?.user_management && (
              <button
                onClick={logout}
                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Sign Out"
                data-1p-ignore="true"
                data-lpignore="true"
                data-bwignore="true"
                tabIndex={-1}
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Offline banner */}
        {!serverOnline && (
          <div className="flex-shrink-0 bg-red-600 text-white text-xs text-center py-1.5 font-medium">
            Server unreachable; options disabled. Check your connection!
          </div>
        )}


        {/* Page content */}
        <div className="flex-1 overflow-hidden relative">
          {/* VM console viewers — always mounted to keep WebSocket alive; hidden when inactive */}
          {openTabs.map((tab: VMTab) => {
            const isActive = activeTab === `vm-${tab.vmUuid}`
            return (
              <div
                key={tab.vmId}
                className="absolute inset-0"
                style={isActive ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
              >
                <VNCViewer vmId={tab.vmId} vmName={tab.vmName} isVisible={isActive} />
              </div>
            )
          })}
          {/* Standard pages — rendered above when no VM tab is active */}
          {!activeTab.startsWith('vm-') && (
            <div className="absolute inset-0 overflow-y-auto">
              {activeTab === 'dashboard' && <DashboardPage />}
              {activeTab === 'vms' && <VMsPage />}
              {activeTab === 'media' && <LibraryPage />}
              {activeTab === 'hardware' && <HardwarePage />}
              {activeTab === 'users' && <UsersPage />}
              {activeTab === 'settings' && <SettingsPage />}
              {activeTab === 'about' && <AboutPage />}
            </div>
          )}
        </div>
      </main>

      <Toaster />
    </div>
  )
}

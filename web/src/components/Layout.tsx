import { useEffect, useRef } from 'react'
import { Monitor, LayoutDashboard, Users, Settings, LogOut, Sun, Moon, X, Server, ServerOff, Library, Cpu, Info, ChevronsLeft, ChevronsRight } from 'lucide-react'
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
  const { currentUser, logout, theme, setTheme, toggleTheme, openTabs, activeTab, setActiveTab, closeVMTab, authConfig, serverOnline, sidebarCollapsed, toggleSidebarCollapsed } = useStore()

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
    <div
      className="flex min-h-0 w-full flex-1 overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]"
      data-1p-ignore="true"
      data-lpignore="true"
      data-bwignore="true"
      data-protonpass-ignore="true"
    >
      {/* Sidebar — stretch full viewport height (row flex + flex-1 parent) */}
      <aside
        className={clsx(
          'flex h-full min-h-0 flex-shrink-0 flex-col self-stretch bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200 ease-out',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Logo */}
        <div
          className={clsx(
            'h-12 flex items-center flex-shrink-0 border-b border-transparent',
            sidebarCollapsed ? 'justify-center px-2' : 'px-4'
          )}
          data-1p-ignore="true"
          data-lpignore="true"
          data-bwignore="true"
        >
          <div className={clsx('flex items-center min-w-0', sidebarCollapsed ? 'justify-center' : 'gap-2.5')}>
            <img src="/logo.png" alt="" className="w-7 h-7 flex-shrink-0 object-contain" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" />
            {!sidebarCollapsed && (
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight truncate">Sphere86</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={clsx('flex-1 min-h-0 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  isActive ? 'sidebar-item-active' : 'sidebar-item',
                  'w-full text-left',
                  sidebarCollapsed && '!justify-center !gap-0 !px-2'
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!sidebarCollapsed && item.label}
              </button>
            )
          })}

          {/* Open VM tabs in sidebar */}
          {openTabs.length > 0 && (
            <div className={clsx(sidebarCollapsed ? 'pt-2' : 'pt-4')}>
              {!sidebarCollapsed && (
                <div className="px-3 mb-2">
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
                    Open Consoles
                  </span>
                </div>
              )}
              {[...openTabs].sort((a, b) => {
                const gA = a.groupName || ''
                const gB = b.groupName || ''
                if (gA !== gB) return gA.localeCompare(gB)
                return a.vmName.localeCompare(b.vmName)
              }).map(tab => {
                const tabId = `vm-${tab.vmUuid}`
                const isActive = activeTab === tabId
                return (
                  <div
                    key={tab.vmId}
                    onClick={() => setActiveTab(tabId)}
                    className={clsx(
                      isActive ? 'sidebar-item-active' : 'sidebar-item',
                      'group flex w-full relative overflow-hidden',
                      sidebarCollapsed ? 'flex-col items-center gap-1 !px-1 !py-2' : 'justify-between items-center'
                    )}
                  >
                    {tab.group_color && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: tab.group_color }} />
                    )}
                    <button
                      type="button"
                      className={clsx(
                        'flex items-center min-w-0 text-left',
                        sidebarCollapsed ? 'flex-col gap-1 justify-center w-full' : 'gap-2 flex-1'
                      )}
                      style={sidebarCollapsed ? undefined : { paddingLeft: '8px' }}
                      title={sidebarCollapsed ? tab.vmName : undefined}
                      onClick={() => setActiveTab(tabId)}
                    >
                      <StatusDot status={tab.status} />
                      {sidebarCollapsed ? (
                        <Monitor className="w-4 h-4 flex-shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
                      ) : (
                        <span className="truncate text-xs">{tab.vmName}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); closeVMTab(tab.vmId) }}
                      className={clsx(
                        'rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-opacity',
                        sidebarCollapsed ? 'p-0.5 opacity-90' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto p-0.5 flex-shrink-0'
                      )}
                      title="Close console tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </nav>

        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          className="flex-shrink-0 mx-2 mb-1 flex items-center justify-center rounded-lg py-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>

        {/* Footer */}
        <div
          className={clsx(
            'flex-shrink-0 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5',
            sidebarCollapsed ? 'flex-col py-2 px-2' : 'px-3 py-3 justify-between'
          )}
        >
          {currentUser && authConfig?.user_management && !sidebarCollapsed && (
            <div
              className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]"
              data-1p-ignore="true"
              data-lpignore="true"
              data-bwignore="true"
            >
              {currentUser.username}
            </div>
          )}

          <div className={clsx('flex items-center gap-1.5', sidebarCollapsed && 'flex-col')}>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
              title={theme === 'dark' ? 'Dark mode' : 'Light mode'}
            >
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <div className="px-1.5" title={serverOnline ? 'Server connected' : 'Server unreachable'}>
              {serverOnline
                ? <Server className="w-3.5 h-3.5 text-emerald-500" />
                : <ServerOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
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
                type="button"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
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

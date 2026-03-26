import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, CheckCircle, AlertTriangle, Server, Package, Settings2, ShieldCheck, Activity, Users, Info, Terminal, Settings as SettingsIcon } from 'lucide-react'
import { systemApi } from '../lib/api'
import { useStore } from '../store/useStore'
import UsersPage from './UsersPage'
import AboutPage from './AboutPage'
import LogsPage from './LogsPage'
import { clsx } from 'clsx'
import { AppSettings } from '../types'

type SettingsTab = 'general' | 'users' | 'logs' | 'about'

export default function SettingsPage() {
  const { currentUser, authConfig, theme, toggleTheme, serverOnline, addToast } = useStore()
  const isAdmin = currentUser?.is_admin || !authConfig?.user_management
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [activeVmLimitInput, setActiveVmLimitInput] = useState<string>('')

  const { data: version, refetch: refetchVersion } = useQuery({
    queryKey: ['version'],
    queryFn: systemApi.version,
    refetchInterval: 30000,
  })


  const updateMut = useMutation({
    mutationFn: systemApi.triggerUpdate,
    onSuccess: (result) => {
      const summary = Object.entries(result)
        .map(([k, v]) => `${k.replace(/box86/g, '86Box').replace(/roms/g, 'ROMS').replace(/_/g, ' ')}: ${v.replace(/_/g, ' ')}`)
        .join('\n')
      addToast(`Update Successful\n${summary}`, 'success')
      refetchVersion()
    },
    onError: (e: any) => {
      addToast(`Update Failed: ${e.message}`, 'error')
    }
  })

  const hwRefreshMut = useMutation({
    mutationFn: systemApi.refreshHardware,
    onSuccess: (result) => {
      addToast(`Hardware Database Refreshed: Extracted ${result.machines} machines`, 'success')
    },
    onError: (e: any) => {
      addToast(`Hardware Refresh Failed: ${e.message}`, 'error')
    },
  })

  const { data: appSettings } = useQuery({
    queryKey: ['app-settings'],
    queryFn: systemApi.getAppSettings,
    enabled: !!isAdmin,
  })

  const appSettingsMut = useMutation({
    mutationFn: systemApi.updateAppSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-settings'] }),
  })

  const { data: recommendedLimit } = useQuery({
    queryKey: ['recommended-vm-limit'],
    queryFn: systemApi.recommendedVmLimit,
    enabled: !!isAdmin,
  })

  const [formState, setFormState] = useState<Partial<AppSettings>>({})

  useEffect(() => {
    if (appSettings) {
      setFormState(appSettings)
      setActiveVmLimitInput(appSettings.active_vm_limit != null ? String(appSettings.active_vm_limit) : '')
    }
  }, [appSettings])

  async function handleUpdate() {
    await updateMut.mutateAsync()
  }

  async function saveSettings(updates: Partial<AppSettings>) {
    try {
      await appSettingsMut.mutateAsync(updates)
      addToast('Settings saved successfully', 'success')
    } catch (e: any) {
      addToast(`Save failed: ${e.message}`, 'error')
    }
  }

  const RestartHint = () => (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 ml-2">
      <AlertTriangle className="w-2.5 h-2.5" />
      Restart Required
    </span>
  )

  const tabs = [
    { id: 'general', label: 'General', icon: SettingsIcon },
    ...(isAdmin ? [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'logs', label: 'Logs', icon: Terminal },
    ] : []),
    { id: 'about', label: 'About', icon: Info },
  ] as const

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Application configuration and system information</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit">
          {tabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Version info in a grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Sphere86 Version */}
              <div className="card divide-y divide-slate-100 dark:divide-slate-800 h-fit">
                <div className="px-6 py-4 flex items-center gap-3">
                  <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">Sphere86</h2>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Installed Version</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.app_version || '1.0.0'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Latest Available</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.app_latest || '1.0.0'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 86Box Version */}
              <div className="card divide-y divide-slate-100 dark:divide-slate-800 h-fit">
                <div className="px-6 py-4 flex items-center gap-3">
                  <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">86Box</h2>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Installed Version</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.box86_version || 'Not installed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Latest Available</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.box86_latest || '—'}
                    </p>
                  </div>
                </div>
                {version?.update_available && (
                  <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-700 dark:text-amber-400 text-xs text-truncate">
                      Update available: {version.box86_latest}
                    </span>
                  </div>
                )}
              </div>

              {/* ROMs */}
              <div className="card divide-y divide-slate-100 dark:divide-slate-800 h-fit">
                <div className="px-6 py-4 flex items-center gap-3">
                  <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">ROM Files</h2>
                </div>
                <div className="px-6 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Installed Version</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.roms_version || 'Not installed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Latest Available</p>
                    <p className="font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {version?.roms_latest || '—'}
                    </p>
                  </div>
                </div>
                {version?.roms_update_available && (
                  <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/10 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-700 dark:text-amber-400 text-xs text-truncate">
                      Update available: {version.roms_latest}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Utilities Grid (Check for Updates / Hardware Refresh) */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="card px-6 py-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 dark:text-white">Check for Updates</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Download the latest 86Box binary and ROM files</p>
                  </div>
                  <button onClick={handleUpdate} disabled={updateMut.isPending || !serverOnline} className="btn-primary disabled:opacity-60 shrink-0">
                    {updateMut.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" />Updating...</> : <><RefreshCw className="w-4 h-4" />Update Now</>}
                  </button>
                </div>

                <div className="card px-6 py-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 dark:text-white">Hardware Database</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Re-extract machine and device lists from 86Box source</p>
                  </div>
                  <button onClick={() => { hwRefreshMut.mutate() }} disabled={hwRefreshMut.isPending || !serverOnline} className="btn-primary disabled:opacity-60 shrink-0">
                    {hwRefreshMut.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" />Refreshing...</> : <><RefreshCw className="w-4 h-4" />Refresh Now</>}
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Application Settings */}
            {isAdmin && appSettings && (
              <div className="space-y-6">

                {/* Engine Settings (86Box) */}
                <div className="card">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <Server className="w-5 h-5 text-amber-500" />
                    <h2 className="font-semibold text-slate-900 dark:text-white">Engine Settings (86Box)</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Target Version
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Release tag (blank = latest).</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="input w-28 font-mono text-sm"
                          placeholder="Latest"
                          value={formState.box86_version || ''}
                          onChange={e => setFormState(s => ({ ...s, box86_version: e.target.value }))}
                        />
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ box86_version: formState.box86_version })}>Save</button>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Architecture
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Target CPU architecture.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="input w-28 text-sm"
                          value={formState.box86_arch || 'x86_64'}
                          onChange={e => setFormState(s => ({ ...s, box86_arch: e.target.value }))}
                        >
                          <option value="x86_64">x86_64</option>
                          <option value="aarch64">aarch64</option>
                        </select>
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ box86_arch: formState.box86_arch })}>Save</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Authentication */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-semibold text-slate-900 dark:text-white">Authentication</h2>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    <div className="p-6 flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          User Management
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Require login to access the dashboard. If disabled, everyone is admin.</p>
                      </div>
                      <button
                        onClick={() => saveSettings({ user_management: !formState.user_management })}
                        className={clsx(
                          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                          formState.user_management ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <span className={clsx('h-4 w-4 transform rounded-full bg-white transition-transform', formState.user_management ? 'translate-x-6' : 'translate-x-1')} />
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium text-slate-900 dark:text-white">LDAP Authentication</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Allow users to log in using corporate LDAP/Active Directory.</p>
                        </div>
                        <button
                          onClick={() => saveSettings({ ldap_enabled: !formState.ldap_enabled })}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                            formState.ldap_enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                          )}
                        >
                          <span className={clsx('h-4 w-4 transform rounded-full bg-white transition-transform', formState.ldap_enabled ? 'translate-x-6' : 'translate-x-1')} />
                        </button>
                      </div>

                      {formState.ldap_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Server</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_server || ''} onChange={e => setFormState(s => ({ ...s, ldap_server: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Port</label>
                            <input type="number" className="input text-sm w-full" value={formState.ldap_port || 389} onChange={e => setFormState(s => ({ ...s, ldap_port: parseInt(e.target.value) }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">TLS</label>
                            <button onClick={() => setFormState(s => ({ ...s, ldap_tls: !s.ldap_tls }))} className={clsx('flex items-center gap-2 px-3 py-1.5 rounded border text-sm w-full font-medium', formState.ldap_tls ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800' : 'border-slate-200 dark:border-slate-700')}>
                              {formState.ldap_tls ? 'Enabled' : 'Disabled'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Base DN</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_base_dn || ''} onChange={e => setFormState(s => ({ ...s, ldap_base_dn: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Bind DN</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_bind_dn || ''} onChange={e => setFormState(s => ({ ...s, ldap_bind_dn: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Bind Password</label>
                            <input type="password" placeholder="********" className="input text-sm w-full" value={formState.ldap_bind_password || ''} onChange={e => setFormState(s => ({ ...s, ldap_bind_password: e.target.value }))} autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">User Filter</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_user_filter || ''} onChange={e => setFormState(s => ({ ...s, ldap_user_filter: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Group DN</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_group_dn || ''} onChange={e => setFormState(s => ({ ...s, ldap_group_dn: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Username Attr</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_username_attr || ''} onChange={e => setFormState(s => ({ ...s, ldap_username_attr: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase">Email Attr</label>
                            <input type="text" className="input text-sm w-full" value={formState.ldap_email_attr || ''} onChange={e => setFormState(s => ({ ...s, ldap_email_attr: e.target.value }))} />
                          </div>
                          <div className="pt-2 col-span-full flex justify-end">
                            <button className="btn-primary py-1.5" onClick={() => saveSettings({
                              ldap_server: formState.ldap_server,
                              ldap_port: formState.ldap_port,
                              ldap_tls: formState.ldap_tls,
                              ldap_base_dn: formState.ldap_base_dn,
                              ldap_bind_dn: formState.ldap_bind_dn,
                              ldap_bind_password: formState.ldap_bind_password,
                              ldap_user_filter: formState.ldap_user_filter,
                              ldap_group_dn: formState.ldap_group_dn,
                              ldap_username_attr: formState.ldap_username_attr,
                              ldap_email_attr: formState.ldap_email_attr
                            })}>Save LDAP Config</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Default Quotas & System Limits */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <Settings2 className="w-5 h-5 text-violet-500" />
                    <h2 className="font-semibold text-slate-900 dark:text-white">Default Quotas & System Limits</h2>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Row 1: Active VM Limit + Enforce Quotas */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">Active VM Limit</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Simultaneous VMs across all users.
                          </p>
                          {recommendedLimit && (
                            <p className="text-xs text-slate-400 mt-1">
                              Host rec: <span className="font-semibold">{recommendedLimit.recommended}</span>
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="input w-28 text-sm"
                            value={activeVmLimitInput}
                            onChange={e => setActiveVmLimitInput(e.target.value)}
                            placeholder="No limit"
                          />
                          <button className="btn-secondary px-2.5 py-1.5" onClick={() => {
                            const val = activeVmLimitInput.trim()
                            const parsed = val ? parseInt(val) : null
                            saveSettings({ active_vm_limit: parsed })
                          }}>Save</button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-slate-900 dark:text-white">Enforce Quotas</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Global quota enforcement toggle.</p>
                        </div>
                        <button
                          onClick={() => saveSettings({ enforce_quotas: !formState.enforce_quotas })}
                          className={clsx(
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0',
                            formState.enforce_quotas ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
                          )}
                        >
                          <span className={clsx('h-4 w-4 transform rounded-full bg-white transition-transform', formState.enforce_quotas ? 'translate-x-6' : 'translate-x-1')} />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Total VM Deployment Limit + VM Auto-Shutdown */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                            Total VM Limit
                            <RestartHint />
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Max VMs in system database.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="input w-28 text-sm"
                            value={formState.max_concurrent_vms || 0}
                            onChange={e => setFormState(s => ({ ...s, max_concurrent_vms: parseInt(e.target.value) }))}
                          />
                          <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ max_concurrent_vms: formState.max_concurrent_vms })}>Save</button>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">VM Auto-Shutdown</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Stop VMs after X min inactivity (0=off).</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="input w-28 text-sm"
                            value={formState.vm_auto_shutdown_minutes || 0}
                            onChange={e => setFormState(s => ({ ...s, vm_auto_shutdown_minutes: parseInt(e.target.value) }))}
                          />
                          <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ vm_auto_shutdown_minutes: formState.vm_auto_shutdown_minutes })}>Save</button>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">Default Max VMs</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Default limit for new user accounts.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" className="input w-28 text-sm" value={formState.default_max_vms || 0} onChange={e => setFormState(s => ({ ...s, default_max_vms: parseInt(e.target.value) }))} />
                          <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ default_max_vms: formState.default_max_vms })}>Save</button>
                        </div>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">Default Storage (GB)</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Default disk quota for new users.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="number" className="input w-28 text-sm" value={formState.default_max_storage_gb || 0} onChange={e => setFormState(s => ({ ...s, default_max_storage_gb: parseInt(e.target.value) }))} />
                          <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ default_max_storage_gb: formState.default_max_storage_gb })}>Save</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Maintenance & Maintenance */}
                <div className="card">
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <Terminal className="w-5 h-5 text-slate-500" />
                    <h2 className="font-semibold text-slate-900 dark:text-white">Maintenance & Advanced</h2>
                  </div>
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Base VNC Port
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start of VNC port range (59xx).</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input w-28 text-sm" value={formState.base_vnc_port || 5900} onChange={e => setFormState(s => ({ ...s, base_vnc_port: parseInt(e.target.value) }))} />
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ base_vnc_port: formState.base_vnc_port })}>Save</button>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Base WebSocket Port
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Start of WS port range (60xx).</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" className="input w-28 text-sm" value={formState.base_ws_port || 6000} onChange={e => setFormState(s => ({ ...s, base_ws_port: parseInt(e.target.value) }))} />
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ base_ws_port: formState.base_ws_port })}>Save</button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Logging Level
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">System-wide log verbosity.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="input w-28 text-sm"
                          value={formState.log_level || 'info'}
                          onChange={e => setFormState(s => ({ ...s, log_level: e.target.value }))}
                        >
                          <option value="debug">Debug</option>
                          <option value="info">Info</option>
                          <option value="warning">Warning</option>
                          <option value="error">Error</option>
                        </select>
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ log_level: formState.log_level })}>Save</button>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 dark:text-white flex items-center">
                          Audio Buffer (s)
                          <RestartHint />
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Latency vs. smoothness (default 0.4).</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          className="input w-28 text-sm"
                          value={formState.audio_buffer_secs || 0.15}
                          onChange={e => setFormState(s => ({ ...s, audio_buffer_secs: parseFloat(e.target.value) }))}
                        />
                        <button className="btn-secondary px-2.5 py-1.5" onClick={() => saveSettings({ audio_buffer_secs: formState.audio_buffer_secs })}>Save</button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {activeTab === 'users' && <UsersPage hideHeader />}
        {activeTab === 'logs' && <LogsPage hideHeader />}
        {activeTab === 'about' && <AboutPage hideHeader />}
      </div>
    </div>
  )
}

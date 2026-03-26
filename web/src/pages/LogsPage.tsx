import { useState, useEffect, useRef } from 'react'
import { Terminal, Trash2, Pause, Play, ChevronDown } from 'lucide-react'
import { vmApi } from '../lib/api'
import { useStore } from '../store/useStore'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { VM } from '../types'

type LogType = 'panel' | 'engine' | 'vm'

export default function LogsPage({ hideHeader }: { hideHeader?: boolean }) {
  const { authConfig, token } = useStore()
  const [logType, setLogType] = useState<LogType>('panel')
  const [selectedVmId, setSelectedVmId] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])
  const [autoScroll, setAutoScroll] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const { data: vms = [] } = useQuery({
    queryKey: ['vms-all'],
    queryFn: () => vmApi.list(),
    enabled: logType === 'vm',
  })

  useEffect(() => {
    if (logType === 'vm' && vms.length > 0 && !selectedVmId) {
      setSelectedVmId(String(vms[0].id))
    }
  }, [logType, vms, selectedVmId])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [logType, selectedVmId])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  function connect() {
    if (wsRef.current) {
      wsRef.current.close()
    }

    if (logType === 'vm' && !selectedVmId) return

    if (!token) {
      setLogs(prev => [...prev, "--- Error: No authentication token found ---"])
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/api/logs/stream?log_type=${logType}&token=${token}${selectedVmId ? `&vm_id=${selectedVmId}` : ''}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setLogs(prev => [...prev, `--- Connected to ${logType} logs ---`])
    }

    ws.onmessage = (event) => {
      setLogs(prev => {
        const newLogs = [...prev, event.data]
        if (newLogs.length > 1000) return newLogs.slice(-1000)
        return newLogs
      })
    }

    ws.onclose = () => {
      setIsConnected(false)
      setLogs(prev => [...prev, `--- Disconnected from ${logType} logs ---`])
    }

    ws.onerror = () => {
      setLogs(prev => [...prev, `--- Error connecting to logs ---`])
    }
  }

  function clearLogs() {
    setLogs([])
  }

  return (
    <div className={hideHeader ? "space-y-4" : "p-6 max-w-7xl mx-auto space-y-6"}>
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">System Logs</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time system and VM activity</p>
          </div>
        </div>
      )}

      <div className="card flex flex-col h-[600px] overflow-hidden bg-slate-950 border-slate-800 shadow-2xl">
        {/* Toolbar */}
        <div className="p-3 border-b border-white/5 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-800/50 rounded-lg">
              {(['panel', 'engine', 'vm'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setLogType(type); setLogs([]); }}
                  className={clsx(
                    "px-3 py-1 text-[10px] font-bold rounded transition-all uppercase tracking-widest",
                    logType === type 
                      ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.3)]" 
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {type === 'panel' ? 'Web' : type}
                </button>
              ))}
            </div>

            {logType === 'vm' && vms.length > 0 && (
              <div className="relative">
                <select
                  value={selectedVmId}
                  onChange={(e) => { setSelectedVmId(e.target.value); setLogs([]); }}
                  className="appearance-none bg-slate-800/80 text-slate-200 text-xs font-medium pl-3 pr-8 py-1.5 rounded-lg border border-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                >
                  {vms.map((vm: VM) => (
                    <option key={vm.id} value={vm.id}>{vm.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={clsx(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"
              )} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={clsx(
                "p-1.5 rounded-md transition-colors",
                autoScroll ? "text-blue-400 bg-blue-400/10" : "text-slate-500 hover:text-slate-300"
              )}
              title={autoScroll ? "Disable Auto-scroll" : "Enable Auto-scroll"}
            >
              {autoScroll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={clearLogs}
              className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              title="Clear Terminal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent bg-[#0a0c10]"
        >
          {logs.map((log, i) => (
            <div key={i} className={clsx(
              "whitespace-pre-wrap py-0.5",
              log.includes('[ERROR]') || log.includes('error') ? "text-red-400" :
              log.includes('[WARNING]') ? "text-amber-400" :
              log.startsWith('---') ? "text-blue-400 font-bold italic opacity-80 my-2" :
              "text-slate-300 opacity-90"
            )}>
              <span className="select-none opacity-20 mr-4 text-[10px] w-6 inline-block text-right">{i + 1}</span>
              {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
              <Terminal className="w-12 h-12 opacity-5" />
              <p className="text-sm font-bold uppercase tracking-widest opacity-20">Waiting for data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

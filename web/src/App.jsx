import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, Zap, DollarSign, TrendingUp, Activity, 
  AlertTriangle, Pause, Play, Settings, MoreVertical,
  RefreshCw, LayoutGrid, List, Bell, Search,
  ChevronDown, Shield, Cpu, Clock, CheckCircle, XCircle,
  Home
} from 'lucide-react'
import { useSettings, calculateMetrics } from './hooks/useSettings'
import SettingsPage from './pages/SettingsPage'
import AgentProfileModal from './components/AgentProfileModal'
import TaskCenter from './pages/TaskCenter'
import OverviewPage from './pages/OverviewPage'
import EmployeesPage from './pages/EmployeesPage'

// API Base URL - will be proxied by Vite in dev
const API_BASE = '/api'

// Mock data for demo (in production, this comes from API)
const generateMockKPIs = (agentId, hoursSaved = 0) => ({
  avgResponseTime: Math.floor(Math.random() * 5000) + 500,
  successRate: Math.floor(Math.random() * 30) + 70,
  tokensUsed: Math.floor(Math.random() * 100000) + 10000,
  cost: (Math.random() * 50 + 5).toFixed(2),
  hoursSaved,
  skills: ['Security Analysis', 'Code Review', 'Data Processing'].slice(0, Math.floor(Math.random() * 3) + 1)
})

const skillsList = [
  'Security Analysis', 'Code Review', 'Customer Support', 
  'Data Processing', 'API Integration', 'Documentation',
  'Testing', 'DevOps', 'Database Design', 'UI/UX'
]

// ============ COMPONENTS ============

// 1. Global Stats Bar
function GlobalStatsBar({ stats, loading }) {
  const statCards = [
    { 
      label: 'AI 產出價值 (FTE)', 
      value: stats.fte.toFixed(1), 
      subtext: 'equivalent employees',
      icon: Users,
      gradient: 'from-violet-600 to-purple-600'
    },
    { 
      label: '本月節省預算', 
      value: `$${(stats.costSaved / 1000).toFixed(1)}K`, 
      subtext: 'based on $50/hr',
      icon: DollarSign,
      gradient: 'from-emerald-600 to-teal-600'
    },
    { 
      label: '算力成本 (LLM)', 
      value: `$${stats.llmSpend.toFixed(2)}`, 
      subtext: 'cumulative spend',
      icon: Cpu,
      gradient: 'from-orange-500 to-red-500'
    },
    { 
      label: '系統成功率', 
      value: `${stats.uptime}%`, 
      subtext: 'avg success rate',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-cyan-500'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <motion.p 
                className="text-3xl font-bold mt-1"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                key={stat.value}
              >
                {loading ? '...' : stat.value}
              </motion.p>
              <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-lg`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// 2. Agent Card
function AgentCard({ agent, onPause, onResume, onSettings, hoursSaved = 0, onClick }) {
  const [showMenu, setShowMenu] = useState(false)
  const [kpis] = useState(() => generateMockKPIs(agent.id, hoursSaved))
  
  const isError = agent.status === 'error' || agent.summary?.title?.includes('Error')
  const isActive = agent.isActive
  const isCompleted = agent.progress >= 95

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card p-5 relative group cursor-pointer ${isError ? 'animate-pulse-red border-red-500/50' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
            ${isActive ? 'bg-gradient-to-br from-violet-600 to-purple-600' : 'bg-gray-700'}`}>
            {agent.agentDisplayName?.charAt(0) || '🤖'}
          </div>
          <div>
            <h3 className="font-semibold">{agent.agentDisplayName}</h3>
            <p className="text-xs text-gray-400">{agent.departmentName}</p>
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-gray-400" />
          </button>
          
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 glass w-40 py-1 z-10"
              >
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2">
                  <Pause className="w-4 h-4" /> 暫停任務
                </button>
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2">
                  <Play className="w-4 h-4" /> 手動介入
                </button>
                <button className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> 調整權限
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Task Info */}
      <div className="mb-4">
        <p className="text-sm font-medium mb-1 truncate">{agent.taskName}</p>
        <p className="text-xs text-gray-400 truncate">{agent.summary?.title}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">進度</span>
          <span className={agent.progress >= 100 ? 'text-emerald-400' : 'text-violet-400'}>
            {agent.progress}%
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div 
            className={`h-full progress-bar ${agent.progress >= 100 ? 'progress-success' : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${agent.progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Skills Tags */}
      <div className="flex flex-wrap gap-1 mb-4">
        {kpis.skills.map((skill, i) => (
          <span key={i} className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded-full">
            {skill}
          </span>
        ))}
      </div>

      {/* KPIs Row */}
      <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/10">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{(kpis.avgResponseTime / 1000).toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-1">
          {kpis.successRate >= 80 ? (
            <CheckCircle className="w-3 h-3 text-emerald-400" />
          ) : (
            <XCircle className="w-3 h-3 text-red-400" />
          )}
          <span>{kpis.successRate}%</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400">
          <Clock className="w-3 h-3" />
          <span>{hoursSaved}h</span>
        </div>
        <div className="flex items-center gap-1 text-orange-400">
          <DollarSign className="w-3 h-3" />
          <span>${kpis.cost}</span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-3 right-12">
        {isActive && (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        )}
      </div>
    </motion.div>
  )
}

// 3. Department Section
function DepartmentSection({ department, agents, onAgentAction, getHoursSaved, onAgentCardClick }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <motion.div 
      layout
      className="mb-6"
    >
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full glass-card p-4 mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold">{department.name}</h2>
            <p className="text-xs text-gray-400">{department.stats.totalAgents} agents</p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {agents.map(agent => (
              <AgentCard 
                key={agent.id} 
                agent={agent}
                onPause={() => onAgentAction('pause', agent.id)}
                onResume={() => onAgentAction('resume', agent.id)}
                onSettings={() => onAgentAction('settings', agent.id)}
                hoursSaved={agent.progress >= 95 ? (getHoursSaved ? getHoursSaved(agent.agent) : 2) : 0}
                onClick={() => onAgentCardClick(agent)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// 4. Notification Panel (Errors) - Shows when bell is clicked
function NotificationPanel({ errorAgents, onDismiss, onClearAll, notifications, isOpen, onClose }) {
  const [showHistory, setShowHistory] = useState(false)
  
  // Only show active (non-dismissed) errors
  const activeErrors = errorAgents.filter(e => !notifications.dismissed.includes(e.id))
  const hasActiveErrors = activeErrors.length > 0

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="fixed right-4 top-20 w-80 glass-card max-h-[calc(100vh-120px)] overflow-hidden z-50"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${hasActiveErrors ? 'text-red-400 animate-pulse' : 'text-gray-400'}`} />
            <span className="font-semibold">異常通知</span>
            {hasActiveErrors && (
              <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">
                {activeErrors.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        
        {/* Action buttons */}
        {hasActiveErrors && (
          <div className="flex gap-2">
            <button 
              onClick={onClearAll}
              className="flex-1 px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
            >
              一鍵清理
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="flex-1 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-gray-400 rounded-lg transition-colors"
            >
              {showHistory ? '查看最新' : '歷史記錄'}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          exit={{ height: 0 }}
          className="overflow-y-auto max-h-96"
        >
          {showHistory ? (
            // History view
            notifications.history.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                尚無歷史記錄
              </div>
            ) : (
              notifications.history.map((notif, idx) => (
                <motion.div
                  key={`${notif.id}-${idx}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 border-b border-white/5"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notif.agentName}</p>
                      <p className="text-xs text-gray-500 truncate">{notif.title}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )
          ) : (
            // Active errors view
            activeErrors.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                所有系統運作正常
              </div>
            ) : (
              activeErrors.map(agent => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer"
                  onClick={() => onDismiss(agent.id)}
                >
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.agentDisplayName}</p>
                      <p className="text-xs text-gray-400 truncate">{agent.summary?.title}</p>
                      <p className="mt-2 text-xs text-violet-400">
                        點擊消除 →
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

// 5. Sidebar Navigation
function Sidebar({ activeView, setActiveView, collapsed, setCollapsed, notificationCount }) {
  const navItems = [
    { id: 'overview', label: '總覽', icon: Home },
    { id: 'employees', label: 'AI 員工', icon: Users },
    { id: 'tasks', label: '任務中心', icon: Activity },
    { id: 'notifications', label: '異常通知', icon: Bell },
    { id: 'settings', label: '設定', icon: Settings },
  ]

  return (
    <motion.aside 
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className={`glass h-screen sticky top-0 flex flex-col ${collapsed ? 'w-16' : 'w-56'}`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-lg">
            N
          </div>
          {!collapsed && (
            <span className="font-bold gradient-text">Nova AI</span>
          )}
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all
              ${activeView === item.id 
                ? 'bg-violet-600/20 text-violet-300' 
                : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm">{item.label}</span>}
            {item.id === 'notifications' && notificationCount > 0 && (
              <span className="ml-auto px-2 py-0.5 text-xs bg-red-500 rounded-full">
                {notificationCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-white/10 text-gray-400 hover:text-white"
      >
        {collapsed ? '→' : '←'}
      </button>
    </motion.aside>
  )
}

// ============ MAIN APP ============

function App() {
  const [departments, setDepartments] = useState([])
  const [sessions, setSessions] = useState([])
  const [stats, setStats] = useState({
    fte: 0,
    costSaved: 0,
    llmSpend: 0,
    uptime: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  
  // Settings hook
  const { settings, updateSettings, resetSettings, saveSettings, isDirty, getHoursSaved, calculateModelCost } = useSettings()
  
  // Notification state
  const [notifications, setNotifications] = useState({
    dismissed: [], // IDs of dismissed notifications
    history: []    // History of resolved notifications
  })
  const [showNotificationPanel, setShowNotificationPanel] = useState(false)
  
  // Agent profile modal state
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [agentSkills, setAgentSkills] = useState([])

  // Fetch agent skills
  const fetchAgentSkills = async () => {
    try {
      const res = await fetch(`${API_BASE}/agents/skills`)
      const data = await res.json()
      setAgentSkills(data)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    }
  }
  
  useEffect(() => {
    fetchAgentSkills()
  }, [])

  // Calculate metrics based on settings
  const calculatedMetrics = useMemo(() => {
    return calculateMetrics(sessions, settings)
  }, [sessions, settings])

  // Fetch data from API
  const fetchData = async () => {
    try {
      const [deptRes, sessionsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/departments`),
        fetch(`${API_BASE}/sessions`),
        fetch(`${API_BASE}/stats`)
      ])

      const deptData = await deptRes.json()
      const sessionsData = await sessionsRes.json()
      const statsData = await statsRes.json()

      setDepartments(deptData)
      setSessions(sessionsData)
      
      // Stats calculated via useMemo based on settings
      setLastUpdate(new Date())
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setLoading(false)
    }
  }

  // Initial fetch + polling
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Filter error agents (only show errors not already dismissed)
  const errorAgents = sessions.filter(s => 
    (s.summary?.title?.includes('Error') || 
    s.summary?.title?.includes('404') ||
    s.summary?.title?.includes('failed')) &&
    !notifications.dismissed.includes(s.id)
  )
  
  // Count for badge
  const notificationCount = errorAgents.length

  // Group sessions by department
  const sessionsByDept = departments.reduce((acc, dept) => {
    acc[dept.id] = sessions.filter(s => s.department === dept.id)
    return acc
  }, {})

  const handleAgentAction = (action, agentId) => {
    console.log(`Action: ${action} on agent: ${agentId}`)
  }
  
  // Handle clicking on agent card to open profile
  const handleAgentClick = (agent) => {
    setSelectedAgent(agent)
    setShowAgentModal(true)
  }
  
  // Handle dismiss single notification
  const handleDismissNotification = (agentId) => {
    const agent = sessions.find(s => s.id === agentId)
    if (agent) {
      setNotifications(prev => ({
        dismissed: [...prev.dismissed, agentId],
        history: [{
          id: agentId,
          agentName: agent.agentDisplayName,
          title: agent.summary?.title || agent.taskName,
          timestamp: Date.now()
        }, ...prev.history].slice(0, 50) // Keep max 50 history items
      }))
    }
  }
  
  // Handle clear all notifications
  const handleClearAllNotifications = () => {
    const currentErrors = sessions.filter(s => 
      s.summary?.title?.includes('Error') || 
      s.summary?.title?.includes('404') ||
      s.summary?.title?.includes('failed')
    )
    
    const newHistory = currentErrors.map(agent => ({
      id: agent.id,
      agentName: agent.agentDisplayName,
      title: agent.summary?.title || agent.taskName,
      timestamp: Date.now()
    }))
    
    setNotifications(prev => ({
      dismissed: [...prev.dismissed, ...currentErrors.map(a => a.id)],
      history: [...newHistory, ...prev.history].slice(0, 50)
    }))
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        notificationCount={notificationCount}
      />

      {/* Main Content */}
      <main className={`flex-1 p-6 transition-all ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {activeView === 'overview' && '總覽'}
              {activeView === 'employees' && 'AI 員工'}
              {activeView === 'tasks' && '任務中心'}
              {activeView === 'settings' && '系統設定'}
              {activeView === 'notifications' && '異常通知'}
            </h1>
            <p className="text-sm text-gray-400">
              即時監控 {sessions.length} 個 AI Agent 運作狀態
              {lastUpdate && <span className="ml-2">· 更新於 {lastUpdate.toLocaleTimeString()}</span>}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search - hidden on overview */}
            {activeView !== 'overview' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="搜尋 Agent..." 
                  className="glass pl-10 pr-4 py-2 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}
            
            {/* Refresh */}
            <button 
              onClick={fetchData}
              className="p-2 glass rounded-xl hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Notifications - Bell - hidden on overview */}
            {activeView !== 'overview' && (
              <button 
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="p-2 glass rounded-xl hover:bg-white/10 transition-colors relative"
              >
                <Bell className={`w-5 h-5 ${errorAgents.length > 0 ? 'text-red-400' : ''}`} />
                {errorAgents.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                    {errorAgents.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content based on active view */}
        {activeView === 'settings' ? (
          <SettingsPage 
            settings={settings}
            onUpdate={updateSettings}
            onSave={saveSettings}
            onReset={resetSettings}
            isDirty={isDirty}
          />
        ) : activeView === 'tasks' ? (
          <TaskCenter sessions={sessions} />
        ) : activeView === 'overview' ? (
          <OverviewPage sessions={sessions} departments={departments} />
        ) : activeView === 'employees' ? (
          <>
            {/* Global Stats */}
            <GlobalStatsBar stats={calculatedMetrics} loading={loading} />

            {/* Departments & Agents */}
            <div className="pr-80">
              {departments.map(dept => (
                <DepartmentSection
                  key={dept.id}
                  department={dept}
                  agents={sessionsByDept[dept.id] || []}
                  onAgentAction={handleAgentAction}
                  getHoursSaved={getHoursSaved}
                  onAgentCardClick={handleAgentClick}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Default to Overview */}
            <OverviewPage sessions={sessions} departments={departments} />
          </>
        )}
      </main>

      {/* Notification Panel - shows when bell clicked */}
      <NotificationPanel 
        errorAgents={errorAgents}
        onDismiss={handleDismissNotification}
        onClearAll={handleClearAllNotifications}
        notifications={notifications}
        isOpen={showNotificationPanel}
        onClose={() => setShowNotificationPanel(false)}
      />

      {/* Agent Profile Modal */}
      <AgentProfileModal
        agent={selectedAgent}
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        skills={agentSkills}
      />
    </div>
  )
}

export default App

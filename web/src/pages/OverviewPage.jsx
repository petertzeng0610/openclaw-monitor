import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronDown, Bot, Cpu, Users, Activity, 
  CheckCircle, Clock, Pause, Zap, Sparkles
} from 'lucide-react'

// Department colors mapping
const departmentColors = {
  'Finance': { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', tag: 'bg-emerald-500/20 text-emerald-300' },
  'Marketing': { border: 'border-pink-500/50', bg: 'bg-pink-500/10', tag: 'bg-pink-500/20 text-pink-300' },
  'Engineering': { border: 'border-blue-500/50', bg: 'bg-blue-500/10', tag: 'bg-blue-500/20 text-blue-300' },
  'openclaw': { border: 'border-violet-500/50', bg: 'bg-violet-500/10', tag: 'bg-violet-500/20 text-violet-300' },
  'claude': { border: 'border-purple-500/50', bg: 'bg-purple-500/10', tag: 'bg-purple-500/20 text-purple-300' },
  'claude-coworker': { border: 'border-cyan-500/50', bg: 'bg-cyan-500/10', tag: 'bg-cyan-500/20 text-cyan-300' },
  'default': { border: 'border-gray-500/50', bg: 'bg-gray-500/10', tag: 'bg-gray-500/20 text-gray-300' }
}

// Map department names
const departmentNames = {
  'Finance': '財務部門',
  'Marketing': '行銷部門',
  'Engineering': '工程部門',
  'openclaw': 'OpenClaw 開發團隊',
  'claude': 'Claude Code 團隊',
  'claude-coworker': 'Claude Code Coworker',
  'default': '一般部門'
}

// Mini Agent Card for department accordion
function MiniAgentCard({ agent }) {
  const isActive = agent.isActive
  const isError = agent.status === 'error' || agent.summary?.title?.includes('Error')
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass rounded-xl p-3 hover:bg-white/5 transition-colors cursor-pointer group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
          isActive ? 'bg-gradient-to-br from-violet-600 to-purple-600' : 'bg-gray-700'
        }`}>
          {agent.agentDisplayName?.charAt(0) || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{agent.agentDisplayName}</p>
          <p className="text-xs text-gray-500 truncate">{agent.taskName}</p>
        </div>
        {isActive && (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${isError ? 'bg-red-500' : 'bg-gradient-to-r from-violet-500 to-purple-500'}`}
            style={{ width: `${agent.progress || 0}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 w-10 text-right">{agent.progress || 0}%</span>
      </div>
    </motion.div>
  )
}

// Department Accordion
function DepartmentAccordion({ department, agents, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const colors = departmentColors[department.id] || departmentColors.default
  
  const runningCount = agents.filter(a => a.isActive || a.status === 'active').length
  const idleCount = agents.length - runningCount

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-2xl overflow-hidden border ${colors.border}`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
            {department.id.includes('claude') ? (
              <Cpu className="w-5 h-5 text-purple-400" />
            ) : (
              <Bot className="w-5 h-5 text-violet-400" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-semibold">{departmentNames[department.id] || department.id}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 text-xs rounded-full ${colors.tag}`}>
                Powered by {department.id.includes('claude') ? 'Claude Code' : 'OpenClaw'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-blue-400">
              <Zap className="w-3 h-3" />
              {runningCount}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Users className="w-3 h-3" />
              {agents.length}
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agents.map(agent => (
                  <MiniAgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Live Pulse Bar
function LivePulseBar({ sessions }) {
  const runningCount = sessions.filter(s => s.isActive || s.status === 'active').length
  const completedCount = sessions.filter(s => s.progress >= 95).length
  const idleCount = sessions.length - runningCount - completedCount
  
  const pulses = [
    { label: 'Running', count: runningCount, color: 'bg-blue-500', text: 'text-blue-400' },
    { label: 'Completed', count: completedCount, color: 'bg-emerald-500', text: 'text-emerald-400' },
    { label: 'Idle', count: idleCount, color: 'bg-gray-500', text: 'text-gray-400' }
  ]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium">即時狀態</span>
      </div>
      <div className="flex items-center gap-6">
        {pulses.map((pulse, idx) => (
          <div key={pulse.label} className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              {pulse.label === 'Running' ? (
                <>
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pulse.color} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${pulse.color}`}></span>
                </>
              ) : (
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${pulse.color}`} />
              )}
            </span>
            <span className={`text-sm ${pulse.text}`}>
              <span className="font-bold">{pulse.count}</span> {pulse.label}
            </span>
            {idx < pulses.length - 1 && <span className="text-gray-700">|</span>}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function OverviewPage({ sessions = [], departments = [] }) {
  // Group sessions by department
  const sessionsByDepartment = useMemo(() => {
    const groups = {}
    
    for (const dept of departments) {
      const deptSessions = sessions.filter(s => s.department === dept.id)
      if (deptSessions.length > 0) {
        groups[dept.id] = {
          ...dept,
          agents: deptSessions
        }
      }
    }
    
    return Object.values(groups)
  }, [sessions, departments])
  
  // Calculate totals
  const totalRunning = sessions.filter(s => s.isActive || s.status === 'active').length
  const totalCompleted = sessions.filter(s => s.progress >= 95).length
  const totalAgents = sessions.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">總覽</h1>
        <p className="text-sm text-gray-400 mt-1">
          監控 {totalAgents} 個 AI 員工 · {totalRunning} 進行中 · {totalCompleted} 已完成
        </p>
      </div>
      
      {/* Live Pulse Bar */}
      <LivePulseBar sessions={sessions} />
      
      {/* Department Accordions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          部門監控
        </h2>
        
        {sessionsByDepartment.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bot className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">尚無部門資料</p>
          </div>
        ) : (
          sessionsByDepartment.map((dept, idx) => (
            <DepartmentAccordion
              key={dept.id}
              department={dept}
              agents={dept.agents}
              defaultExpanded={idx === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}

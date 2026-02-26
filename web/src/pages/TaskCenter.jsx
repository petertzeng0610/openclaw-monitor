import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, Filter, Clock, DollarSign, RefreshCw, 
  AlertTriangle, CheckCircle, XCircle, Play, 
  User, ChevronDown, MoreVertical, X, Send,
  Calendar, Bot
} from 'lucide-react'

const API_BASE = '/api'

// Generate mock tasks from sessions
const generateMockTasks = (sessions) => {
  const statusOptions = ['completed', 'running', 'error']
  
  return sessions.map((session, idx) => {
    const status = statusOptions[idx % 3]
    const isError = status === 'error' || session.summary?.title?.includes('Error')
    
    return {
      task_id: session.id,
      title: session.taskName || '未命名任務',
      agent_name: session.agentDisplayName || 'Unknown Agent',
      agent_avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${session.agent || 'default'}`,
      agent_type: session.agent,
      status: isError ? 'error' : status,
      duration: session.timeSpent ? `${Math.round(session.timeSpent / 1000)}s` : `${Math.floor(Math.random() * 120) + 5}s`,
      cost: `$${(Math.random() * 0.05 + 0.001).toFixed(3)}`,
      timestamp: session.updatedAt ? new Date(session.updatedAt).toLocaleString('zh-TW') : new Date().toLocaleString('zh-TW'),
      summary: session.summary?.title || '任務執行中...',
      is_error: isError,
      department: session.department
    }
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// Human takeover modal
function HumanTakeoverModal({ task, isOpen, onClose, onSubmit }) {
  const [command, setCommand] = useState('')
  
  if (!isOpen || !task) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            人工接手任務
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <div className="mb-4">
            <label className="text-sm text-gray-400">任務名稱</label>
            <p className="font-medium">{task.title}</p>
          </div>
          
          <div className="mb-4">
            <label className="text-sm text-gray-400">錯誤訊息</label>
            <div className="glass bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              {task.summary}
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-400">修正指令</label>
            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="輸入修正指令或備註..."
              className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-2 focus:outline-none focus:ring-2 focus:ring-violet-500 h-32 resize-none"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 glass rounded-xl hover:bg-white/10"
          >
            取消
          </button>
          <button
            onClick={() => {
              onSubmit(task.task_id, command)
              onClose()
            }}
            disabled={!command.trim()}
            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            提交修正
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Task action menu for error tasks
function TaskActions({ task, onRetry, onHumanTakeover }) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (task.status !== 'error') return null
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 glass rounded-lg hover:bg-white/10"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 glass w-36 py-1 z-20"
          >
            <button 
              onClick={() => {
                onRetry(task.task_id)
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-blue-400" />
              重試任務
            </button>
            <button 
              onClick={() => {
                onHumanTakeover(task)
                setIsOpen(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
            >
              <User className="w-4 h-4 text-orange-400" />
              人工接手
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Status badge component
function StatusBadge({ status }) {
  const config = {
    running: { color: 'bg-blue-500', text: 'text-blue-400', label: '進行中', animate: true },
    completed: { color: 'bg-emerald-500', text: 'text-emerald-400', label: '已完成', animate: false },
    error: { color: 'bg-red-500', text: 'text-red-400', label: '異常', animate: false }
  }
  
  const { color, text, label, animate } = config[status] || config.running
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}/20 ${text}`}>
      {animate && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`}></span>
        </span>
      )}
      {!animate && (
        status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />
      )}
      {label}
    </span>
  )
}

// Single task row
function TaskRow({ task, onRetry, onHumanTakeover }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass rounded-xl p-4 hover:bg-white/5 transition-colors group"
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <img 
          src={task.agent_avatar} 
          alt={task.agent_name}
          className="w-10 h-10 rounded-xl bg-gray-700 flex-shrink-0"
        />
        
        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium truncate">{task.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={task.status} />
                <span className="text-xs text-gray-500">{task.timestamp}</span>
              </div>
            </div>
            
            <TaskActions 
              task={task} 
              onRetry={onRetry}
              onHumanTakeover={onHumanTakeover}
            />
          </div>
          
          {/* Summary */}
          <p className="text-sm text-gray-400 mt-2 line-clamp-2">{task.summary}</p>
          
          {/* Stats - hidden on mobile */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 hidden md:flex">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {task.duration}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {task.cost}
            </span>
            <span className="flex items-center gap-1">
              <Bot className="w-3 h-3" />
              {task.agent_name}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function TaskCenter({ sessions = [] }) {
  const [tasks, setTasks] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgent, setSelectedAgent] = useState('all')
  const [errorOnly, setErrorOnly] = useState(false)
  const [showHumanTakeover, setShowHumanTakeover] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  
  // Generate tasks from sessions
  useEffect(() => {
    if (sessions.length > 0) {
      const mockTasks = generateMockTasks(sessions)
      
      // Add some additional mock tasks for demo
      const additionalTasks = [
        {
          task_id: 'task-demo-1',
          title: '自動化 API 文件生成',
          agent_name: 'Claude Code Assistant',
          agent_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=claude-code',
          agent_type: 'claude-assistant',
          status: 'running',
          duration: '2m 30s',
          cost: '$0.045',
          timestamp: new Date().toLocaleString('zh-TW'),
          summary: '正在分析 OpenAPI 規範並生成 Markdown 文件...',
          is_error: false,
          department: 'claude'
        },
        {
          task_id: 'task-demo-2',
          title: '資安漏洞掃描報告',
          agent_name: 'Security Analyst',
          agent_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=security',
          agent_type: 'main',
          status: 'completed',
          duration: '5m 12s',
          cost: '$0.128',
          timestamp: new Date(Date.now() - 3600000).toLocaleString('zh-TW'),
          summary: '掃描完成：發現 3 個低風險漏洞，無高風險問題。',
          is_error: false,
          department: 'openclaw'
        },
        {
          task_id: 'task-demo-3',
          title: '數據庫遷移腳本驗證',
          agent_name: 'DevOps Agent',
          agent_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=devops',
          agent_type: 'claude-coworker',
          status: 'error',
          duration: '45s',
          cost: '$0.008',
          timestamp: new Date(Date.now() - 7200000).toLocaleString('zh-TW'),
          summary: 'Error: Connection timeout - 數據庫連線逾時',
          is_error: true,
          department: 'claude-coworker'
        }
      ]
      
      setTasks([...additionalTasks, ...mockTasks])
    }
  }, [sessions])
  
  // Get unique agents for filter
  const agents = useMemo(() => {
    const agentSet = new Set(tasks.map(t => t.agent_name))
    return ['all', ...Array.from(agentSet)]
  }, [tasks])
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!task.title.toLowerCase().includes(query) && 
            !task.summary.toLowerCase().includes(query)) {
          return false
        }
      }
      
      // Agent filter
      if (selectedAgent !== 'all' && task.agent_name !== selectedAgent) {
        return false
      }
      
      // Error only filter
      if (errorOnly && task.status !== 'error') {
        return false
      }
      
      return true
    })
  }, [tasks, searchQuery, selectedAgent, errorOnly])
  
  const handleRetry = (taskId) => {
    console.log('Retrying task:', taskId)
    setTasks(prev => prev.map(t => 
      t.task_id === taskId 
        ? { ...t, status: 'running', summary: '正在重試任務...' }
        : t
    ))
  }
  
  const handleHumanTakeover = (task) => {
    setSelectedTask(task)
    setShowHumanTakeover(true)
  }
  
  const handleSubmitCorrection = (taskId, command) => {
    console.log('Submitting correction for:', taskId, command)
    setTasks(prev => prev.map(t => 
      t.task_id === taskId 
        ? { ...t, status: 'running', summary: `人工介入：${command}` }
        : t
    ))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">任務中心</h1>
          <p className="text-sm text-gray-400">
            共 {filteredTasks.length} 個任務
            {errorOnly && ' (僅異常)'}
          </p>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋任務名稱或成果..."
              className="w-full glass bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          
          {/* Agent filter */}
          <div className="relative">
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="glass bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 appearance-none pr-10"
            >
              <option value="all">所有 Agent</option>
              {agents.filter(a => a !== 'all').map(agent => (
                <option key={agent} value={agent}>{agent}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          
          {/* Error toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <div 
              onClick={() => setErrorOnly(!errorOnly)}
              className={`w-11 h-6 rounded-full transition-colors relative ${errorOnly ? 'bg-red-500' : 'bg-gray-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${errorOnly ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-gray-400">僅看異常</span>
          </label>
        </div>
      </div>
      
      {/* Task List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredTasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-12 text-center"
            >
              <Search className="w-12 h-12 mx-auto text-gray-600 mb-4" />
              <p className="text-gray-400">沒有找到符合條件的任務</p>
            </motion.div>
          ) : (
            filteredTasks.map(task => (
              <TaskRow 
                key={task.task_id}
                task={task}
                onRetry={handleRetry}
                onHumanTakeover={handleHumanTakeover}
              />
            ))
          )}
        </AnimatePresence>
      </div>
      
      {/* Human Takeover Modal */}
      <HumanTakeoverModal
        task={selectedTask}
        isOpen={showHumanTakeover}
        onClose={() => setShowHumanTakeover(false)}
        onSubmit={handleSubmitCorrection}
      />
    </div>
  )
}

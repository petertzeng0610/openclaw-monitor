import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, RefreshCw, User, Cpu, DollarSign, 
  Sparkles, Clock, CheckCircle
} from 'lucide-react'
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip
} from 'recharts'

const API_BASE = '/api'

// Generate mock skills based on agent type
const generateAgentSkills = (agentType, existingSkills = []) => {
  const baseSkills = [
    { name: 'Code Review', score: 85, description: '程式碼審查與漏洞檢測' },
    { name: 'Log Analysis', score: 78, description: '日誌分析與異常偵測' },
    { name: 'Documentation', score: 65, description: '技術文件撰寫' },
    { name: 'Testing', score: 72, description: '自動化測試' },
    { name: 'DevOps', score: 68, description: '部署與維運' },
    { name: 'Security', score: 90, description: '資安分析與滲透測試' },
  ]
  
  // Add random variation based on agent ID
  const variation = (agentType || '').length % 10
  return baseSkills.map(skill => ({
    ...skill,
    score: Math.min(100, Math.max(40, skill.score + variation - 5))
  }))
}

// Map agent types to job titles
const agentJobTitles = {
  'main': '資深專案協調者',
  'coding-agent': '自動化開發工程師',
  'claude-assistant': 'AI 技術顧問',
  'claude-coworker': '智慧協作夥伴',
  'default': 'AI 任務執行者'
}

// Map agent types to models
const agentModels = {
  'main': 'Claude 3.5 Sonnet',
  'coding-agent': 'Claude 3.5 Opus',
  'claude-assistant': 'Claude 3.5 Sonnet',
  'claude-coworker': 'Claude 3.5 Opus',
  'default': 'Claude 3.5 Sonnet'
}

export default function AgentProfileModal({ agent, isOpen, onClose, skills = [] }) {
  const [syncing, setSyncing] = useState(false)
  const [localSkills, setLocalSkills] = useState([])
  
  // Get job title based on agent type
  const jobTitle = agentJobTitles[agent?.agent] || agentJobTitles['default']
  const modelName = agentModels[agent?.agent] || agentModels['default']
  const billingType = agent?.agent === 'claude-coworker' ? '按量計費' : '訂閱制'
  const baseCost = agent?.agent === 'claude-coworker' ? 0 : 20

  useEffect(() => {
    if (isOpen && skills.length > 0) {
      setLocalSkills(skills.slice(0, 6)) // Use up to 6 skills for radar
    } else if (isOpen && agent) {
      // Generate mock skills if no backend skills
      setLocalSkills(generateAgentSkills(agent.agent, skills))
    }
  }, [isOpen, agent, skills])

  const handleSyncSkills = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`${API_BASE}/agents/sync-skills`, { method: 'POST' })
      const data = await res.json()
      if (data.skills) {
        setLocalSkills(data.skills.slice(0, 6))
      }
    } catch (err) {
      console.error('Failed to sync skills:', err)
    } finally {
      setSyncing(false)
    }
  }

  if (!isOpen || !agent) return null

  // Prepare radar chart data
  const radarData = localSkills.map(skill => ({
    skill: skill.name,
    score: skill.score,
    fullMark: 100
  }))

  return (
    <AnimatePresence>
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
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-2xl">
                  {agent.agentDisplayName?.charAt(0) || '🤖'}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{agent.agentDisplayName}</h2>
                  <p className="text-gray-400">{jobTitle}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      billingType === '訂閱制' 
                        ? 'bg-violet-500/20 text-violet-300' 
                        : 'bg-orange-500/20 text-orange-300'
                    }`}>
                      {billingType}
                    </span>
                    <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full">
                      {modelName}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Task Info */}
            <div className="mb-6">
              <h3 className="text-sm text-gray-400 mb-2">當前任務</h3>
              <div className="glass rounded-xl p-4">
                <p className="font-medium">{agent.taskName}</p>
                <p className="text-sm text-gray-400 mt-1">{agent.summary?.title}</p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="glass rounded-xl p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto text-orange-400 mb-1" />
                <p className="text-lg font-bold">${baseCost}</p>
                <p className="text-xs text-gray-400">/月</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-emerald-400 mb-1" />
                <p className="text-lg font-bold">{agent.progress}%</p>
                <p className="text-xs text-gray-400">完成度</p>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <Cpu className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                <p className="text-lg font-bold">{agent.messages || 0}</p>
                <p className="text-xs text-gray-400">對話數</p>
              </div>
            </div>

            {/* Skill Radar Chart */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-gray-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  技能矩陣 (Skill Matrix)
                </h3>
                <button
                  onClick={handleSyncSkills}
                  disabled={syncing}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  重新掃描
                </button>
              </div>
              
              <div className="glass rounded-xl p-4">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis 
                        dataKey="skill" 
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                      />
                      <Radar
                        name="Skill Score"
                        dataKey="score"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.6}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>點擊「重新掃描」載入技能資料</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Skills List */}
            {localSkills.length > 0 && (
              <div>
                <h3 className="text-sm text-gray-400 mb-3">技能詳情</h3>
                <div className="space-y-2">
                  {localSkills.map((skill, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 glass rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{skill.name}</p>
                        <p className="text-xs text-gray-500">{skill.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                            style={{ width: `${skill.score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{skill.score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl hover:from-violet-500 hover:to-purple-500 transition-colors"
            >
              關閉
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

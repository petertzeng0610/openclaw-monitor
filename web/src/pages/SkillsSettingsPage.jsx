import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Trash2, Edit2, Save, X, TestTube, 
  Download, Upload, RefreshCw, Check, AlertCircle,
  Settings, Users, Building
} from 'lucide-react'

const API_BASE = '/api'

const DEPARTMENTS = [
  { id: 'general', name: '一般部門', emoji: '📁' },
  { id: 'engineering', name: '工程部', emoji: '💻' },
  { id: 'design', name: '設計部', emoji: '🎨' },
  { id: 'marketing', name: '行銷部', emoji: '📢' },
  { id: 'sales', name: '銷售部', emoji: '💰' },
  { id: 'security', name: '資安部', emoji: '🔒' },
  { id: 'media', name: '媒體部', emoji: '🎬' },
  { id: 'finance', name: '財務部', emoji: '📊' },
]

const EMOJIS = ['🧩', '✨', '🐙', '📧', '🔒', '🛠️', '🎨', '🎬', '🌤️', '📊', '🔧', '🚀', '📝', '🎵', '📸', '🤖']

export default function SkillsSettingsPage() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState(null)
  const [testingSkill, setTestingSkill] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('skills')

  const [newSkill, setNewSkill] = useState({
    name: '',
    label: '',
    emoji: '🔧',
    description: '',
    department: 'general',
    workspace: 'main'
  })

  useEffect(() => {
    fetchSkills()
  }, [])

  const fetchSkills = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/skills`)
      const data = await res.json()
      setSkills(data)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    }
    setLoading(false)
  }

  const handleAddSkill = async () => {
    if (!newSkill.name || !newSkill.label) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSkill)
      })
      if (res.ok) {
        await fetchSkills()
        setShowAddModal(false)
        setNewSkill({ name: '', label: '', emoji: '🔧', description: '', department: 'general', workspace: 'main' })
      }
    } catch (err) {
      console.error('Failed to add skill:', err)
    }
    setSaving(false)
  }

  const handleUpdateSkill = async () => {
    if (!editingSkill) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/skills/${editingSkill.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingSkill)
      })
      if (res.ok) {
        await fetchSkills()
        setEditingSkill(null)
      }
    } catch (err) {
      console.error('Failed to update skill:', err)
    }
    setSaving(false)
  }

  const handleDeleteSkill = async (name) => {
    if (!confirm(`確定要刪除技能「${name}」嗎？`)) return
    try {
      const res = await fetch(`${API_BASE}/skills/${name}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchSkills()
      }
    } catch (err) {
      console.error('Failed to delete skill:', err)
    }
  }

  const handleTestSkill = async (skill) => {
    setTestingSkill(skill.name)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/skills/${skill.name}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResult(data)
    } catch (err) {
      setTestResult({ success: false, error: err.message })
    }
    setTestingSkill(null)
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(skills, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nova-skills.json'
    a.click()
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const importedSkills = JSON.parse(event.target.result)
        for (const skill of importedSkills) {
          await fetch(`${API_BASE}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(skill)
          })
        }
        await fetchSkills()
      } catch (err) {
        alert('匯入失敗：' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const groupedSkills = skills.reduce((acc, skill) => {
    const dept = skill.department || 'general'
    if (!acc[dept]) acc[dept] = []
    acc[dept].push(skill)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text">技能設定</h1>
          <p className="text-gray-400 text-sm mt-1">管理 AI 助手技能、部门與工作區</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            匯出
          </button>
          <label className="flex items-center gap-2 px-3 py-2 glass rounded-lg hover:bg-white/10 transition-colors text-sm cursor-pointer">
            <Upload className="w-4 h-4" />
            匯入
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'skills' ? 'bg-violet-600 text-white' : 'glass hover:bg-white/10'
          }`}
        >
          <Settings className="w-4 h-4" />
          技能管理
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === 'departments' ? 'bg-violet-600 text-white' : 'glass hover:bg-white/10'
          }`}
        >
          <Building className="w-4 h-4" />
          部門配置
        </button>
      </div>

      {activeTab === 'skills' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg hover:from-violet-500 hover:to-purple-500 transition-colors mb-6"
          >
            <Plus className="w-4 h-4" />
            新增技能
          </button>

          {/* Skills Grid by Department */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
              載入中...
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSkills).map(([dept, deptSkills]) => (
                <div key={dept} className="glass-card rounded-xl p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <span>{DEPARTMENTS.find(d => d.id === dept)?.emoji || '📁'}</span>
                    {DEPARTMENTS.find(d => d.id === dept)?.name || dept}
                    <span className="text-gray-500 text-sm">({deptSkills.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deptSkills.map((skill) => (
                      <div key={skill.name} className="glass rounded-lg p-3 flex items-start gap-3">
                        <span className="text-2xl">{skill.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{skill.label}</h4>
                          <p className="text-xs text-gray-500 truncate">{skill.description}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            📁 {skill.department} | 📂 {skill.workspace}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleTestSkill(skill)}
                            disabled={testingSkill === skill.name}
                            className="p-1.5 hover:bg-white/10 rounded text-blue-400 disabled:opacity-50"
                            title="測試技能"
                          >
                            {testingSkill === skill.name ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingSkill({ ...skill })}
                            className="p-1.5 hover:bg-white/10 rounded text-yellow-400"
                            title="編輯"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSkill(skill.name)}
                            className="p-1.5 hover:bg-white/10 rounded text-red-400"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'departments' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept) => {
              const deptSkills = skills.filter(s => s.department === dept.id)
              return (
                <div key={dept.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{dept.emoji}</span>
                    <div>
                      <h3 className="font-semibold">{dept.name}</h3>
                      <p className="text-xs text-gray-500">{deptSkills.length} 個技能</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {deptSkills.map((skill) => (
                      <span key={skill.name} className="px-2 py-1 bg-white/5 rounded text-xs">
                        {skill.emoji} {skill.label}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">新增技能</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">技能代號</label>
                  <input
                    type="text"
                    value={newSkill.name}
                    onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                    placeholder="例如: my-skill"
                    className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">顯示名稱</label>
                  <input
                    type="text"
                    value={newSkill.label}
                    onChange={(e) => setNewSkill({ ...newSkill, label: e.target.value })}
                    placeholder="例如: 我的技能"
                    className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">圖示</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewSkill({ ...newSkill, emoji })}
                        className={`w-8 h-8 rounded-lg text-lg ${
                          newSkill.emoji === emoji ? 'bg-violet-600' : 'glass hover:bg-white/10'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">描述</label>
                  <input
                    type="text"
                    value={newSkill.description}
                    onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
                    placeholder="技能描述"
                    className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">部門</label>
                    <select
                      value={newSkill.department}
                      onChange={(e) => setNewSkill({ ...newSkill, department: e.target.value })}
                      className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.emoji} {dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">工作區</label>
                    <input
                      type="text"
                      value={newSkill.workspace}
                      onChange={(e) => setNewSkill({ ...newSkill, workspace: e.target.value })}
                      placeholder="main"
                      className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 glass rounded-lg hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSkill}
                  disabled={saving || !newSkill.name || !newSkill.label}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg disabled:opacity-50"
                >
                  {saving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingSkill && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingSkill(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">編輯技能</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">顯示名稱</label>
                  <input
                    type="text"
                    value={editingSkill.label}
                    onChange={(e) => setEditingSkill({ ...editingSkill, label: e.target.value })}
                    className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">圖示</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditingSkill({ ...editingSkill, emoji })}
                        className={`w-8 h-8 rounded-lg text-lg ${
                          editingSkill.emoji === emoji ? 'bg-violet-600' : 'glass hover:bg-white/10'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">描述</label>
                  <input
                    type="text"
                    value={editingSkill.description}
                    onChange={(e) => setEditingSkill({ ...editingSkill, description: e.target.value })}
                    className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">部門</label>
                    <select
                      value={editingSkill.department}
                      onChange={(e) => setEditingSkill({ ...editingSkill, department: e.target.value })}
                      className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.emoji} {dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">工作區</label>
                    <input
                      type="text"
                      value={editingSkill.workspace}
                      onChange={(e) => setEditingSkill({ ...editingSkill, workspace: e.target.value })}
                      className="w-full glass px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditingSkill(null)}
                  className="flex-1 px-4 py-2 glass rounded-lg hover:bg-white/10"
                >
                  取消
                </button>
                <button
                  onClick={handleUpdateSkill}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg disabled:opacity-50"
                >
                  {saving ? '儲存中...' : '儲存'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Result Toast */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 p-4 rounded-xl max-w-sm ${
              testResult.success ? 'bg-emerald-600/90' : 'bg-red-600/90'
            }`}
          >
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <Check className="w-5 h-5 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{testResult.success ? '測試成功' : '測試失敗'}</p>
                <p className="text-sm opacity-90">{testResult.result || testResult.error}</p>
              </div>
              <button onClick={() => setTestResult(null)} className="ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Settings, DollarSign, Cpu, Clock, Plus, Trash2, 
  Save, RotateCcw, CheckCircle
} from 'lucide-react'

const DEFAULT_MODEL_PRICING = {
  'claude-opus-4-6': 0.015,
  'claude-opus-4-6-output': 0.075,
  'claude-sonnet-4-5': 0.003,
  'claude-sonnet-4-5-output': 0.015,
}

const DEFAULT_TASK_MAPPING = {
  'main': 4,
  'coding-agent': 3,
  'claude-assistant': 2,
  'claude-coworker': 2.5,
}

export default function SettingsPage({ settings, onUpdate, onSave, onReset, isDirty }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [newModelKey, setNewModelKey] = useState('')
  const [newModelPrice, setNewModelPrice] = useState('')
  const [newTaskType, setNewTaskType] = useState('')
  const [newTaskHours, setNewTaskHours] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleChange = (path, value) => {
    const keys = path.split('.')
    setLocalSettings(prev => {
      const newSettings = { ...prev }
      let obj = newSettings
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] }
        obj = obj[keys[i]]
      }
      obj[keys[keys.length - 1]] = value
      return newSettings
    })
  }

  const handleAddModel = () => {
    if (newModelKey && newModelPrice) {
      setLocalSettings(prev => ({
        ...prev,
        modelPricing: {
          ...prev.modelPricing,
          [newModelKey]: parseFloat(newModelPrice)
        }
      }))
      setNewModelKey('')
      setNewModelPrice('')
    }
  }

  const handleRemoveModel = (key) => {
    setLocalSettings(prev => {
      const { [key]: _, ...rest } = prev.modelPricing
      return { ...prev, modelPricing: rest }
    })
  }

  const handleAddTaskMapping = () => {
    if (newTaskType && newTaskHours) {
      setLocalSettings(prev => ({
        ...prev,
        taskValueMapping: {
          ...prev.taskValueMapping,
          [newTaskType]: parseFloat(newTaskHours)
        }
      }))
      setNewTaskType('')
      setNewTaskHours('')
    }
  }

  const handleRemoveTaskMapping = (key) => {
    setLocalSettings(prev => {
      const { [key]: _, ...rest } = prev.taskValueMapping
      return { ...prev, taskValueMapping: rest }
    })
  }

  const handleSave = () => {
    onUpdate(localSettings)
    onSave()
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">系統設定</h1>
          <p className="text-gray-400 mt-1">配置參數以自定義指標計算邏輯</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 glass rounded-xl hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重設
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              isDirty 
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500' 
                : 'bg-gray-700 cursor-not-allowed'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                已儲存
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                儲存變更
              </>
            )}
          </button>
        </div>
      </div>

      {/* Labor Cost Parameters */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">人工成本參數</h2>
            <p className="text-sm text-gray-400">設定人工時薪與 FTE 標準</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">平均人工時薪 (TWD)</label>
            <input
              type="number"
              value={localSettings.hourlyRate}
              onChange={(e) => handleChange('hourlyRate', parseFloat(e.target.value) || 0)}
              className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-gray-500 mt-1">例如：500 TWD = 約 $16 USD</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">標準每月工時 (小時)</label>
            <input
              type="number"
              value={localSettings.fteStandardHours}
              onChange={(e) => handleChange('fteStandardHours', parseFloat(e.target.value) || 160)}
              className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-gray-500 mt-1">預設：160 小時 / 月</p>
          </div>
        </div>
      </motion.div>

      {/* LLM Cost Configuration */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">算力成本配置</h2>
            <p className="text-sm text-gray-400">設定訂閱費用與模型單價</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">訂閱制固定成本 (USD / 月)</label>
          <input
            type="number"
            value={localSettings.fixedMonthlySubscription}
            onChange={(e) => handleChange('fixedMonthlySubscription', parseFloat(e.target.value) || 0)}
            className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-3">模型單價 (USD / 1k Tokens)</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Object.entries(localSettings.modelPricing).map(([model, price]) => (
              <div key={model} className="flex items-center gap-3 p-2 glass rounded-lg">
                <span className="flex-1 text-sm truncate">{model}</span>
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  step="0.001"
                  value={price}
                  onChange={(e) => handleChange(`modelPricing.${model}`, parseFloat(e.target.value) || 0)}
                  className="w-20 glass bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={() => handleRemoveModel(model)}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Add new model */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              placeholder="模型名稱 (如 gpt-4)"
              value={newModelKey}
              onChange={(e) => setNewModelKey(e.target.value)}
              className="flex-1 glass bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <input
              type="number"
              step="0.001"
              placeholder="單價"
              value={newModelPrice}
              onChange={(e) => setNewModelPrice(e.target.value)}
              className="w-24 glass bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleAddModel}
              className="px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Task Value Mapping */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">任務價值權重</h2>
            <p className="text-sm text-gray-400">設定不同 Agent 類型每個任務可節省的工時</p>
          </div>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {Object.entries(localSettings.taskValueMapping).map(([agentType, hours]) => (
            <div key={agentType} className="flex items-center gap-3 p-2 glass rounded-lg">
              <span className="flex-1 text-sm truncate">{agentType}</span>
              <span className="text-gray-400">{hours} 小時</span>
              <input
                type="number"
                step="0.5"
                value={hours}
                onChange={(e) => handleChange(`taskValueMapping.${agentType}`, parseFloat(e.target.value) || 0)}
                className="w-20 glass bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={() => handleRemoveTaskMapping(agentType)}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new task mapping */}
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            placeholder="Agent 類型"
            value={newTaskType}
            onChange={(e) => setNewTaskType(e.target.value)}
            className="flex-1 glass bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <input
            type="number"
            step="0.5"
            placeholder="節省小時"
            value={newTaskHours}
            onChange={(e) => setNewTaskHours(e.target.value)}
            className="w-32 glass bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={handleAddTaskMapping}
            className="px-3 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

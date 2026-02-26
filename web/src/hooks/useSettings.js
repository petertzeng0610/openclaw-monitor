import { useState, useEffect, useCallback } from 'react'

const DEFAULT_SETTINGS = {
  // Labor cost parameters
  hourlyRate: 500, // TWD per hour
  fteStandardHours: 160, // hours per month
  
  // LLM cost configuration
  fixedMonthlySubscription: 79, // USD per month
  modelPricing: {
    'claude-opus-4-6': 0.015, // per 1k input tokens
    'claude-opus-4-6-output': 0.075, // per 1k output tokens
    'claude-sonnet-4-5': 0.003,
    'claude-sonnet-4-5-output': 0.015,
    'gpt-4': 0.03,
    'gpt-4-output': 0.06,
    'gpt-4-turbo': 0.01,
    'gpt-4-turbo-output': 0.03,
    'gpt-3.5-turbo': 0.001,
    'gpt-3.5-turbo-output': 0.002,
    'default': 0.01,
  },
  
  // Task value mapping (hours saved per task by agent type)
  taskValueMapping: {
    'main': 4, // OpenClaw main agent
    'coding-agent': 3,
    'claude-assistant': 2,
    'claude-coworker': 2.5,
    'default': 2
  },
  
  // Display preferences
  currency: 'TWD',
  refreshInterval: 30000
}

export function useSettings() {
  const [settings, setSettings] = useState(() => {
    // Load from localStorage or use defaults
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nova-settings')
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        } catch (e) {
          console.error('Failed to parse settings:', e)
        }
      }
    }
    return DEFAULT_SETTINGS
  })

  const [isDirty, setIsDirty] = useState(false)

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nova-settings', JSON.stringify(settings))
    }
  }, [settings])

  const updateSettings = useCallback((updates) => {
    setSettings(prev => {
      const newSettings = { ...prev }
      
      // Handle nested updates
      if (updates.modelPricing) {
        newSettings.modelPricing = { ...prev.modelPricing, ...updates.modelPricing }
        delete updates.modelPricing
      }
      if (updates.taskValueMapping) {
        newSettings.taskValueMapping = { ...prev.taskValueMapping, ...updates.taskValueMapping }
        delete updates.taskValueMapping
      }
      
      return { ...newSettings, ...updates }
    })
    setIsDirty(true)
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
    setIsDirty(false)
  }, [])

  const saveSettings = useCallback(() => {
    setIsDirty(false)
  }, [])

  // Calculate estimated hours saved for a task based on agent type
  const getHoursSaved = useCallback((agentType) => {
    return settings.taskValueMapping[agentType] || settings.taskValueMapping['default']
  }, [settings.taskValueMapping])

  // Calculate cost for a model based on token usage (estimated)
  const calculateModelCost = useCallback((model, inputTokens, outputTokens) => {
    const inputPrice = settings.modelPricing[`${model}-input`] || settings.modelPricing[model] || settings.modelPricing['default']
    const outputPrice = settings.modelPricing[`${model}-output`] || settings.modelPricing[model] || settings.modelPricing['default']
    
    const inputCost = (inputTokens / 1000) * inputPrice
    const outputCost = (outputTokens / 1000) * outputPrice
    
    return inputCost + outputCost
  }, [settings.modelPricing])

  return {
    settings,
    updateSettings,
    resetSettings,
    saveSettings,
    isDirty,
    getHoursSaved,
    calculateModelCost,
    DEFAULT_SETTINGS
  }
}

// Calculate metrics based on sessions and settings
export function calculateMetrics(sessions, settings) {
  const completedTasks = sessions.filter(s => s.progress >= 95)
  
  // Calculate total hours saved
  let totalHoursSaved = 0
  const hoursByAgentType = {}
  
  completedTasks.forEach(session => {
    const agentType = session.agent || 'default'
    const hoursSaved = settings.taskValueMapping[agentType] || settings.taskValueMapping['default']
    totalHoursSaved += hoursSaved
    
    if (!hoursByAgentType[agentType]) {
      hoursByAgentType[agentType] = 0
    }
    hoursByAgentType[agentType] += hoursSaved
  })
  
  // FTE = total hours saved / standard monthly hours
  const fte = totalHoursSaved / settings.fteStandardHours
  
  // Monthly budget saved = hours saved * hourly rate - LLM cost
  // Convert hourly rate from TWD to USD (approximate rate: 1 USD = 32 TWD)
  const hourlyRateUSD = settings.hourlyRate / 32
  const laborValue = totalHoursSaved * hourlyRateUSD
  const llmCost = settings.fixedMonthlySubscription
  const budgetSaved = laborValue - llmCost
  
  // LLM Spend (accumulated from sessions - mock calculation)
  // In real app, this would come from actual token usage tracking
  const llmSpend = sessions.length * 0.5 // Mock: $0.50 per session on average
  
  return {
    fte: parseFloat(fte.toFixed(1)),
    costSaved: Math.round(budgetSaved),
    llmSpend: parseFloat((llmSpend + settings.fixedMonthlySubscription).toFixed(2)),
    uptime: sessions.length > 0 ? Math.round((completedTasks.length / sessions.length) * 100) : 100,
    totalHoursSaved: parseFloat(totalHoursSaved.toFixed(1)),
    hoursByAgentType,
    completedTasksCount: completedTasks.length
  }
}

import { useState, useCallback, useRef } from 'react'

const API_BASE = '/api'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [skills, setSkills] = useState([
    { name: "coding-agent", label: "程式開發代理", emoji: "🧩", description: "透過 Codex/Claude Code/OpenCode 進行程式開發" },
    { name: "gemini", label: "Gemini 問答", emoji: "✨", description: "使用 Gemini 進行問答、摘要與內容生成" },
    { name: "github", label: "GitHub 操作", emoji: "🐙", description: "透過 gh CLI 管理 Issues、PR、CI" },
    { name: "gog", label: "Google 工具", emoji: "📧", description: "Gmail、日曆、雲端硬碟、試算表、文件" },
    { name: "healthcheck", label: "資安檢查", emoji: "🔒", description: "主機資安強化與風險評估" },
    { name: "skill-creator", label: "技能建立器", emoji: "🛠️", description: "建立或更新 Agent 技能套件" },
    { name: "ui-ux-pro-max", label: "UI/UX 設計", emoji: "🎨", description: "AI 驅動的設計系統產生器" },
    { name: "video-frames", label: "影片擷取", emoji: "🎬", description: "從影片中擷取畫面或短片段" },
    { name: "weather", label: "天氣查詢", emoji: "🌤️", description: "查詢天氣與天氣預報" },
    { name: "ai-ppt-generator", label: "AI 簡報產生器", emoji: "📊", description: "產生專業 PowerPoint 簡報" }
  ])
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const pollRef = useRef(null)

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/skills`)
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) setSkills(data)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    }
  }, [])

  const pollTaskStatus = useCallback((taskId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/chat/status/${taskId}`)
        const data = await res.json()
        
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setIsLoading(false)
          setCurrentTaskId(null)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.result || '任務完成',
            timestamp: Date.now()
          }])
        }
      } catch (err) {
        console.error('Poll error:', err)
        clearInterval(pollRef.current)
        pollRef.current = null
        setIsLoading(false)
      }
    }, 2000)
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !selectedSkill) return

    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: Date.now()
    }])
    setIsLoading(true)

    try {
      const res = await fetch(`${API_BASE}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill: selectedSkill.name, message: text })
      })
      const data = await res.json()
      
      if (data.taskId) {
        setCurrentTaskId(data.taskId)
        pollTaskStatus(data.taskId)
      }
    } catch (err) {
      console.error('Send error:', err)
      setIsLoading(false)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '發送失敗，請稍後再試。',
        timestamp: Date.now()
      }])
    }
  }, [selectedSkill, pollTaskStatus])

  const selectSkill = useCallback((skill) => {
    setSelectedSkill(skill)
    setMessages([{
      role: 'assistant',
      content: `你好！我是 ${skill.emoji} ${skill.label}，有什麼我可以幫你的嗎？`,
      timestamp: Date.now()
    }])
  }, [])

  const clearSkill = useCallback(() => {
    setSelectedSkill(null)
    setMessages([])
    setCurrentTaskId(null)
    setIsLoading(false)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  return { messages, selectedSkill, isLoading, skills, currentTaskId, fetchSkills, sendMessage, selectSkill, clearSkill }
}

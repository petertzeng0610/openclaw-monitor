import { useState, useCallback, useRef } from 'react'

const API_BASE = '/api'

export function useChat() {
  const [messages, setMessages] = useState([])
  const [selectedSkill, setSelectedSkill] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [skills, setSkills] = useState([])
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const pollRef = useRef(null)

  const fetchSkills = useCallback(async (department = null) => {
    try {
      const url = department 
        ? `${API_BASE}/skills?department=${department}`
        : `${API_BASE}/skills`
      const res = await fetch(url)
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

import { useState, useEffect, useCallback } from 'react'

const API_BASE = '/api'
const POLL_INTERVAL = 10000 // 10 seconds
const AUTH_TOKEN = 'nova-bridge-secret-2024'

export function useBridgeSkills() {
  const [bridgeSkills, setBridgeSkills] = useState([])
  const [bridgeAgents, setBridgeAgents] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [isPolling, setIsPolling] = useState(false)

  const fetchBridgeSkills = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/bridge/status`, {
        headers: {
          'x-auth-token': AUTH_TOKEN
        }
      })
      if (res.ok) {
        const data = await res.json()
        
        // Update agents
        if (data.agents && data.agents.length > 0) {
          setBridgeAgents(data.agents)
          
          // Extract skills from agents
          const allSkills = []
          data.agents.forEach(agent => {
            if (agent.skills && Array.isArray(agent.skills)) {
              agent.skills.forEach((skill, idx) => {
                const skillName = typeof skill === 'string' ? skill : skill.name
                const skillScore = typeof skill === 'object' ? skill.score : 70 + (idx * 5)
                allSkills.push({
                  name: skillName,
                  score: skillScore,
                  description: `Skills from ${agent.name}`,
                  source: agent.name
                })
              })
            }
          })
          
          // Also check for direct skills in the response
          if (data.skills && data.skills.length > 0) {
            allSkills.push(...data.skills)
          }
          
          setBridgeSkills(allSkills)
        }
        
        if (data.lastSync) {
          setLastSync(data.lastSync)
        }
      }
    } catch (err) {
      console.log('[Bridge] Polling error:', err.message)
    }
  }, [])

  // Poll every 10 seconds when modal is open
  useEffect(() => {
    fetchBridgeSkills()
    setIsPolling(true)
    
    const interval = setInterval(fetchBridgeSkills, POLL_INTERVAL)
    
    return () => {
      clearInterval(interval)
      setIsPolling(false)
    }
  }, [fetchBridgeSkills])

  return {
    bridgeSkills,
    bridgeAgents,
    lastSync,
    isPolling,
    refetch: fetchBridgeSkills
  }
}

export default useBridgeSkills

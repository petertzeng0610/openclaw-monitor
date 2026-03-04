import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Filter } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import SkillCard from '../components/SkillCard'
import ChatWindow from '../components/ChatWindow'

const DEPARTMENTS = [
  { id: 'all', name: '全部', emoji: '🌟' },
  { id: 'general', name: '一般', emoji: '📁' },
  { id: 'engineering', name: '工程', emoji: '💻' },
  { id: 'design', name: '設計', emoji: '🎨' },
  { id: 'marketing', name: '行銷', emoji: '📢' },
  { id: 'sales', name: '銷售', emoji: '💰' },
  { id: 'security', name: '資安', emoji: '🔒' },
  { id: 'media', name: '媒體', emoji: '🎬' },
  { id: 'finance', name: '財務', emoji: '📊' },
]

export default function ChatPage() {
  const { messages, selectedSkill, isLoading, skills, fetchSkills, sendMessage, selectSkill, clearSkill } = useChat()
  const [selectedDept, setSelectedDept] = useState('all')

  useEffect(() => {
    fetchSkills(selectedDept === 'all' ? null : selectedDept)
  }, [fetchSkills, selectedDept])

  const filteredSkills = selectedDept === 'all' 
    ? skills 
    : skills.filter(s => s.department === selectedDept)

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <AnimatePresence mode="wait">
        {!selectedSkill ? (
          <motion.div
            key="skills"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 overflow-y-auto"
          >
            {/* Welcome */}
            <div className="text-center mb-6">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl font-bold gradient-text mb-2"
              >
                AI 助手
              </motion.h2>
              <p className="text-gray-400">選擇一個 AI 助手功能開始</p>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2 mb-6 px-4 overflow-x-auto pb-2">
              <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    selectedDept === dept.id 
                      ? 'bg-violet-600 text-white' 
                      : 'glass hover:bg-white/10'
                  }`}
                >
                  {dept.emoji} {dept.name}
                </button>
              ))}
            </div>

            {/* Skill Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-4">
              {filteredSkills.map((skill, i) => (
                <motion.div
                  key={skill.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <SkillCard skill={skill} onClick={selectSkill} />
                </motion.div>
              ))}
            </div>
            
            {filteredSkills.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>該部門暫無技能</p>
                <p className="text-sm mt-2">請至「技能設定」頁面新增技能</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col glass-card overflow-hidden"
          >
            {/* Chat Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10">
              <button
                onClick={clearSkill}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-400" />
              </button>
              <span className="text-2xl">{selectedSkill.emoji}</span>
              <div className="flex-1">
                <h3 className="font-semibold">{selectedSkill.label}</h3>
                <p className="text-xs text-gray-400">{selectedSkill.description}</p>
              </div>
              <div className="text-xs text-gray-500">
                📂 {selectedSkill.workspace || 'main'}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden">
              <ChatWindow messages={messages} isLoading={isLoading} onSend={sendMessage} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

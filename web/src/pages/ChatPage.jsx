import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import SkillCard from '../components/SkillCard'
import ChatWindow from '../components/ChatWindow'

export default function ChatPage() {
  const { messages, selectedSkill, isLoading, skills, fetchSkills, sendMessage, selectSkill, clearSkill } = useChat()

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

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
            <div className="text-center mb-8">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-3xl font-bold gradient-text mb-2"
              >
                AI 助手
              </motion.h2>
              <p className="text-gray-400">選擇一個 AI 助手功能開始</p>
            </div>

            {/* Skill Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {skills.map((skill, i) => (
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
              <div>
                <h3 className="font-semibold">{selectedSkill.label}</h3>
                <p className="text-xs text-gray-400">{selectedSkill.description}</p>
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

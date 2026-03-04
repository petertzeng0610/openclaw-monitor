import React from 'react'
import { motion } from 'framer-motion'

export default function SkillCard({ skill, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(skill)}
      className="glass-card p-5 text-left group relative overflow-hidden"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/0 to-purple-600/0 group-hover:from-violet-600/10 group-hover:to-purple-600/10 transition-all duration-300 rounded-xl" />
      
      <div className="relative z-10">
        <div className="text-3xl mb-3">{skill.emoji}</div>
        <h3 className="font-semibold text-white mb-1">{skill.label}</h3>
        <p className="text-xs text-gray-400 leading-relaxed">{skill.description}</p>
      </div>
    </motion.button>
  )
}

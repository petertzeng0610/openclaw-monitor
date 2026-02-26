import React from 'react'
import { motion } from 'framer-motion'
import { Users, Settings, Bot } from 'lucide-react'

// This is a wrapper that shows the department sections for the Employees view
// It will use the same department sections but with different styling/layout
export default function EmployeesPage({ sessions = [], departments = [] }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-400" />
            AI 員工
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            管理 {sessions.length} 個 AI 員工個體
          </p>
        </div>
      </div>
      
      {/* Note: The actual agent grid is rendered in App.jsx when activeView === 'employees' */}
      {/* This page acts as a wrapper for consistency in routing */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-5 h-5 text-violet-400" />
          <h2 className="font-semibold">員工列表</h2>
        </div>
        <p className="text-gray-400 text-sm">
          下方顯示所有部門的 AI 員工卡片。點擊卡片可查看詳細檔案與技能矩陣。
        </p>
      </div>
    </div>
  )
}

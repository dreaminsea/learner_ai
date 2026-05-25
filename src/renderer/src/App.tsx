import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import PlanPage from './pages/PlanPage'
import PlanDetailPage from './pages/PlanDetailPage'
import LecturePage from './pages/LecturePage'
import KnowledgeGraphPage from './pages/KnowledgeGraphPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/plan/create" element={<Navigate to="/" replace />} />
            <Route path="/plan/:id" element={<PlanDetailPage />} />
            <Route path="/lecture" element={<LecturePage />} />
            <Route path="/lecture/:taskId" element={<LecturePage />} />
            <Route path="/graph" element={<KnowledgeGraphPage />} />
            <Route path="/chat" element={<Navigate to="/" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

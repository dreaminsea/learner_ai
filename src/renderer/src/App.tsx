import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import PlanPage from './pages/PlanPage'
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/lecture" element={<LecturePage />} />
            <Route path="/graph" element={<KnowledgeGraphPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

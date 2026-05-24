import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  GitGraph,
  MessageCircle,
  Settings
} from 'lucide-react'
import { cn } from '../lib/utils'
import { ROUTES } from '@shared/constants'

const navItems = [
  { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.PLAN, label: '学习计划', icon: BookOpen },
  { to: ROUTES.LECTURE, label: '讲义', icon: GraduationCap },
  { to: ROUTES.GRAPH, label: '知识网络', icon: GitGraph },
  { to: ROUTES.CHAT, label: 'AI 对话', icon: MessageCircle },
  { to: ROUTES.SETTINGS, label: '设置', icon: Settings }
]

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-lg font-semibold tracking-tight">Learner_AI</h1>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3 text-xs text-muted-foreground">
        Learner_AI v0.1.0
      </div>
    </aside>
  )
}

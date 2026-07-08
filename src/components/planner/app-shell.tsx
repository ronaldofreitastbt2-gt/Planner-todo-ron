import { NavLink } from 'react-router-dom'
import { CheckSquare, Calendar, Flame, StickyNote, Settings, Plus } from 'lucide-react'
import { useFabHandler } from '@/hooks/use-fab'
import { BackgroundLayer } from './background-layer'

const NAV_ITEMS = [
  { to: '/tarefas', icon: CheckSquare, label: 'Tarefas' },
  { to: '/calendario', icon: Calendar, label: 'Agenda' },
  { to: '/', icon: Flame, label: 'Início' },
  { to: '/habitos', icon: StickyNote, label: 'Hábitos' },
  { to: '/ajustes', icon: Settings, label: 'Ajustes' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const fabHandler = useFabHandler()

  return (
    <div className="flex min-h-dvh flex-col">
      <BackgroundLayer />
      <main className="relative z-0 flex-1 pb-20 pt-safe">{children}</main>

      {fabHandler && (
        <button
          onClick={fabHandler}
          className="fixed bottom-20 right-5 z-50 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all active:scale-90 hover:shadow-xl hover:shadow-primary/30"
          aria-label="Criar novo"
        >
          <Plus className="size-6" />
        </button>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/80 backdrop-blur-xl pb-safe">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="size-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

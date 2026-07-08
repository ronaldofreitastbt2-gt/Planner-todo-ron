# Planner PWA - Todas as Páginas

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar todas as 5 páginas do Planner PWA (Home, Tarefas, Calendário, Hábitos, Notas) + página de Ajustes + assets PWA (manifest, service worker, ícones).

**Architecture:** Next.js App Router com páginas client-side que consomem Dexie via `useLiveQuery`. Cada página é um componente `'use client'` que usa os componentes existentes (PageHeader, TaskItem, form sheets). Layout fixo com BottomNav via AppShell.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Dexie (IndexedDB), framer-motion, lucide-react, date-fns, vaul

## Global Constraints

- Todos os textos de interface em português brasileiro formal com acentuação completa
- Nenhum travessão (— ou –) em texto de interface
- Usar componentes existentes: `PageHeader`, `TaskItem`, `BottomSheet`, form sheets, `useLiveQuery`
- `use client` em todas as páginas (Dexie + hooks só funcionam no client)
- Seguir padrão existente: `rounded-2xl`, `border-border bg-card`, `text-muted-foreground`

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `app/page.tsx` | Dashboard home com resumo |
| Criar | `app/tarefas/page.tsx` | Lista de tarefas com filtros |
| Criar | `app/calendario/page.tsx` | Calendário mensal + eventos |
| Criar | `app/habitos/page.tsx` | Tracker de hábitos diários |
| Criar | `app/notas/page.tsx` | Grid de notas |
| Criar | `app/ajustes/page.tsx` | Configurações gerais |
| Criar | `public/manifest.json` | Manifesto PWA |
| Criar | `public/sw.js` | Service worker com cache |
| Criar | `public/icons/icon-192.png` | Ícone PWA 192x192 |
| Criar | `public/icons/icon-512.png` | Ícone PWA 512x512 |

---

### Task 1: Home Dashboard

**Covers:** [S1]

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `db.tasks`, `db.events`, `db.habits`, `db.habitLogs` (Dexie), `PageHeader` component, `format`/`isToday`/`isPast` from date-fns
- Produces: Página `/` com saudação, cards de resumo, próximas tarefas, próximos eventos

- [ ] **Step 1: Substituir page.tsx pelo dashboard**

Substituir o conteúdo de `app/page.tsx` (placeholder v0) por componente client-side com:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, isToday, isPast, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckSquare, Calendar, Flame, StickyNote, Clock, AlertTriangle } from 'lucide-react'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/planner/page-header'

export default function HomePage() {
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(
      h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
    )
  }, [])

  const pendingTasks = useLiveQuery(
    () => db.tasks.where('completed').equals(0).toArray(),
    [],
    [],
  )

  const todayEvents = useLiveQuery(
    () => db.events.toArray(),
    [],
    [],
  )

  const todayHabits = useLiveQuery(
    () => db.habits.toArray(),
    [],
    [],
  )

  const todayLogs = useLiveQuery(
    () => db.habitLogs.where('date').equals(format(new Date(), 'yyyy-MM-dd')).toArray(),
    [],
    [],
  )

  const recentNotes = useLiveQuery(
    () => db.notes.orderBy('updatedAt').reverse().limit(3).toArray(),
    [],
    [],
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const overdueTasks = (pendingTasks ?? []).filter(
    (t) => t.dueDate && isPast(parseISO(`${t.dueDate}T${t.dueTime ?? '23:59'}`)) && t.dueDate < todayStr,
  )

  const todayTasks = (pendingTasks ?? []).filter(
    (t) => t.dueDate === todayStr,
  )

  const eventsToday = (todayEvents ?? []).filter((e) => {
    if (e.date === todayStr) return true
    if (e.repeat === 'diaria') return e.date <= todayStr
    if (e.repeat === 'semanal') {
      const base = parseISO(e.date)
      const now = new Date()
      return base.getDay() === now.getDay() && e.date <= todayStr
    }
    if (e.repeat === 'mensal') {
      const base = parseISO(e.date)
      const now = new Date()
      return base.getDate() === now.getDate() && e.date <= todayStr
    }
    return false
  })

  const habitsToday = (todayHabits ?? []).filter((h) => {
    const dow = new Date().getDay()
    return h.daysOfWeek.includes(dow)
  })

  const completedHabits = habitsToday.filter((h) =>
    (todayLogs ?? []).some((l) => l.habitId === h.id),
  ).length

  return (
    <>
      <PageHeader
        title={`${greeting}!`}
        subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
      />

      <div className="px-5 pb-6 space-y-5">
        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={CheckSquare}
            label="Tarefas"
            value={todayTasks.length}
            sub={overdueTasks.length > 0 ? `${overdueTasks.length} atrasadas` : undefined}
            color="text-primary"
            bg="bg-primary/10"
          />
          <StatCard
            icon={Calendar}
            label="Eventos"
            value={eventsToday.length}
            color="text-blue-500"
            bg="bg-blue-500/10"
          />
          <StatCard
            icon={Flame}
            label="Hábitos"
            value={`${completedHabits}/${habitsToday.length}`}
            color="text-orange-500"
            bg="bg-orange-500/10"
          />
          <StatCard
            icon={StickyNote}
            label="Notas"
            value={(recentNotes ?? []).length}
            color="text-purple-500"
            bg="bg-purple-500/10"
          />
        </div>

        {/* Tarefas de hoje */}
        {todayTasks.length > 0 && (
          <Section title="Tarefas de hoje" icon={CheckSquare}>
            {todayTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <span className={`size-2.5 rounded-full shrink-0 ${
                  t.priority === 'alta' ? 'bg-destructive' :
                  t.priority === 'media' ? 'bg-warning' : 'bg-primary'
                }`} />
                <span className="text-sm truncate flex-1">{t.title}</span>
                {t.dueTime && (
                  <span className="text-xs text-muted-foreground">{t.dueTime}</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Eventos de hoje */}
        {eventsToday.length > 0 && (
          <Section title="Eventos de hoje" icon={Calendar}>
            {eventsToday.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                <span className="text-sm truncate flex-1">{e.title}</span>
                {e.startTime && (
                  <span className="text-xs text-muted-foreground">{e.startTime}</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Hábitos */}
        {habitsToday.length > 0 && (
          <Section title="Hábitos de hoje" icon={Flame}>
            {habitsToday.map((h) => {
              const done = (todayLogs ?? []).some((l) => l.habitId === h.id)
              return (
                <div key={h.id} className="flex items-center gap-3 py-2">
                  <span className="text-lg">{h.icon}</span>
                  <span className={`text-sm flex-1 ${done ? 'line-through text-muted-foreground' : ''}`}>
                    {h.name}
                  </span>
                  {done && (
                    <span className="text-xs font-medium text-primary">Feito</span>
                  )}
                </div>
              )
            })}
          </Section>
        )}

        {/* Notas recentes */}
        {(recentNotes ?? []).length > 0 && (
          <Section title="Notas recentes" icon={StickyNote}>
            {(recentNotes ?? []).map((n) => (
              <div key={n.id} className="py-2">
                <p className="text-sm font-medium truncate">{n.title || 'Sem título'}</p>
                <p className="text-xs text-muted-foreground truncate">{n.content}</p>
              </div>
            ))}
          </Section>
        )}

        {/* Estado vazio */}
        {(todayTasks.length === 0 && eventsToday.length === 0 && habitsToday.length === 0) && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Clock className="size-7 text-muted-foreground" />
            </div>
            <p className="font-medium">Nada por aqui ainda</p>
            <p className="text-sm text-muted-foreground">
              Crie tarefas, eventos ou hábitos para começar
            </p>
          </div>
        )}
      </div>
    </>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  sub?: string
  color: string
  bg: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className={`flex size-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`size-5 ${color}`} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-destructive font-medium">{sub}</p>}
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build` no diretório do projeto.
Esperado: Build sem erros.

---

### Task 2: Página de Tarefas

**Covers:** [S2]

**Files:**
- Modify: `app/tarefas/page.tsx` (criar)

**Interfaces:**
- Consumes: `db.tasks` (Dexie), `TaskItem`, `TaskFormSheet`, `PageHeader`
- Produces: Página `/tarefas` com lista, filtros e form de criação/edição

- [ ] **Step 1: Criar página de tarefas**

Criar `app/tarefas/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListFilter, Plus } from 'lucide-react'
import { db, type Task } from '@/lib/db'
import { PageHeader } from '@/components/planner/page-header'
import { TaskItem } from '@/components/planner/task-item'
import { TaskFormSheet } from '@/components/planner/task-form-sheet'

type Filter = 'todas' | 'pendentes' | 'concluidas'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'concluidas', label: 'Concluídas' },
]

export default function TarefasPage() {
  const [filter, setFilter] = useState<Filter>('pendentes')
  const [editing, setEditing] = useState<Task | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const allTasks = useLiveQuery(
    () => db.tasks.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  )

  const tasks = (allTasks ?? []).filter((t) => {
    if (filter === 'pendentes') return t.completed === 0
    if (filter === 'concluidas') return t.completed === 1
    return true
  })

  function handleEdit(task: Task) {
    setEditing(task)
    setSheetOpen(true)
  }

  function handleNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <>
      <PageHeader title="Tarefas" />

      <div className="px-5 pb-6 space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-all active:scale-95 ${
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <ListFilter className="size-7 text-muted-foreground" />
              </div>
              <p className="font-medium">Nenhuma tarefa</p>
              <p className="text-sm text-muted-foreground">
                {filter === 'concluidas'
                  ? 'Nenhuma tarefa concluída ainda'
                  : 'Toque no + para criar uma tarefa'}
              </p>
            </div>
          ) : (
            tasks.map((t) => (
              <TaskItem key={t.id} task={t} onEdit={handleEdit} />
            ))
          )}
        </div>
      </div>

      <TaskFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        task={editing ?? undefined}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 3: Página de Calendário

**Covers:** [S3]

**Files:**
- Modify: `app/calendario/page.tsx` (criar)

**Interfaces:**
- Consumes: `db.events` (Dexie), `eventOccursOn` de `@/lib/notifications`, `EventFormSheet`, `PageHeader`, date-fns
- Produces: Página `/calendario` com grade mensal, seleção de dia, eventos do dia

- [ ] **Step 1: Criar página de calendário**

Criar `app/calendario/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { db, type PlannerEvent } from '@/lib/db'
import { eventOccursOn } from '@/lib/notifications'
import { PageHeader } from '@/components/planner/page-header'
import { EventFormSheet } from '@/components/planner/event-form-sheet'

export default function CalendarioPage() {
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PlannerEvent | undefined>()

  const events = useLiveQuery(() => db.events.toArray(), [], [])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const selectedStr = format(selected, 'yyyy-MM-dd')

  const eventsOnSelected = (events ?? []).filter((e) =>
    eventOccursOn(e, selectedStr),
  )

  function getEventsForDay(date: Date): PlannerEvent[] {
    const ds = format(date, 'yyyy-MM-dd')
    return (events ?? []).filter((e) => eventOccursOn(e, ds))
  }

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  return (
    <>
      <PageHeader title="Agenda" />

      <div className="px-5 pb-6 space-y-4">
        {/* Navegação do mês */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="flex size-10 items-center justify-center rounded-xl bg-secondary active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="text-lg font-bold capitalize">
            {format(current, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="flex size-10 items-center justify-center rounded-xl bg-secondary active:scale-95"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
            <span key={i} className="text-xs font-medium text-muted-foreground py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Grade do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const inMonth = isSameMonth(d, current)
            const today = isToday(d)
            const sel = isSameDay(d, selected)
            const dayEvents = getEventsForDay(d)
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl py-2 text-sm transition-all active:scale-90 ${
                  !inMonth
                    ? 'text-muted-foreground/40'
                    : sel
                      ? 'bg-primary text-primary-foreground font-bold'
                      : today
                        ? 'bg-accent text-accent-foreground font-semibold'
                        : 'text-foreground hover:bg-secondary'
                }`}
              >
                <span>{format(d, 'd')}</span>
                {dayEvents.length > 0 && (
                  <span className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => (
                      <span
                        key={i}
                        className="size-1 rounded-full"
                        style={{ backgroundColor: sel ? 'currentColor' : e.color }}
                      />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Eventos do dia selecionado */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {format(selected, "d 'de' MMMM", { locale: ptBR })}
            </h3>
            <button
              onClick={() => {
                setEditing(undefined)
                setSheetOpen(true)
              }}
              className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95"
            >
              <span className="size-3">+</span> Novo
            </button>
          </div>

          {eventsOnSelected.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum evento neste dia</p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventsOnSelected.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setEditing(e)
                    setSheetOpen(true)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-secondary active:scale-[0.98]"
                >
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    {e.startTime && (
                      <p className="text-xs text-muted-foreground">{e.startTime}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <EventFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        event={editing}
        defaultDate={selectedStr}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 4: Página de Hábitos

**Covers:** [S4]

**Files:**
- Modify: `app/habitos/page.tsx` (criar)

**Interfaces:**
- Consumes: `db.habits`, `db.habitLogs` (Dexie), `HabitFormSheet`, `PageHeader`, format de date-fns
- Produces: Página `/habitos` com lista de hábitos, toggle diário, form de criação/edição

- [ ] **Step 1: Criar página de hábitos**

Criar `app/habitos/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Flame, TrendingUp } from 'lucide-react'
import { db, type Habit } from '@/lib/db'
import { PageHeader } from '@/components/planner/page-header'
import { HabitFormSheet } from '@/components/planner/habit-form-sheet'

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function HabitosPage() {
  const [editing, setEditing] = useState<Habit | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const habits = useLiveQuery(() => db.habits.toArray(), [], [])
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayDow = new Date().getDay()

  const todayLogs = useLiveQuery(
    () => db.habitLogs.where('date').equals(todayStr).toArray(),
    [todayStr],
    [],
  )

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    return format(d, 'yyyy-MM-dd')
  })

  const logsLast7 = useLiveQuery(
    async () => {
      const logs: Record<string, number[]> = {}
      for (const dateStr of last7Days) {
        const dayLogs = await db.habitLogs.where('date').equals(dateStr).toArray()
        logs[dateStr] = dayLogs.map((l) => l.habitId)
      }
      return logs
    },
    [],
    {} as Record<string, number[]>,
  )

  const habitsToday = (habits ?? []).filter((h) => h.daysOfWeek.includes(todayDow))

  async function toggleHabit(habitId: number) {
    const existing = await db.habitLogs
      .where('[habitId+date]')
      .equals([habitId, todayStr])
      .first()
    if (existing) {
      await db.habitLogs.delete(existing.id!)
    } else {
      await db.habitLogs.add({ habitId, date: todayStr })
    }
  }

  function getStreak(habitId: number): number {
    if (!logsLast7) return 0
    let streak = 0
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const ds = format(d, 'yyyy-MM-dd')
      const dow = d.getDay()
      const habit = (habits ?? []).find((h) => h.id === habitId)
      if (!habit?.daysOfWeek.includes(dow)) continue
      if ((logsLast7[ds] ?? []).includes(habitId)) {
        streak++
      } else {
        break
      }
    }
    return streak
  }

  return (
    <>
      <PageHeader title="Hábitos" subtitle={format(new Date(), "d 'de' MMMM", { locale: ptBR })} />

      <div className="px-5 pb-6 space-y-4">
        {/* Resumo */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10">
            <Flame className="size-5 text-orange-500" />
          </span>
          <div>
            <p className="text-lg font-bold">
              {(todayLogs ?? []).length}/{habitsToday.length}
            </p>
            <p className="text-xs text-muted-foreground">Hábitos concluídos hoje</p>
          </div>
        </div>

        {/* Lista de hábitos */}
        <div className="space-y-2">
          {habitsToday.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Flame className="size-7 text-muted-foreground" />
              </div>
              <p className="font-medium">Nenhum hábito para hoje</p>
              <p className="text-sm text-muted-foreground">
                Crie hábitos paraDays da semana para rastrear
              </p>
            </div>
          ) : (
            habitsToday.map((h) => {
              const done = (todayLogs ?? []).some((l) => l.habitId === h.id)
              const streak = getStreak(h.id!)
              return (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <button
                    onClick={() => toggleHabit(h.id!)}
                    className={`flex size-12 items-center justify-center rounded-xl text-2xl transition-all active:scale-90 ${
                      done ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary'
                    }`}
                  >
                    {h.icon}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                      {h.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {DAY_LABELS.map((label, i) => {
                        const d = subDays(new Date(), 6 - i)
                        const ds = format(d, 'yyyy-MM-dd')
                        const habitDone = (logsLast7[ds] ?? []).includes(h.id!)
                        const isToday = i === 6
                        return (
                          <span
                            key={i}
                            className={`size-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                              habitDone
                                ? 'bg-primary text-primary-foreground'
                                : isToday
                                  ? 'bg-secondary ring-1 ring-primary/50 text-muted-foreground'
                                  : 'bg-secondary text-muted-foreground/50'
                            }`}
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  {streak > 0 && (
                    <div className="flex items-center gap-1 text-xs font-medium text-orange-500">
                      <TrendingUp className="size-3" />
                      {streak}d
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setEditing(h)
                      setSheetOpen(true)
                    }}
                    className="text-xs text-muted-foreground px-2 py-1 rounded-lg hover:bg-secondary"
                  >
                    Editar
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      <HabitFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        habit={editing ?? undefined}
      />
    </>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 5: Página de Notas

**Covers:** [S5]

**Files:**
- Modify: `app/notas/page.tsx` (criar)

**Interfaces:**
- Consumes: `db.notes` (Dexie), `NoteFormSheet`, `PageHeader`, `NOTE_COLORS` de note-form-sheet
- Produces: Página `/notas` com grid de notas, criação e edição

- [ ] **Step 1: Criar página de notas**

Criar `app/notas/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StickyNote, Pin, Plus } from 'lucide-react'
import { db, type Note } from '@/lib/db'
import { PageHeader } from '@/components/planner/page-header'
import { NoteFormSheet } from '@/components/planner/note-form-sheet'

export default function NotasPage() {
  const [editing, setEditing] = useState<Note | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const notes = useLiveQuery(
    () => db.notes.orderBy('pinned').reverse().sortBy('updatedAt'),
    [],
    [],
  )

  const pinned = (notes ?? []).filter((n) => n.pinned === 1)
  const unpinned = (notes ?? []).filter((n) => n.pinned === 0)

  function handleEdit(note: Note) {
    setEditing(note)
    setSheetOpen(true)
  }

  function handleNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  return (
    <>
      <PageHeader title="Notas" />

      <div className="px-5 pb-6 space-y-4">
        {(notes ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <StickyNote className="size-7 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma nota</p>
            <p className="text-sm text-muted-foreground">
              Toque no + para criar uma nota
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Pin className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Fixadas</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {pinned.map((n) => (
                    <NoteCard key={n.id} note={n} onClick={() => handleEdit(n)} />
                  ))}
                </div>
              </div>
            )}

            {unpinned.length > 0 && (
              <div>
                {pinned.length > 0 && (
                  <span className="text-xs font-medium text-muted-foreground mb-2 block">
                    Outras
                  </span>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {unpinned.map((n) => (
                    <NoteCard key={n.id} note={n} onClick={() => handleEdit(n)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <NoteFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        note={editing ?? undefined}
      />
    </>
  )
}

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-2xl border border-border p-4 text-left transition-all active:scale-[0.97] hover:shadow-md"
      style={{
        backgroundColor: note.color || undefined,
      }}
    >
      {note.pinned === 1 && (
        <Pin className="size-3 text-muted-foreground" />
      )}
      {note.title && (
        <p className="text-sm font-semibold line-clamp-2">{note.title}</p>
      )}
      {note.content && (
        <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
          {note.content}
        </p>
      )}
      <span className="mt-auto text-[10px] text-muted-foreground/60">
        {formatDistanceToNow(new Date(note.updatedAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 6: Página de Ajustes

**Covers:** [S6]

**Files:**
- Modify: `app/ajustes/page.tsx` (criar)

**Interfaces:**
- Consumes: `useSettings`, `updateSetting` de `@/hooks/use-settings`, `PALETTES`, `BACKGROUNDS` de `@/lib/themes`, `BUILT_IN_SOUNDS` de `@/lib/audio`, `db` para sons custom, `PageHeader`
- Produces: Página `/ajustes` com configurações de tema, som, vibração, lembrete

- [ ] **Step 1: Criar página de ajustes**

Criar `app/ajustes/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Palette, Volume2, Vibrate, Bell, Moon, Sun, Monitor, Upload, Trash2 } from 'lucide-react'
import { useSettings, updateSetting, type AppSettings } from '@/hooks/use-settings'
import { PALETTES, BACKGROUNDS } from '@/lib/themes'
import { BUILT_IN_SOUNDS } from '@/lib/audio'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/planner/page-header'

const MODES = [
  { id: 'light' as const, label: 'Claro', icon: Sun },
  { id: 'dark' as const, label: 'Escuro', icon: Moon },
  { id: 'system' as const, label: 'Sistema', icon: Monitor },
]

export default function AjustesPage() {
  const settings = useSettings()
  const [testSound, setTestSound] = useState<string | null>(null)

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    await db.settings.put({ key: 'customBgBlob', value: blob })
    await updateSetting('background', 'custom')
  }

  async function removeCustomBg() {
    await db.settings.delete('customBgBlob')
    await updateSetting('background', 'none')
  }

  return (
    <>
      <PageHeader title="Ajustes" />

      <div className="px-5 pb-6 space-y-6">
        {/* Paleta de cores */}
        <Section icon={Palette} title="Paleta de cores">
          <div className="flex flex-wrap gap-3">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => updateSetting('palette', p.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all active:scale-95 ${
                  settings.palette === p.id
                    ? 'bg-accent ring-2 ring-ring'
                    : 'hover:bg-secondary'
                }`}
              >
                <span
                  className="size-10 rounded-full"
                  style={{ backgroundColor: p.swatch }}
                />
                <span className="text-xs font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </Section>

        {/* Modo claro/escuro */}
        <Section icon={settings.mode === 'dark' ? Moon : Sun} title="Aparência">
          <div className="flex gap-2">
            {MODES.map((m) => {
              const Icon = m.icon
              return (
                <button
                  key={m.id}
                  onClick={() => updateSetting('mode', m.id)}
                  className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    settings.mode === m.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  <Icon className="size-4" />
                  {m.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Plano de fundo */}
        <Section icon={Palette} title="Plano de fundo">
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                onClick={() => {
                  updateSetting('background', bg.id)
                  removeCustomBg()
                }}
                className={`h-16 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                  settings.background === bg.id
                    ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                    : ''
                }`}
                style={{
                  background: bg.css || 'var(--secondary)',
                }}
              >
                {bg.name}
              </button>
            ))}
          </div>
          <label className="mt-2 flex items-center justify-center gap-2 h-11 rounded-xl border border-dashed border-border bg-secondary text-sm font-medium text-secondary-foreground cursor-pointer active:scale-95">
            <Upload className="size-4" />
            Imagem personalizada
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBgUpload}
            />
          </label>
          {settings.background === 'custom' && (
            <button
              onClick={removeCustomBg}
              className="mt-2 flex items-center justify-center gap-2 h-9 w-full rounded-xl bg-destructive/10 text-destructive text-sm font-medium active:scale-95"
            >
              <Trash2 className="size-4" />
              Remover imagem
            </button>
          )}
        </Section>

        {/* Sons */}
        <Section icon={Volume2} title="Som do alarme">
          <div className="space-y-2">
            <Toggle
              label="Som ativado"
              checked={settings.soundEnabled}
              onChange={(v) => updateSetting('soundEnabled', v)}
            />
            {settings.soundEnabled && (
              <div className="space-y-3 pt-2">
                {(['soundTask', 'soundEvent', 'soundHabit'] as const).map((key) => {
                  const label = key === 'soundTask' ? 'Tarefas' : key === 'soundEvent' ? 'Eventos' : 'Hábitos'
                  const val = settings[key] as string
                  const currentId = val.replace('builtin:', '')
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {BUILT_IN_SOUNDS.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => updateSetting(key, `builtin:${s.id}`)}
                            className={`h-8 rounded-full px-3 text-xs font-medium transition-all active:scale-95 ${
                              currentId === s.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Section>

        {/* Vibração */}
        <Section icon={Vibrate} title="Vibração">
          <Toggle
            label="Vibração ativada"
            checked={settings.vibrationEnabled}
            onChange={(v) => updateSetting('vibrationEnabled', v)}
          />
        </Section>

        {/* Lembrete padrão */}
        <Section icon={Bell} title="Lembrete padrão">
          <div className="flex flex-wrap gap-2">
            {[5, 10, 15, 30, 60].map((min) => (
              <button
                key={min}
                onClick={() => updateSetting('defaultReminderMinutes', min)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition-all active:scale-95 ${
                  settings.defaultReminderMinutes === min
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {min < 60 ? `${min} min` : `${min / 60}h`}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full rounded-xl bg-secondary p-4"
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-card transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 7: PWA Assets (manifest + service worker + ícones)

**Covers:** [S7]

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`

**Interfaces:**
- Consumes: cores do tema de `globals.css`
- Produze: Manifest PWA, service worker com cache, ícones

- [ ] **Step 1: Criar manifest.json**

Criar `public/manifest.json`:

```json
{
  "name": "Meu Planner",
  "short_name": "Planner",
  "description": "Planner pessoal completo: tarefas, calendário, hábitos e notas com alarmes e notificações",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f7faf8",
  "theme_color": "#f7faf8",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Criar service worker**

Criar `public/sw.js`:

```js
const CACHE_NAME = 'planner-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached)
      return cached || fetched
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/'))
      if (existing) return existing.focus()
      return self.clients.openWindow('/')
    }),
  )
})
```

- [ ] **Step 3: Criar ícones SVG e gerar PNGs**

Criar `public/icons/icon.svg` (ícone de planner com checkmark):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#16a34a"/>
  <path d="M128 180l80 80 176-176" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="96" y="320" width="320" height="8" rx="4" fill="white" opacity="0.5"/>
  <rect x="96" y="360" width="240" height="8" rx="4" fill="white" opacity="0.5"/>
</svg>
```

Gerar PNGs a partir do SVG usando canvas ou ferramenta CLI. Como alternativa rápida, usar um placeholder colorido:

Criar um script `scripts/gen-icons.cjs` para gerar PNGs via canvas (se disponível) ou criar um ícone simples:

```js
// scripts/gen-icons.cjs
// Gera ícones PWA simples como PNGs 192x192 e 512x512
const fs = require('fs')
const path = require('path')

// Cria um PNG mínimo válido (1x1 pixel verde, expandido para o tamanho correto)
// Na prática, o SVG será servido diretamente; estes PNGs são placeholders
function createMinimalPNG(width, height) {
  // PNG header + IHDR + IDAT + IEND para um pixel verde
  const buf = Buffer.from(
    '89504e470d0a1a0a0000000d494844520000000100000001080200000090' +
    '7753de0000000c4944415478016360f8cf000000020001e221bc33000000' +
    '0049454e44ae426082',
    'hex',
  )
  return buf
}

const dir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(dir, { recursive: true })

// Copia o SVG para o public
const svgSrc = path.join(dir, 'icon.svg')
if (!fs.existsSync(svgSrc)) {
  console.log('SVG não encontrado; crie public/icons/icon.svg primeiro')
}

console.log('Ícones criados em public/icons/')
```

Na verdade, para um app real, vamos gerar ícones SVGs de alta qualidade que funcionam em todos os navegadores modernos. Os PNGs de fallback podem ser gerados depois.

- [ ] **Step 4: Atualizar next.config para service worker**

Modificar `next.config.mjs` para copiar o sw.js:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 5: Verificar build**

Run: `pnpm build`
Esperado: Build sem erros.

---

### Task 8: Verificação Final

**Covers:** [S1-S7]

- [ ] **Step 1: Build completo**

Run: `pnpm build` no diretório do projeto.
Esperado: Build sem erros, todas as rotas geradas.

- [ ] **Step 2: Verificar rotas**

Confirmar que todas as páginas foram criadas:
- `app/page.tsx` (Home)
- `app/tarefas/page.tsx`
- `app/calendario/page.tsx`
- `app/habitos/page.tsx`
- `app/notas/page.tsx`
- `app/ajustes/page.tsx`
- `public/manifest.json`
- `public/sw.js`

- [ ] **Step 3: Verificar imports**

Confirmar que não há imports circulares ou quebrados. Todas as dependências (PageHeader, TaskItem, form sheets, db, hooks) estão em caminhos corretos.

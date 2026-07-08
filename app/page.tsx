'use client'

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckSquare, Calendar, Flame, StickyNote, Clock, CloudOff } from 'lucide-react'
import { db } from '@/lib/db'
import { isSheetsConfigured } from '@/lib/sheets-sync'
import { useAuth } from '@/hooks/use-auth'
import { eventOccursOn } from '@/lib/notifications'
import { PageHeader } from '@/components/planner/page-header'

export default function HomePage() {
  const [greeting, setGreeting] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()
  const uid = user?.id?.toString() ?? ''

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
  }, [])

  const pendingTasks = useLiveQuery(
    () => uid ? db.tasks.where('userId').equals(uid).filter((t) => t.completed === 0).toArray() : [],
    [uid],
    [],
  )

  const totalTasks = useLiveQuery(() => uid ? db.tasks.where('userId').equals(uid).count() : 0, [uid], 0)
  const allEvents = useLiveQuery(() => uid ? db.events.where('userId').equals(uid).toArray() : [], [uid], [])
  const allHabits = useLiveQuery(() => uid ? db.habits.where('userId').equals(uid).toArray() : [], [uid], [])
  const totalNotes = useLiveQuery(() => uid ? db.notes.where('userId').equals(uid).count() : 0, [uid], 0)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const todayLogs = useLiveQuery(
    () => uid ? db.habitLogs.where('userId').equals(uid).filter((l) => l.date === todayStr).toArray() : [],
    [uid, todayStr],
    [],
  )

  const recentNotes = useLiveQuery(
    () => uid ? db.notes.where('userId').equals(uid).sortBy('updatedAt').then((n) => n.reverse().slice(0, 3)) : [],
    [uid],
    [],
  )

  const overdueTasks = (pendingTasks ?? []).filter(
    (t) =>
      t.dueDate &&
      t.dueDate < todayStr &&
      isPast(parseISO(`${t.dueDate}T${t.dueTime ?? '23:59'}`)),
  )

  const todayTasks = (pendingTasks ?? []).filter((t) => t.dueDate === todayStr)

  const eventsToday = (allEvents ?? []).filter((e) => eventOccursOn(e, todayStr))

  const habitsToday = (allHabits ?? []).filter((h) => {
    const dow = new Date().getDay()
    return h.daysOfWeek.includes(dow)
  })

  const completedHabits = habitsToday.filter((h) =>
    (todayLogs ?? []).some((l) => l.habitId === h.id),
  ).length

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.name ?? ''}!`}
        subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
      />

      <div className="space-y-5 px-5 pb-6">
        {/* Aviso: banco de dados não configurado */}
        {!isSheetsConfigured() && (
          <button
            onClick={() => navigate('/ajustes')}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left transition-all active:scale-[0.98] dark:border-amber-800 dark:bg-amber-950/50"
          >
            <CloudOff className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Banco de dados não conectado
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Configure nas Ajustes para carregar seus dados
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Configurar</span>
          </button>
        )}

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={CheckSquare}
            label="Tarefas"
            value={totalTasks}
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
            value={totalNotes}
            color="text-purple-500"
            bg="bg-purple-500/10"
          />
        </div>

        {/* Tarefas de hoje */}
        {todayTasks.length > 0 && (
          <CardSection title="Tarefas de hoje" icon={CheckSquare}>
            {todayTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${
                    t.priority === 'alta'
                      ? 'bg-destructive'
                      : t.priority === 'media'
                        ? 'bg-warning'
                        : 'bg-primary'
                  }`}
                />
                <span className="truncate text-sm flex-1">{t.title}</span>
                {t.dueTime && (
                  <span className="text-xs text-muted-foreground">
                    {/^\d{2}:\d{2}$/.test(t.dueTime) ? t.dueTime : (() => { try { return format(parseISO(t.dueTime), 'HH:mm') } catch { return t.dueTime } })()}
                  </span>
                )}
              </div>
            ))}
          </CardSection>
        )}

        {/* Eventos de hoje */}
        {eventsToday.length > 0 && (
          <CardSection title="Eventos de hoje" icon={Calendar}>
            {eventsToday.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: e.color }}
                />
                <span className="truncate text-sm flex-1">{e.title}</span>
                {e.startTime && (
                  <span className="text-xs text-muted-foreground">{e.startTime}</span>
                )}
              </div>
            ))}
          </CardSection>
        )}

        {/* Hábitos */}
        {habitsToday.length > 0 && (
          <CardSection title="Hábitos de hoje" icon={Flame}>
            {habitsToday.map((h) => {
              const done = (todayLogs ?? []).some((l) => l.habitId === h.id)
              return (
                <div key={h.id} className="flex items-center gap-3 py-2">
                  <span className="text-lg">{h.icon}</span>
                  <span
                    className={`text-sm flex-1 ${done ? 'line-through text-muted-foreground' : ''}`}
                  >
                    {h.name}
                  </span>
                  {done && (
                    <span className="text-xs font-medium text-primary">Feito</span>
                  )}
                </div>
              )
            })}
          </CardSection>
        )}

        {/* Notas recentes */}
        {(recentNotes ?? []).length > 0 && (
          <CardSection title="Notas recentes" icon={StickyNote}>
            {(recentNotes ?? []).map((n) => (
              <div key={n.id} className="py-2">
                <p className="truncate text-sm font-medium">
                  {n.title || 'Sem título'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{n.content}</p>
              </div>
            ))}
          </CardSection>
        )}

        {/* Estado vazio */}
        {todayTasks.length === 0 &&
          eventsToday.length === 0 &&
          habitsToday.length === 0 && (
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

const STAT_ROUTES: Record<string, string> = {
  Tarefas: '/tarefas',
  Eventos: '/calendario',
  Hábitos: '/habitos',
  Notas: '/notas',
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
  const navigate = useNavigate()
  const route = STAT_ROUTES[label]

  return (
    <button
      onClick={() => route && navigate(route)}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.97] hover:border-primary/30">
      <span className={`flex size-10 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`size-5 ${color}`} />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs font-medium text-destructive">{sub}</p>}
      </div>
    </button>
  )
}

function CardSection({
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
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

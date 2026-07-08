'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Flame, TrendingUp } from 'lucide-react'
import { db, type Habit } from '@/lib/db'
import { syncHabitLogUpsert, syncHabitLogDelete } from '@/lib/sheets-sync'
import { useAuth } from '@/hooks/use-auth'
import { useRegisterFab } from '@/hooks/use-fab'
import { PageHeader } from '@/components/planner/page-header'
import { HabitFormSheet } from '@/components/planner/habit-form-sheet'

const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export default function HabitosPage() {
  const [editing, setEditing] = useState<Habit | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { user } = useAuth()
  const uid = user?.id?.toString() ?? ''

  const habits = useLiveQuery(() => uid ? db.habits.where('userId').equals(uid).toArray() : [], [uid], [])
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayDow = new Date().getDay()

  const todayLogs = useLiveQuery(
    () => uid ? db.habitLogs.where('userId').equals(uid).filter((l) => l.date === todayStr).toArray() : [],
    [uid, todayStr],
    [],
  )

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    return format(d, 'yyyy-MM-dd')
  })

  const logsLast7 = useLiveQuery(
    async () => {
      if (!uid) return {} as Record<string, number[]>
      const logs: Record<string, number[]> = {}
      for (const dateStr of last7Days) {
        const dayLogs = await db.habitLogs.where('userId').equals(uid).filter((l) => l.date === dateStr).toArray()
        logs[dateStr] = dayLogs.map((l) => l.habitId)
      }
      return logs
    },
    [uid],
    {} as Record<string, number[]>,
  )

  const habitsToday = (habits ?? []).filter((h) =>
    h.daysOfWeek.includes(todayDow),
  )

  function handleNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  useRegisterFab(handleNew)

  async function toggleHabit(habitId: number) {
    if (!uid) return
    const existing = await db.habitLogs
      .where('userId').equals(uid)
      .filter((l) => l.habitId === habitId && l.date === todayStr)
      .first()
    if (existing) {
      await db.habitLogs.delete(existing.id!)
      await syncHabitLogDelete(existing.id!)
    } else {
      const id = await db.habitLogs.add({ userId: uid, habitId, date: todayStr })
      await syncHabitLogUpsert({ id: Number(id), userId: uid, habitId, date: todayStr })
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
      <PageHeader
        title="Hábitos"
        subtitle={format(new Date(), "d 'de' MMMM", { locale: ptBR })}
      />

      <div className="space-y-4 px-5 pb-6">
        {/* Resumo */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-orange-500/10">
            <Flame className="size-5 text-orange-500" />
          </span>
          <div>
            <p className="text-lg font-bold">
              {(todayLogs ?? []).length}/{habitsToday.length}
            </p>
            <p className="text-xs text-muted-foreground">
              Hábitos concluídos hoje
            </p>
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
                    <p
                      className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}
                    >
                      {h.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {DAY_LABELS.map((label, i) => {
                        const d = subDays(new Date(), 6 - i)
                        const ds = format(d, 'yyyy-MM-dd')
                        const habitDone = (logsLast7[ds] ?? []).includes(h.id!)
                        const isToday = i === 6
                        return (
                          <span
                            key={i}
                            className={`flex size-4 items-center justify-center rounded-full text-[9px] font-bold ${
                              habitDone
                                ? 'bg-primary text-primary-foreground'
                              : isToday
                                  ? 'bg-secondary text-muted-foreground ring-1 ring-primary/50'
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
                    className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
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

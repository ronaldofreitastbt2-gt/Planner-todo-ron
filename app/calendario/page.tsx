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
import { useAuth } from '@/hooks/use-auth'
import { useRegisterFab } from '@/hooks/use-fab'
import { eventOccursOn } from '@/lib/notifications'
import { PageHeader } from '@/components/planner/page-header'
import { EventFormSheet } from '@/components/planner/event-form-sheet'

export default function CalendarioPage() {
  const [current, setCurrent] = useState(new Date())
  const [selected, setSelected] = useState(new Date())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<PlannerEvent | undefined>()
  const { user } = useAuth()
  const uid = user?.id?.toString() ?? ''

  const events = useLiveQuery(() => uid ? db.events.where('userId').equals(uid).toArray() : [], [uid], [])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const selectedStr = format(selected, 'yyyy-MM-dd')

  function handleNew() {
    setEditing(undefined)
    setSheetOpen(true)
  }

  useRegisterFab(handleNew)

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

      <div className="space-y-4 px-5 pb-6">
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
            <span
              key={i}
              className="py-1 text-xs font-medium text-muted-foreground"
            >
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
                      ? 'bg-primary font-bold text-primary-foreground'
                      : today
                        ? 'bg-accent font-semibold text-accent-foreground'
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
                        style={{
                          backgroundColor: sel ? 'currentColor' : e.color,
                        }}
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
          <div className="mb-3 flex items-center justify-between">
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
              + Novo
            </button>
          </div>

          {eventsOnSelected.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum evento neste dia
              </p>
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
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    {e.startTime && (
                      <p className="text-xs text-muted-foreground">
                        {e.startTime}
                      </p>
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

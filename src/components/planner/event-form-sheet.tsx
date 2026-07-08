import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/hooks/use-auth'
import { db, type PlannerEvent } from '@/lib/db'
import { syncEventUpsert, syncEventDelete } from '@/lib/sheets-sync'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const RECURRENCES = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

export function EventFormSheet({
  open,
  onOpenChange,
  event,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: PlannerEvent
  defaultDate?: string
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [recurrence, setRecurrence] = useState('nenhuma')
  const [alarmEnabled, setAlarmEnabled] = useState(0)
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(5)

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setDescription(event.description ?? '')
      setDate(event.date ? event.date.slice(0, 10) : '')
      setEndDate(event.endDate ? event.endDate.slice(0, 10) : '')
      setStartTime(event.startTime ? (event.startTime.length > 5 ? event.startTime.slice(11, 16) : event.startTime) : '')
      setEndTime(event.endTime ? (event.endTime.length > 5 ? event.endTime.slice(11, 16) : event.endTime) : '')
      setColor(event.color)
      setRecurrence(event.recurrence ?? 'nenhuma')
      setAlarmEnabled(event.alarmEnabled)
      setAlarmMinutesBefore(event.alarmMinutesBefore)
    } else {
      setTitle('')
      setDescription('')
      setDate(defaultDate ?? new Date().toISOString().slice(0, 10))
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setColor(COLORS[0])
      setRecurrence('nenhuma')
      setAlarmEnabled(0)
      setAlarmMinutesBefore(5)
    }
  }, [event, open, defaultDate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return

    try {
      if (event?.id) {
        const updated: PlannerEvent = {
          id: event.id,
          userId: user!.id.toString(),
          title: title.trim(),
          description: description.trim() || undefined,
          date,
          endDate: endDate || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          color,
          recurrence,
          alarmEnabled,
          alarmMinutesBefore,
          alarmSound: event.alarmSound ?? '',
        }
        await db.events.put(updated)
        void syncEventUpsert(updated)
        toast('success', 'Evento atualizado')
      } else {
        const created: PlannerEvent = {
          userId: user!.id.toString(),
          title: title.trim(),
          description: description.trim() || undefined,
          date,
          endDate: endDate || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          color,
          recurrence,
          alarmEnabled,
          alarmMinutesBefore,
          alarmSound: '',
        }
        const id = await db.events.add(created)
        void syncEventUpsert({ ...created, id })
        toast('success', 'Evento criado')
      }

      onOpenChange(false)
    } catch (err) {
      console.error('[event] Erro ao salvar:', err)
      toast('error', `Erro: ${err}`)
    }
  }

  async function handleDelete() {
    if (event?.id) {
      await db.events.delete(event.id)
      void syncEventDelete(event.id)
      toast('info', 'Evento excluído')
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={event ? 'Editar evento' : 'Novo evento'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <textarea
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
            />

            <div className="flex gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-3">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Data fim"
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cor</p>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-offset-card' : ''
                    }`}
                    style={{ backgroundColor: c, ['--tw-ring-color' as string]: c }}
                  />
                ))}
              </div>
            </div>

            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {RECURRENCES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Alarm section */}
            <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-3">
              <button
                type="button"
                onClick={() => setAlarmEnabled(alarmEnabled ? 0 : 1)}
                className={`flex w-full items-center gap-2 text-sm font-medium ${
                  alarmEnabled ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  alarmEnabled ? 'bg-primary' : 'bg-muted'
                }`}>
                  <span className={`absolute left-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                    alarmEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </span>
                Alarme
              </button>
              {alarmEnabled ? (
                <select
                  value={alarmMinutesBefore}
                  onChange={(e) => setAlarmMinutesBefore(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={0}>Na hora exata</option>
                  <option value={5}>5 min antes</option>
                  <option value={10}>10 min antes</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1 hora antes</option>
                </select>
              ) : null}
            </div>

            <div className="flex gap-2">
              {event?.id && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-xl border border-destructive/30 py-3 px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Excluir
                </button>
              )}
              <button
                type="submit"
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
              >
                {event ? 'Salvar' : 'Criar evento'}
              </button>
            </div>
      </form>
    </Modal>
  )
}

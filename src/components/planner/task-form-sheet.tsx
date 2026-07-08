import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/hooks/use-auth'
import { db, type Task } from '@/lib/db'
import { syncTaskUpsert } from '@/lib/sheets-sync'

export function TaskFormSheet({
  open,
  onOpenChange,
  task,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('media')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [alarmEnabled, setAlarmEnabled] = useState(0)
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(5)
  const [alarmSound, setAlarmSound] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Referência para acessar valor atual caso o toast/contexto esteja desmontado
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      // Extrair apenas a parte da data (YYYY-MM-DD) de qualquer formato
      setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '')
      // Extrair apenas a parte do horário (HH:mm) de qualquer formato
      setDueTime(task.dueTime ? task.dueTime.slice(11, 16) || task.dueTime.slice(0, 5) : '')
      setAlarmEnabled(Number(task.alarmEnabled) || 0)
      setAlarmMinutesBefore(Number(task.alarmMinutesBefore) || 5)
      setAlarmSound(task.alarmSound ?? '')
    } else {
      setTitle('')
      setDescription('')
      setPriority('media')
      setDueDate('')
      setDueTime('')
      setAlarmEnabled(0)
      setAlarmMinutesBefore(5)
      setAlarmSound('')
    }
  }, [task, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!title.trim()) return
    if (!user?.id) {
      toast('error', 'Sessão expirada. Faça login novamente.')
      return
    }

    setSubmitting(true)
    const t = toastRef.current
    try {
      const now = new Date().toISOString()

      if (task?.id) {
        // Atualizar — put() funciona mesmo se o ID não existir (insere)
        const updated: Task = {
          id: task.id,
          userId: user.id.toString(),
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
          alarmEnabled,
          alarmMinutesBefore,
          alarmSound,
          completed: task.completed ?? 0,
          createdAt: task.createdAt ?? now,
        }
        await db.tasks.put(updated)
        // Sobe para a planilha em paralelo (não bloqueia a UI)
        void syncTaskUpsert(updated).then((ok) => {
          if (!ok) console.warn('[task] Sync falhou ou URL não configurada — dado salvo localmente')
        })
        t('success', 'Tarefa atualizada')
      } else {
        // Criar novo
        const created: Task = {
          userId: user.id.toString(),
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
          dueTime: dueTime || undefined,
          alarmEnabled,
          alarmMinutesBefore,
          alarmSound,
          completed: 0,
          createdAt: now,
        }
        const id = await db.tasks.add(created)
        void syncTaskUpsert({ ...created, id }).then((ok) => {
          if (!ok) console.warn('[task] Sync falhou ou URL não configurada — dado salvo localmente')
        })
        t('success', 'Tarefa criada')
      }

      onOpenChange(false)
    } catch (err) {
      console.error('[task] Erro ao salvar:', err)
      t('error', `Erro: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={task ? 'Editar tarefa' : 'Nova tarefa'}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

            <div className="flex gap-2">
              {(['baixa', 'media', 'alta'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                    priority === p
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

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

            <button
              type="button"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault()
                handleSubmit(e as any)
              }}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
            >
              {submitting ? 'Salvando...' : task ? 'Salvar' : 'Criar tarefa'}
            </button>
      </form>
    </Modal>
  )
}

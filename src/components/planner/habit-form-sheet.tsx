import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/hooks/use-auth'
import { db, type Habit } from '@/lib/db'
import { syncHabitUpsert, syncHabitDelete } from '@/lib/sheets-sync'

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const ICONS = ['💪', '📚', '🏃', '🧘', '💧', '🎵', '✍️', '🧹', '🛌', '🥗']

export function HabitFormSheet({
  open,
  onOpenChange,
  habit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  habit?: Habit
}) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])

  useEffect(() => {
    if (habit) {
      setName(habit.name)
      setIcon(habit.icon)
      setDaysOfWeek(habit.daysOfWeek)
    } else {
      setName('')
      setIcon(ICONS[0])
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6])
    }
  }, [habit, open])

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const data = { userId: user!.id.toString(), name: name.trim(), icon, daysOfWeek }

      if (habit?.id) {
        const existing = await db.habits.get(habit.id)
        if (existing) {
          await db.habits.update(habit.id, data)
        } else {
          await db.habits.put({ ...data, id: habit.id, createdAt: habit.createdAt ?? new Date().toISOString() })
        }
        await syncHabitUpsert({ ...habit, ...data })
        toast('success', 'Hábito atualizado')
      } else {
        const id = await db.habits.add({ ...data, createdAt: new Date().toISOString() })
        await syncHabitUpsert({ id: Number(id), ...data, createdAt: new Date().toISOString() } as Habit)
        toast('success', 'Hábito criado')
      }

      onOpenChange(false)
    } catch (err) {
      console.error('[habit] Erro ao salvar hábito:', err)
      toast('error', `Erro ao salvar: ${err}`)
    }
  }

  async function handleDelete() {
    if (habit?.id) {
      await db.habits.delete(habit.id)
      await syncHabitDelete(habit.id)
      toast('info', 'Hábito excluído')
      onOpenChange(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={habit ? 'Editar hábito' : 'Novo hábito'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nome do hábito"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Ícone</p>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex size-10 items-center justify-center rounded-xl text-xl transition-all ${
                      icon === ic
                        ? 'bg-primary/20 ring-2 ring-primary'
                        : 'bg-secondary'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Dias da semana
              </p>
              <div className="flex gap-2">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all ${
                      daysOfWeek.includes(i)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {habit?.id && (
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
                {habit ? 'Salvar' : 'Criar hábito'}
              </button>
            </div>
      </form>
    </Modal>
  )
}

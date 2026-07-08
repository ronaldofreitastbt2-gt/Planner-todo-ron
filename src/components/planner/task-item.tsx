import { Check, Pencil, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { db, type Task } from '@/lib/db'
import { syncTaskUpsert, syncTaskDelete } from '@/lib/sheets-sync'

function formatTaskDate(dateStr: string): string {
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return format(parseISO(dateStr + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })
    }
    return format(parseISO(dateStr), "dd 'de' MMM", { locale: ptBR })
  } catch {
    return dateStr
  }
}

function formatTaskTime(timeStr: string): string {
  try {
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr
    return format(parseISO(timeStr), 'HH:mm')
  } catch {
    return timeStr
  }
}

export function TaskItem({
  task,
  onEdit,
}: {
  task: Task
  onEdit: (task: Task) => void
}) {
  async function toggleComplete() {
    const nextCompleted = task.completed === 1 ? 0 : 1
    const updated = { ...task, completed: nextCompleted }
    await db.tasks.put(updated)
    void syncTaskUpsert(updated)
  }

  async function deleteTask() {
    await db.tasks.delete(task.id!)
    void syncTaskDelete(task.id!)
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all">
      <button
        onClick={toggleComplete}
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
          task.completed === 1
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border'
        }`}
      >
        {task.completed === 1 && <Check className="size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            task.completed === 1 ? 'line-through text-muted-foreground' : ''
          }`}
        >
          {task.title}
        </p>
        {(task.dueDate || task.dueTime) && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[task.dueDate ? formatTaskDate(task.dueDate) : '', task.dueTime ? formatTaskTime(task.dueTime) : ''].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <span
        className={`size-2 shrink-0 rounded-full ${
          task.priority === 'alta'
            ? 'bg-destructive'
            : task.priority === 'media'
              ? 'bg-warning'
              : 'bg-primary'
        }`}
      />

      <div className="flex gap-1">
        <button
          onClick={() => onEdit(task)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={deleteTask}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

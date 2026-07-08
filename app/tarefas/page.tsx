'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListFilter } from 'lucide-react'
import { db, type Task } from '@/lib/db'
import { useAuth } from '@/hooks/use-auth'
import { useRegisterFab } from '@/hooks/use-fab'
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
  const { user } = useAuth()
  const uid = user?.id?.toString() ?? ''

  const allTasks = useLiveQuery(
    () => uid ? db.tasks.where('userId').equals(uid).sortBy('createdAt').then((t) => t.reverse()) : [],
    [uid],
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

  useRegisterFab(handleNew)

  return (
    <>
      <PageHeader title="Tarefas" />

      <div className="space-y-4 px-5 pb-6">
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
